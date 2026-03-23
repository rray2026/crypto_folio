import { describe, it, expect, afterEach } from 'vitest';
import { MIGRATIONS, migratePayload, type Migration } from './migrations';
import { DB_VERSION } from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal payload at the given version. */
function makePayload(version: number, extra: Record<string, any> = {}): Record<string, any> {
    return {
        version,
        appName: 'CryptoFolio',
        timestamp: 0,
        transactions: [],
        positions: [],
        settings: {},
        ...extra,
    };
}

/** A factory for throwaway migration entries used in tests. */
function makeMigration(toVersion: number, transform?: (p: any) => any): Migration {
    return {
        description: `test migration → v${toVersion}`,
        upgradePayload: transform ?? ((p) => ({ ...p, version: toVersion })),
        upgradeIdb: () => Promise.resolve(),
    };
}

// Clean up any synthetic entries added during tests.
afterEach(() => {
    for (const key of Object.keys(MIGRATIONS)) {
        const n = Number(key);
        // Production keys are in [1, DB_VERSION - 1]; everything else is test-only.
        if (n < 1 || n >= DB_VERSION) delete MIGRATIONS[n];
    }
});

// ---------------------------------------------------------------------------
// migratePayload — pipeline behaviour
// ---------------------------------------------------------------------------

describe('migratePayload', () => {
    it('returns the same reference when payload is already at targetVersion', () => {
        const payload = makePayload(DB_VERSION);
        const result = migratePayload(payload, DB_VERSION);
        expect(result).toBe(payload);
    });

    it('returns the same reference when payload version equals targetVersion regardless of value', () => {
        // Synthetic: version 5, target 5
        const payload = makePayload(5);
        const result = migratePayload(payload, 5);
        expect(result).toBe(payload);
    });

    it('applies a single registered migration step', () => {
        MIGRATIONS[0] = makeMigration(1, (p) => ({
            ...p,
            version: 1,
            transactions: p.transactions.map((t: any) => ({ ...t, _migratedFromV0: true })),
        }));

        const payload = makePayload(0, { transactions: [{ id: 'tx1' }] });
        const result = migratePayload(payload, 1);

        expect(result.version).toBe(1);
        expect(result.transactions[0]._migratedFromV0).toBe(true);
    });

    it('applies multiple migration steps in sequence', () => {
        // Synthetic chain: -1 → 0 → 1 (DB_VERSION)
        MIGRATIONS[-1] = makeMigration(0, (p) => ({
            ...p,
            version: 0,
            transactions: p.transactions.map((t: any) => ({ ...t, _step1: true })),
        }));
        MIGRATIONS[0] = makeMigration(1, (p) => ({
            ...p,
            version: 1,
            transactions: p.transactions.map((t: any) => ({ ...t, _step2: true })),
        }));

        const payload = makePayload(-1, { transactions: [{ id: 'tx1' }] });
        const result = migratePayload(payload, 1);

        expect(result.version).toBe(1);
        expect(result.transactions[0]._step1).toBe(true);
        expect(result.transactions[0]._step2).toBe(true);
    });

    it('throws when no migration is registered for the current version', () => {
        // version 0 has no entry in MIGRATIONS
        const payload = makePayload(0);
        expect(() => migratePayload(payload, 1))
            .toThrow('No migration defined for v0 → v1');
    });

    it('throws when the migration chain has a gap', () => {
        // Register -2 → -1 but nothing for -1 → 0, leaving a gap
        MIGRATIONS[-2] = makeMigration(-1, (p) => ({ ...p, version: -1 }));

        const payload = makePayload(-2);
        expect(() => migratePayload(payload, 1))
            .toThrow('No migration defined for v-1 → v0');
    });

    it('increments version correctly through each step', () => {
        MIGRATIONS[-2] = makeMigration(-1, (p) => ({ ...p, version: -1 }));
        MIGRATIONS[-1] = makeMigration(0, (p) => ({ ...p, version: 0 }));
        MIGRATIONS[0]  = makeMigration(1, (p) => ({ ...p, version: 1 }));

        const payload = makePayload(-2);
        const result = migratePayload(payload, 1);
        expect(result.version).toBe(1);
    });

    it('does not mutate the original payload', () => {
        MIGRATIONS[0] = makeMigration(1, (p) => ({ ...p, version: 1, _new: true }));

        const original = makePayload(0);
        const snapshot = JSON.stringify(original);
        migratePayload(original, 1);
        expect(JSON.stringify(original)).toBe(snapshot);
    });
});

// ---------------------------------------------------------------------------
// MIGRATIONS registry — structural contracts
// ---------------------------------------------------------------------------

describe('MIGRATIONS registry', () => {
    it('each registered entry has the required shape', () => {
        for (const [key, migration] of Object.entries(MIGRATIONS)) {
            expect(typeof key).toBe('string');
            expect(typeof migration.description).toBe('string');
            expect(migration.description.length).toBeGreaterThan(0);
            expect(typeof migration.upgradePayload).toBe('function');
            expect(typeof migration.upgradeIdb).toBe('function');
        }
    });

    it('each entry increments version by exactly 1', () => {
        for (const [key, migration] of Object.entries(MIGRATIONS)) {
            const fromVersion = Number(key);
            const result = migration.upgradePayload({ version: fromVersion });
            expect(result.version).toBe(fromVersion + 1);
        }
    });

    it('entries form a contiguous chain from 1 to DB_VERSION - 1', () => {
        // Every version from 1 to DB_VERSION - 1 must have a migration registered.
        for (let v = 1; v < DB_VERSION; v++) {
            expect(MIGRATIONS[v]).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// upgradeIdb — callable contract
// ---------------------------------------------------------------------------

describe('upgradeIdb contract', () => {
    it('each registered upgradeIdb is callable and returns a Promise or undefined', async () => {
        for (const migration of Object.values(MIGRATIONS)) {
            // Pass a minimal fake tx; real Dexie tx is only available during upgrade.
            // This test verifies the function signature, not the IDB effect.
            const fakeTx = {
                table: () => ({ toCollection: () => ({ modify: async () => {} }) }),
            };
            const result = migration.upgradeIdb(fakeTx);
            if (result !== undefined) {
                await expect(Promise.resolve(result)).resolves.not.toThrow();
            }
        }
    });
});
