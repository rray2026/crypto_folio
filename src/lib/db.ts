import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Position } from './types';

// Extend Dexie to declare DB structure
const db = new Dexie('CryptoFolioDB') as Dexie & {
    transactions: EntityTable<Transaction, 'id'>,
    positions: EntityTable<Position, 'id'>
};

export type { Transaction, Position }

// Schema definition (indexes)
db.version(1).stores({
    transactions: 'id, date, symbol, type',
    positions: 'id, symbol, status'
});

export { db };
