import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Position } from './types';

/** Current schema version. Increment this when the DB schema changes. */
export const DB_VERSION = 1;

// Extend Dexie to declare DB structure
const db = new Dexie('CryptoFolioDB') as Dexie & {
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

export { db };
