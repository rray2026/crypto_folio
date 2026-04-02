import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db, DB_VERSION } from './db';
import { useSettingsStore } from '@/store/useSettingsStore';
import { exportData, importData, type BackupPayload } from './backup';
import { MIGRATIONS } from './migrations';

// Mock Browser APIs
globalThis.URL.createObjectURL = vi.fn(() => 'blob:url');
globalThis.URL.revokeObjectURL = vi.fn();

class MockBlob {
    content: string[];
    options?: BlobPropertyBag;
    static lastInstance: MockBlob;
    constructor(content: string[], options?: BlobPropertyBag) {
        this.content = content;
        this.options = options;
        MockBlob.lastInstance = this;
    }
}
globalThis.Blob = MockBlob as unknown as typeof Blob;

const mockReader = {
    readAsText: vi.fn(),
    onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null,
    result: ''
};

class MockFileReader {
    readAsText(file: File) {
        mockReader.readAsText(file);
        setTimeout(() => {
            if (this.onload) {
                // @ts-expect-error - simplified mock for tests
                this.onload({ target: { result: mockReader.result } });
            }
        }, 0);
    }
    onload: ((ev: ProgressEvent<FileReader>) => unknown) | null = null;
}
vi.stubGlobal('FileReader', MockFileReader);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import type { Transaction, Position } from './types';

function makePayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
    return {
        version: DB_VERSION,
        timestamp: Date.now(),
        appName: 'CryptoFolio',
        transactions: [],
        positions: [],
        funds: [],
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

    afterEach(() => {
        // Remove any synthetic migration entries added during tests
        for (const key of Object.keys(MIGRATIONS)) {
            const n = Number(key);
            if (n < 1 || n >= DB_VERSION) delete MIGRATIONS[n];
        }
    });

    // -----------------------------------------------------------------------
    describe('exportData', () => {
        it('creates a download link with the correct data payload', async () => {
            const mockLink = { href: '', download: '', click: vi.fn() };
            document.createElement = vi.fn().mockReturnValue(mockLink);
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();

            await db.transactions.add({ id: 'tx1', symbol: 'BTC/USDT' } as unknown as Transaction);
            await db.positions.add({ id: 'pos1', symbol: 'BTC/USDT' } as unknown as Position);

            await exportData();

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockLink.download).toContain('cryptofolio-backup');
            expect(mockLink.click).toHaveBeenCalled();

            const blobContent = (globalThis.Blob as unknown as { lastInstance: MockBlob }).lastInstance.content[0];
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

            const blobContent = (globalThis.Blob as unknown as { lastInstance: MockBlob }).lastInstance.content[0];
            const payload = JSON.parse(blobContent);
            expect(payload.version).toBe(DB_VERSION);
        });
    });

    // -----------------------------------------------------------------------
    describe('importData', () => {
        it('successfully hydrates DB and settings from a valid backup file', async () => {
            const payload = makePayload({
                transactions: [{ id: 'new-tx', symbol: 'ETH/USDT' } as Transaction],
                positions: [{ id: 'new-pos', symbol: 'ETH/USDT' } as Position],
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
            const file = setMockFile(makePayload({ version: 'one' as unknown as number }));
            await expect(importData(file)).rejects.toThrow('missing or non-numeric version field');
        });

        it('throws if the backup is from a newer app version', async () => {
            const file = setMockFile(makePayload({ version: DB_VERSION + 999 }));
            await expect(importData(file)).rejects.toThrow('newer version of CryptoFolio');
        });
    });

    // -----------------------------------------------------------------------
    describe('importData error paths', () => {
        it('rejects on empty file content', async () => {
            mockReader.result = '';
            const file = new File([''], 'backup.json', { type: 'application/json' });
            await expect(importData(file)).rejects.toThrow('Empty file payload.');
        });

        it('rejects on malformed JSON', async () => {
            mockReader.result = 'not valid json { broken';
            const file = new File([''], 'backup.json', { type: 'application/json' });
            await expect(importData(file)).rejects.toThrow();
        });

        it('rejects when transactions or positions arrays are missing', async () => {
            const file = setMockFile({ appName: 'CryptoFolio', version: DB_VERSION, settings: {} });
            await expect(importData(file)).rejects.toThrow('Malformed backup properties');
        });

        it('normalizes missing funds array to empty array and succeeds', async () => {
            const payloadWithoutFunds = {
                version: DB_VERSION,
                timestamp: Date.now(),
                appName: 'CryptoFolio',
                transactions: [],
                positions: [],
                // no funds field
                settings: { predefinedPairs: [], dashboardTimeRange: '1Y', theme: 'dark' },
            };
            await expect(importData(setMockFile(payloadWithoutFunds))).resolves.toBeUndefined();
            expect(await db.funds.count()).toBe(0);
        });

        it('rejects when FileReader encounters a native error', async () => {
            class ErrorFileReader {
                onerror: (() => void) | null = null;
                onload: (() => void) | null = null;
                readAsText() {
                    setTimeout(() => { if (this.onerror) this.onerror(); }, 0);
                }
            }
            vi.stubGlobal('FileReader', ErrorFileReader);
            try {
                const file = new File([''], 'test.json');
                await expect(importData(file)).rejects.toThrow('File Reader threw a native error');
            } finally {
                vi.stubGlobal('FileReader', MockFileReader);
            }
        });
    });

    // -----------------------------------------------------------------------
    describe('importData pairConfigs handling', () => {
        it('derives pairConfigs from predefinedPairs when pairConfigs is absent', async () => {
            const payload = makePayload({
                settings: {
                    predefinedPairs: ['BTC/USDT', 'ETH/USDT'],
                    dashboardTimeRange: '1Y',
                    theme: 'dark',
                },
            });
            await importData(setMockFile(payload));
            const { pairConfigs } = useSettingsStore.getState();
            expect(pairConfigs).toHaveLength(2);
            expect(pairConfigs[0].pair).toBe('BTC/USDT');
            expect(pairConfigs[1].pair).toBe('ETH/USDT');
            expect(pairConfigs[0].exchange).toBe('Binance');
        });

        it('uses pairConfigs from backup directly when present', async () => {
            const payload: BackupPayload = {
                ...makePayload(),
                settings: {
                    predefinedPairs: ['BTC/USDT'],
                    pairConfigs: [{ pair: 'BTC/USDT', exchange: 'OKX', dataProvider: 'OKX', currency: 'USDT' }],
                    dashboardTimeRange: '1Y',
                    theme: 'dark',
                },
            };
            await importData(setMockFile(payload));
            const { pairConfigs } = useSettingsStore.getState();
            expect(pairConfigs).toHaveLength(1);
            expect(pairConfigs[0].exchange).toBe('OKX');
        });
    });

    // -----------------------------------------------------------------------
    describe('importData with migration', () => {
        it('auto-migrates an older backup before hydrating the DB', async () => {
            // Register a synthetic v0 → v1 migration via the shared MIGRATIONS registry
            MIGRATIONS[0] = {
                description: 'test: add _autoMigrated sentinel',
                upgradePayload: (p) => ({
                    ...p,
                    version: 1,
                    transactions: (p.transactions as { id: string }[]).map((t) => ({ ...t, _autoMigrated: true })),
                }),
                upgradeIdb: () => {},
            };

            const oldPayload = makePayload({
                version: 0,
                transactions: [{ id: 'legacy-tx', symbol: 'BTC/USDT' } as Transaction],
                positions: [],
            });

            await importData(setMockFile(oldPayload));

            const stored = await db.transactions.toArray();
            expect(stored).toHaveLength(1);
            expect((stored[0] as unknown as { _autoMigrated: boolean })._autoMigrated).toBe(true);
        });
    });
});
