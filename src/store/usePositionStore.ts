import { create } from 'zustand';
import { db } from '@/lib/db';
import type { Position, PositionEntry } from '@/lib/types';

interface PositionState {
    createPosition: (pos: Omit<Position, 'id' | 'status' | 'entries'>) => Promise<string>;
    updatePosition: (id: string, updates: Partial<Position>) => Promise<number>;
    deletePosition: (id: string) => Promise<void>;
    addTransactionToPosition: (positionId: string, entry: PositionEntry) => Promise<void>;
    removeTransactionFromPosition: (positionId: string, transactionId: string) => Promise<void>;
    closePosition: (id: string) => Promise<number>;
    openPosition: (id: string) => Promise<number>;
}

export const usePositionStore = create<PositionState>(() => ({
    createPosition: async (pos) => {
        const id = crypto.randomUUID();
        await db.positions.add({
            ...pos,
            id,
            status: 'OPEN',
            entries: [],
        });
        return id;
    },

    updatePosition: async (id, updates) => {
        return db.positions.update(id, updates);
    },

    deletePosition: async (id) => {
        // When deleting a position, cleanup the associatedPositionIds in attached transactions
        await db.transaction('rw', db.positions, db.transactions, async () => {
            const position = await db.positions.get(id);
            if (position) {
                for (const entry of position.entries) {
                    const tx = await db.transactions.get(entry.transactionId);
                    if (tx) {
                        await db.transactions.update(tx.id, {
                            associatedPositionIds: tx.associatedPositionIds.filter(pid => pid !== id)
                        });
                    }
                }
            }
            await db.positions.delete(id);
        });
    },

    addTransactionToPosition: async (positionId: string, entry: PositionEntry) => {
        await db.transaction('rw', db.positions, db.transactions, async () => {
            const pos = await db.positions.get(positionId);
            const tx = await db.transactions.get(entry.transactionId);
            if (pos && tx) {
                // Check if entry already exists, update amount if it does
                const existingEntryIndex = pos.entries.findIndex(e => e.transactionId === entry.transactionId);
                const newEntries = [...pos.entries];
                if (existingEntryIndex >= 0) {
                    newEntries[existingEntryIndex] = entry;
                } else {
                    newEntries.push(entry);
                }

                await db.positions.update(positionId, { entries: newEntries });

                if (!tx.associatedPositionIds.includes(positionId)) {
                    await db.transactions.update(tx.id, {
                        associatedPositionIds: [...tx.associatedPositionIds, positionId]
                    });
                }
            }
        });
    },

    removeTransactionFromPosition: async (positionId: string, transactionId: string) => {
        await db.transaction('rw', db.positions, db.transactions, async () => {
            const pos = await db.positions.get(positionId);
            const tx = await db.transactions.get(transactionId);

            if (pos) {
                await db.positions.update(positionId, {
                    entries: pos.entries.filter(e => e.transactionId !== transactionId)
                });
            }

            if (tx) {
                await db.transactions.update(transactionId, {
                    associatedPositionIds: tx.associatedPositionIds.filter(pid => pid !== positionId)
                });
            }
        });
    },

    closePosition: async (id) => {
        return db.positions.update(id, { status: 'CLOSED' });
    },

    openPosition: async (id) => {
        return db.positions.update(id, { status: 'OPEN' });
    }
}));
