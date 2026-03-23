import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Position } from './types';

/** Database name — single source of truth used for native IDB probing. */
export const DB_NAME = 'CryptoFolioDB';

/** Current schema version. Increment this when the DB schema changes. */
export const DB_VERSION = 1;

// Extend Dexie to declare DB structure
const db = new Dexie(DB_NAME) as Dexie & {
    transactions: EntityTable<Transaction, 'id'>,
    positions: EntityTable<Position, 'id'>
};

export type { Transaction, Position }

// v1 — initial schema. Never modify existing version blocks.
db.version(1).stores({
    transactions: 'id, date, symbol, type',
    positions: 'id, symbol, status'
});

// HOW TO ADD A FUTURE SCHEMA MIGRATION:
// 1. Increment DB_VERSION above.
// 2. Add a new db.version(N) block below — Dexie runs .upgrade() automatically for existing users.
// 3. Add a corresponding entry in BACKUP_MIGRATIONS in backup.ts.
//
// Example (do NOT add now):
// db.version(2)
//   .stores({ transactions: 'id, date, symbol, type, exchange' })
//   .upgrade(tx => tx.table('transactions').toCollection().modify(t => { t.exchange ??= null }));

// When another tab opens the DB at a higher version, close our connection so the
// upgrade can proceed without being blocked. The user will need to refresh.
db.on('versionchange', () => {
    db.close();
    console.warn('[CryptoFolio] Database upgraded by another tab. Please refresh the page.');
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
