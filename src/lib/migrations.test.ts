/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach } from 'vitest';
import { MIGRATIONS, migratePayload, type Migration } from './migrations';
import { DB_VERSION } from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal payload at the given version. */
function makePayload(version: number, extra: Record<string, any> = {}): any {
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
            transactions: (p.transactions as Array<Record<string, unknown>>).map((t) => ({ ...t, _migratedFromV0: true })),
        }));

        const payload = makePayload(0, { transactions: [{ id: 'tx1' }] });
        const result = migratePayload(payload, 1) as any;

        expect(result.version).toBe(1);
        expect(result.transactions[0]._migratedFromV0).toBe(true);
    });

    it('applies multiple migration steps in sequence', () => {
        // Synthetic chain: -1 → 0 → 1 (DB_VERSION)
        MIGRATIONS[-1] = makeMigration(0, (p) => ({
            ...p,
            version: 0,
            transactions: (p.transactions as Array<Record<string, unknown>>).map((t) => ({ ...t, _step1: true })),
        }));
        MIGRATIONS[0] = makeMigration(1, (p) => ({
            ...p,
            version: 1,
            transactions: p.transactions.map((t: any) => ({ ...t, _step2: true })),
        }));

        const payload = makePayload(-1, { transactions: [{ id: 'tx1' }] });
        const result = migratePayload(payload, 1) as any;

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
        const result = migratePayload(payload, 1) as any;
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
            // Use makePayload so real migrations have the arrays they expect
            const result = migration.upgradePayload(makePayload(fromVersion)) as any;
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

// ---------------------------------------------------------------------------
// v3 → v4: pairConfigs.dataSource → dataProvider
// ---------------------------------------------------------------------------

describe('MIGRATIONS[3] v3 → v4', () => {
    it('renames dataSource to dataProvider in settings.pairConfigs', () => {
        const payload = makePayload(3, {
            settings: {
                pairConfigs: [
                    { pair: 'BTC/USDT', exchange: 'Binance', dataSource: 'Binance', currency: 'USD' },
                    { pair: 'ETH/USDT', exchange: 'OKX',     dataSource: 'OKX',     currency: 'USD' },
                ],
            },
        });
        const result = MIGRATIONS[3].upgradePayload(payload) as any;
        expect(result.version).toBe(4);
        expect(result.settings.pairConfigs[0]).toEqual({ pair: 'BTC/USDT', exchange: 'Binance', dataProvider: 'Binance', currency: 'USD' });
        expect(result.settings.pairConfigs[1]).toEqual({ pair: 'ETH/USDT', exchange: 'OKX',     dataProvider: 'OKX',     currency: 'USD' });
        expect(result.settings.pairConfigs[0].dataSource).toBeUndefined();
    });

    it('maps stock exchange dataSource values to Yahoo Finance', () => {
        const payload = makePayload(3, {
            settings: {
                pairConfigs: [
                    { pair: 'AAPL',   exchange: 'NYSE',   dataSource: 'NYSE',   currency: 'USD' },
                    { pair: 'TSLA',   exchange: 'NASDAQ', dataSource: 'NASDAQ', currency: 'USD' },
                    { pair: '600036', exchange: 'SSE',    dataSource: 'SSE',    currency: 'CNY' },
                    { pair: '000001', exchange: 'SZSE',   dataSource: 'SZSE',   currency: 'CNY' },
                ],
            },
        });
        const result = MIGRATIONS[3].upgradePayload(payload) as any;
        for (const config of result.settings.pairConfigs) {
            expect(config.dataProvider).toBe('Yahoo Finance');
        }
    });

    it('preserves other settings fields unchanged', () => {
        const payload = makePayload(3, {
            settings: { predefinedPairs: ['BTC/USDT'], dashboardTimeRange: '1Y', theme: 'dark' },
        });
        const result = MIGRATIONS[3].upgradePayload(payload) as any;
        expect(result.settings.predefinedPairs).toEqual(['BTC/USDT']);
        expect(result.settings.dashboardTimeRange).toBe('1Y');
        expect(result.settings.theme).toBe('dark');
    });

    it('handles missing pairConfigs gracefully (no settings.pairConfigs key)', () => {
        const payload = makePayload(3, { settings: { predefinedPairs: [] } });
        const result = MIGRATIONS[3].upgradePayload(payload) as any;
        expect(result.version).toBe(4);
        expect(result.settings.pairConfigs).toBeUndefined();
    });

    it('upgradeLocalStorage: renames dataSource → dataProvider and maps stock exchanges', () => {
        const state = {
            predefinedPairs: ['BTC/USDT', 'AAPL', '600036'],
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance', dataSource: 'Binance', currency: 'USD' },
                { pair: 'AAPL',     exchange: 'NYSE',    dataSource: 'NYSE',    currency: 'USD' },
                { pair: '600036',   exchange: 'SSE',     dataSource: 'SSE',     currency: 'CNY' },
            ],
        };
        const result = MIGRATIONS[3].upgradeLocalStorage!(state) as any;
        expect(result.pairConfigs[0]).toEqual({ pair: 'BTC/USDT', exchange: 'Binance', dataProvider: 'Binance', currency: 'USD' });
        expect(result.pairConfigs[1]).toEqual({ pair: 'AAPL',     exchange: 'NYSE',    dataProvider: 'Yahoo Finance', currency: 'USD' });
        expect(result.pairConfigs[2]).toEqual({ pair: '600036',   exchange: 'SSE',     dataProvider: 'Yahoo Finance', currency: 'CNY' });
        // dataSource must be removed
        expect(result.pairConfigs[0].dataSource).toBeUndefined();
    });

    it('upgradeLocalStorage: returns state unchanged when pairConfigs is absent', () => {
        const state = { predefinedPairs: ['BTC/USDT'] };
        const result = MIGRATIONS[3].upgradeLocalStorage!(state) as any;
        expect(result).toEqual(state);
    });
});

// ---------------------------------------------------------------------------
// v4 → v5: add market field to pairConfigs
// ---------------------------------------------------------------------------

describe('MIGRATIONS[4] v4 → v5', () => {
    it('adds market field inferred from exchange', () => {
        const payload = makePayload(4, {
            settings: {
                pairConfigs: [
                    { pair: 'BTC/USDT', exchange: 'Binance', dataProvider: 'Binance', currency: 'USD' },
                    { pair: 'AAPL',     exchange: 'NYSE',    dataProvider: 'Yahoo Finance', currency: 'USD' },
                    { pair: '600036',   exchange: 'SSE',     dataProvider: 'Yahoo Finance', currency: 'CNY' },
                ],
            },
        });
        const result = MIGRATIONS[4].upgradePayload(payload) as any;
        expect(result.version).toBe(5);
        expect(result.settings.pairConfigs[0].market).toBe('Crypto');
        expect(result.settings.pairConfigs[1].market).toBe('US Stocks');
        expect(result.settings.pairConfigs[2].market).toBe('CN Stocks');
    });

    it('handles missing pairConfigs gracefully', () => {
        const payload = makePayload(4, { settings: { predefinedPairs: [] } });
        const result = MIGRATIONS[4].upgradePayload(payload) as any;
        expect(result.version).toBe(5);
        expect(result.settings.pairConfigs).toBeUndefined();
    });

    it('upgradeLocalStorage: backfills market from exchange', () => {
        const state = {
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance', dataProvider: 'Binance', currency: 'USD' },
                { pair: 'AAPL',     exchange: 'NASDAQ',  dataProvider: 'Yahoo Finance', currency: 'USD' },
                { pair: '000001',   exchange: 'SZSE',    dataProvider: 'Yahoo Finance', currency: 'CNY' },
            ],
        };
        const result = MIGRATIONS[4].upgradeLocalStorage!(state) as any;
        expect(result.pairConfigs[0].market).toBe('Crypto');
        expect(result.pairConfigs[1].market).toBe('US Stocks');
        expect(result.pairConfigs[2].market).toBe('CN Stocks');
    });

    it('upgradeLocalStorage: preserves existing market field', () => {
        const state = {
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance', dataProvider: 'Binance', currency: 'USD', market: 'Crypto' },
            ],
        };
        const result = MIGRATIONS[4].upgradeLocalStorage!(state) as any;
        expect(result.pairConfigs[0].market).toBe('Crypto');
    });

    it('upgradeLocalStorage: returns state unchanged when pairConfigs is absent', () => {
        const state = { predefinedPairs: ['BTC/USDT'] };
        const result = MIGRATIONS[4].upgradeLocalStorage!(state) as any;
        expect(result).toEqual(state);
    });
});

describe('upgradeIdb contract', () => {
    it('each registered upgradeIdb is callable and returns a Promise or undefined', async () => {
        for (const migration of Object.values(MIGRATIONS)) {
            // Pass a minimal fake tx; real Dexie tx is only available during upgrade.
            // This test verifies the function signature, not the IDB effect.
            const fakeTx = {
                table: () => ({ toCollection: () => ({ modify: async () => {} }) }),
            } as any;
            const result = migration.upgradeIdb(fakeTx);
            if (result !== undefined) {
                await expect(Promise.resolve(result)).resolves.not.toThrow();
            }
        }
    });
});
