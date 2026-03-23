import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, DB_VERSION } from './db';
import { useSettingsStore } from '@/store/useSettingsStore';
import { exportData, importData, migrateBackup, BACKUP_MIGRATIONS, type BackupPayload } from './backup';

// Mock Browser APIs
globalThis.URL.createObjectURL = vi.fn(() => 'blob:url');
globalThis.URL.revokeObjectURL = vi.fn();

class MockBlob {
    content: any;
    options: any;
    static lastInstance: MockBlob;
    constructor(content: any, options: any) {
        this.content = content;
        this.options = options;
        MockBlob.lastInstance = this;
    }
}
globalThis.Blob = MockBlob as any;

const mockReader = {
    readAsText: vi.fn(),
    onload: null as any,
    result: ''
};

class MockFileReader {
    readAsText(file: any) {
        mockReader.readAsText(file);
        setTimeout(() => {
            if (this.onload) {
                this.onload({ target: { result: mockReader.result } });
            }
        }, 0);
    }
    onload: any;
}
vi.stubGlobal('FileReader', MockFileReader);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
    return {
        version: DB_VERSION,
        timestamp: Date.now(),
        appName: 'CryptoFolio',
        transactions: [],
        positions: [],
        settings: { predefinedPairs: ['BTC/USDT'], dashboardTimeRange: '1Y', theme: 'dark' },
        ...overrides,
    };
}

function setMockFile(payload: object) {
    mockReader.result = JSON.stringify(payload);
    return new File([mockReader.result], 'backup.json', { type: 'application/json' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('backup logic', () => {

    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
        useSettingsStore.setState({
            predefinedPairs: ['TEST/USDT'],
            theme: 'dark',
            dashboardTimeRange: 'ALL'
        });
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('exportData', () => {
        it('creates a download link with the correct data payload', async () => {
            const mockLink = { href: '', download: '', click: vi.fn() };
            document.createElement = vi.fn().mockReturnValue(mockLink);
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            await db.transactions.add({ id: 'tx1', symbol: 'BTC/USDT' } as any);
            await db.positions.add({ id: 'pos1', symbol: 'BTC/USDT' } as any);

            await exportData();

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.download).toContain('cryptofolio-backup');
            expect(mockLink.click).toHaveBeenCalled();

            const blobContent = (globalThis.Blob as any).lastInstance.content[0];
            const payload = JSON.parse(blobContent);

            expect(payload.appName).toBe('CryptoFolio');
            expect(payload.transactions).toHaveLength(1);
            expect(payload.positions).toHaveLength(1);
            expect(payload.settings.theme).toBe('dark');
        });

        it('embeds the current DB_VERSION in the exported payload', async () => {
            const mockLink = { href: '', download: '', click: vi.fn() };
            document.createElement = vi.fn().mockReturnValue(mockLink);
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            await exportData();

            const blobContent = (globalThis.Blob as any).lastInstance.content[0];
            const payload = JSON.parse(blobContent);
            expect(payload.version).toBe(DB_VERSION);
        });
    });

    // -----------------------------------------------------------------------
    describe('importData', () => {
        it('successfully hydrates DB and settings from a valid backup file', async () => {
            const payload = makePayload({
                transactions: [{ id: 'new-tx', symbol: 'ETH/USDT' }],
                positions: [{ id: 'new-pos', symbol: 'ETH/USDT' }],
                settings: { predefinedPairs: ['ETH/USDT'], dashboardTimeRange: '1M', theme: 'light' },
            });

            await importData(setMockFile(payload));

            expect(await db.transactions.count()).toBe(1);
            expect(await db.positions.count()).toBe(1);
            const settings = useSettingsStore.getState();
            expect(settings.theme).toBe('light');
            expect(settings.dashboardTimeRange).toBe('1M');
        });

        it('throws if the backup belongs to another app', async () => {
            const file = setMockFile({ appName: 'WrongApp' });
            await expect(importData(file)).rejects.toThrow('Invalid backup file');
        });

        it('throws if the version field is missing', async () => {
            const file = setMockFile({ appName: 'CryptoFolio', transactions: [], positions: [] });
            await expect(importData(file)).rejects.toThrow('missing or non-numeric version field');
        });

        it('throws if the version field is not a number', async () => {
            const file = setMockFile(makePayload({ version: 'one' as any }));
            await expect(importData(file)).rejects.toThrow('missing or non-numeric version field');
        });

        it('throws if the backup is from a newer app version', async () => {
            const file = setMockFile(makePayload({ version: DB_VERSION + 999 }));
            await expect(importData(file)).rejects.toThrow('newer version of CryptoFolio');
        });
    });

    // -----------------------------------------------------------------------
    describe('migrateBackup', () => {
        it('returns the payload unchanged when already at DB_VERSION', () => {
            const payload = makePayload();
            const result = migrateBackup(payload);
            expect(result).toBe(payload); // same reference, no copy
        });

        it('throws when no migration handler exists for the version gap', () => {
            // version 0 has no handler in BACKUP_MIGRATIONS
            const payload = makePayload({ version: 0 });
            expect(() => migrateBackup(payload)).toThrow('No migration path from backup version 0');
        });

        it('applies a single registered migration step', () => {
            // Temporarily register a v1→v2 migration (only if DB_VERSION >= 2)
            // We simulate it by patching the map directly and using a synthetic version range.
            const originalMigrations = { ...BACKUP_MIGRATIONS };

            // Patch: treat version 98 → 99 as a valid migration
            BACKUP_MIGRATIONS[98] = (p) => ({
                ...p,
                version: 99,
                transactions: p.transactions.map((t: any) => ({ ...t, _migrated: true })),
            });

            const payload: BackupPayload = makePayload({
                version: 98,
                transactions: [{ id: 'tx1' }],
            });

            // Override DB_VERSION locally — we need a helper approach:
            // migrateBackup loops while p.version < DB_VERSION, so we need DB_VERSION = 99.
            // Since DB_VERSION is a const export we can't easily override it. Instead, we
            // rely on the fact that 98 < current DB_VERSION (1) is false, so this specific
            // test checks migration logic using the private loop condition directly.
            // Workaround: set version to something < DB_VERSION with a handler.
            // DB_VERSION is 1, so we test version 0 → 1.
            BACKUP_MIGRATIONS[0] = (p) => ({
                ...p,
                version: 1,
                transactions: p.transactions.map((t: any) => ({ ...t, _migratedFromV0: true })),
            });

            const v0payload: BackupPayload = makePayload({
                version: 0,
                transactions: [{ id: 'tx1', symbol: 'BTC/USDT' }],
            });

            const result = migrateBackup(v0payload);

            expect(result.version).toBe(DB_VERSION);
            expect(result.transactions[0]._migratedFromV0).toBe(true);

            // Cleanup
            delete BACKUP_MIGRATIONS[98];
            delete BACKUP_MIGRATIONS[0];
            Object.assign(BACKUP_MIGRATIONS, originalMigrations);
        });

        it('applies multiple migration steps in sequence', () => {
            // Simulate a chain: 0 → 1 (only meaningful if DB_VERSION = 1, so one step)
            // For a real chain test we add two synthetic steps that bring version 0 → 1 via an
            // intermediate step by temporarily adjusting BACKUP_MIGRATIONS.
            // We test the chain logic by registering two consecutive handlers for a synthetic
            // version path that ends at DB_VERSION.

            // Temporarily override to create a 2-step chain ending at DB_VERSION (1):
            //   version -1 → version 0 → version 1 (DB_VERSION)
            // Note: version -1 is purely synthetic for this test.
            BACKUP_MIGRATIONS[-1] = (p) => ({
                ...p,
                version: 0,
                transactions: p.transactions.map((t: any) => ({ ...t, _step1: true })),
            });
            BACKUP_MIGRATIONS[0] = (p) => ({
                ...p,
                version: 1,
                transactions: p.transactions.map((t: any) => ({ ...t, _step2: true })),
            });

            const payload: BackupPayload = makePayload({
                version: -1,
                transactions: [{ id: 'tx1' }],
            });

            const result = migrateBackup(payload);

            expect(result.version).toBe(DB_VERSION);
            expect(result.transactions[0]._step1).toBe(true);
            expect(result.transactions[0]._step2).toBe(true);

            delete BACKUP_MIGRATIONS[-1];
            delete BACKUP_MIGRATIONS[0];
        });

        it('throws if the migration chain has a gap', () => {
            // Register step for version -2 → -1 but not -1 → anything,
            // leaving a gap before reaching DB_VERSION.
            BACKUP_MIGRATIONS[-2] = (p) => ({ ...p, version: -1 });
            // No handler for -1, so it should throw

            const payload: BackupPayload = makePayload({ version: -2 });

            expect(() => migrateBackup(payload)).toThrow('No migration path from backup version -1');

            delete BACKUP_MIGRATIONS[-2];
        });
    });

    // -----------------------------------------------------------------------
    describe('importData with migration', () => {
        it('auto-migrates an older backup before hydrating the DB', async () => {
            // Register a v0→v1 migration that adds a sentinel field
            BACKUP_MIGRATIONS[0] = (p) => ({
                ...p,
                version: 1,
                transactions: p.transactions.map((t: any) => ({ ...t, _autoMigrated: true })),
            });

            const oldPayload = makePayload({
                version: 0,
                transactions: [{ id: 'legacy-tx', symbol: 'BTC/USDT' }],
                positions: [],
            });

            await importData(setMockFile(oldPayload));

            const stored = await db.transactions.toArray();
            expect(stored).toHaveLength(1);
            expect((stored[0] as any)._autoMigrated).toBe(true);

            delete BACKUP_MIGRATIONS[0];
        });
    });
});
