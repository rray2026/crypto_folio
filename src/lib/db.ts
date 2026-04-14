import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Position, Fund, Strategy } from './types';
import { MIGRATIONS } from './migrations';

/** Database name — single source of truth used for native IDB probing. */
export const DB_NAME = 'CryptoFolioDB';

/** Current schema version. Increment this when the DB schema changes. */
export const DB_VERSION = 7;

// Extend Dexie to declare DB structure
const db = new Dexie(DB_NAME) as Dexie & {
    transactions: EntityTable<Transaction, 'id'>,
    positions: EntityTable<Position, 'id'>,
    funds: EntityTable<Fund, 'id'>,
    strategies: EntityTable<Strategy, 'id'>,
};

export type { Transaction, Position, Fund, Strategy }

// v1 — initial schema. Never modify existing version blocks.
db.version(1).stores({
    transactions: 'id, date, symbol, type',
    positions: 'id, symbol, status'
});

// v2 — no index changes; backfills Position.type and Transaction.orderId for
//      records that pre-date those fields being consistently populated.
db.version(2)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status'
    })
    .upgrade(MIGRATIONS[1].upgradeIdb);

// v3 — add funds table; add fundId index to positions.
db.version(3)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[2].upgradeIdb);

// v4 — rename pairConfigs.dataSource → dataProvider in backup settings (localStorage only).
//      IndexedDB stores and indices are unchanged from v3.
db.version(4)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[3].upgradeIdb);

// v5 — add market field to pairConfigs in localStorage.
//      IndexedDB stores and indices are unchanged from v4.
db.version(5)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[4].upgradeIdb);

// v6 — remove Position.type field (PRIMARY/SHADOW distinction dropped).
//      IndexedDB stores and indices are unchanged from v5.
db.version(6)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId',
        funds: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[5].upgradeIdb);

// v7 — add strategies table; add strategyId index to positions.
db.version(7)
    .stores({
        transactions: 'id, date, symbol, type',
        positions: 'id, symbol, status, fundId, strategyId',
        funds: 'id, status, createdAt',
        strategies: 'id, status, createdAt',
    })
    .upgrade(MIGRATIONS[6].upgradeIdb);

// HOW TO ADD A FUTURE SCHEMA MIGRATION:
// 1. Increment DB_VERSION above.
// 2. Add new schema snapshot types + a MIGRATIONS[N] entry in migrations.ts.
// 3. Add a new db.version(N+1) block below, wiring the Dexie upgrade to MIGRATIONS[N].upgradeIdb.

// When another tab opens the DB at a higher version, close our connection so the
// upgrade can proceed without being blocked. The user will need to refresh.
db.on('versionchange', () => {
    db.close();
    console.warn('[Folio] Database upgraded by another tab. Please refresh the page.');
});

export { db };

// ---------------------------------------------------------------------------
// Startup compatibility check
// ---------------------------------------------------------------------------

export type DbCompatibility = 'ok' | 'needs-upgrade' | 'incompatible';

/**
 * Pure comparison — no I/O.
 * Exported separately so it can be unit-tested without touching IndexedDB.
 *
 * @param actual  Version currently stored in IndexedDB (0 = DB does not exist yet).
 */
export function getDbCompatibilityStatus(actual: number): DbCompatibility {
    if (actual === 0 || actual === DB_VERSION) return 'ok';
    if (actual < DB_VERSION) return 'needs-upgrade'; // Dexie will auto-upgrade on open
    return 'incompatible'; // stored version is ahead of the code — app is too old
}

/**
 * Reads the version stored in IndexedDB via the native IDBFactory API,
 * without triggering Dexie's own open/upgrade logic.
 *
 * Returns 0 when the database does not exist yet.
 */
export function getActualDbVersion(): Promise<number> {
    return new Promise((resolve) => {
        // Open without specifying a version: returns current version if DB exists,
        // or fires onupgradeneeded (version 1) if it does not.
        const req = indexedDB.open(DB_NAME);

        req.onsuccess = () => {
            const version = req.result.version;
            req.result.close();
            resolve(version);
        };

        req.onerror = () => resolve(0);

        // DB doesn't exist yet — let onsuccess report the new version (1).
        req.onupgradeneeded = () => { /* onsuccess fires next */ };
    });
}

/**
 * Returns the compatibility status of the IndexedDB data relative to the
 * current codebase version.
 *
 * Call this once at app startup and act on the result:
 *  - 'ok'           → normal startup, no action needed
 *  - 'needs-upgrade' → Dexie will run upgrade handlers automatically on first access
 *  - 'incompatible'  → the stored data is from a newer app version; prompt the user
 *                       to update the app or clear their data
 */
export async function checkDbCompatibility(): Promise<DbCompatibility> {
    const actual = await getActualDbVersion();
    return getDbCompatibilityStatus(actual);
}
