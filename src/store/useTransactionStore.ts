import { create } from 'zustand';
import { db } from '@/lib/db';
import type { Transaction } from '@/lib/types';

interface TransactionState {
    addTransaction: (tx: Omit<Transaction, 'id' | 'associatedPositionIds'>) => Promise<string>;
    bulkAddTransactions: (txs: Omit<Transaction, 'associatedPositionIds'> & { id?: string }[]) => Promise<string[]>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<number>;
    deleteTransaction: (id: string) => Promise<void>;
    bulkDeleteTransactions: (ids: string[]) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>(() => ({
    addTransaction: async (tx) => {
        const id = crypto.randomUUID();
        await db.transactions.add({
            ...tx,
            id,
            associatedPositionIds: [],
        });
        return id;
    },
    bulkAddTransactions: async (txs) => {
        const fullTxs = txs.map(tx => ({
            ...tx,
            id: tx.id || crypto.randomUUID(),
            associatedPositionIds: [],
        }));

        const incomingIds = fullTxs.map(t => t.id);
        const existingTxs = await db.transactions.where('id').anyOf(incomingIds).toArray();
        const existingIds = new Set(existingTxs.map(t => t.id));

        const newTxs = fullTxs.filter(t => !existingIds.has(t.id));

        if (newTxs.length > 0) {
            await db.transactions.bulkAdd(newTxs as any);
        }
        return newTxs.map(tx => tx.id);
    },
    updateTransaction: async (id, updates) => {
        return db.transactions.update(id, updates);
    },
    deleteTransaction: async (id) => {
        // When deleting a transaction, we should also remove it from any associated positions' entries
        await db.transaction('rw', db.positions, db.transactions, async () => {
            const tx = await db.transactions.get(id);
            if (tx && tx.associatedPositionIds.length > 0) {
                for (const posId of tx.associatedPositionIds) {
                    const pos = await db.positions.get(posId);
                    if (pos) {
                        await db.positions.update(posId, {
                            entries: pos.entries.filter(e => e.transactionId !== id)
                        });
                    }
                }
            }
            await db.transactions.delete(id);
        });
    },
    bulkDeleteTransactions: async (ids) => {
        await db.transaction('rw', db.positions, db.transactions, async () => {
            for (const id of ids) {
                const tx = await db.transactions.get(id);
                if (tx && tx.associatedPositionIds.length > 0) {
                    for (const posId of tx.associatedPositionIds) {
                        const pos = await db.positions.get(posId);
                        if (pos) {
                            await db.positions.update(posId, {
                                entries: pos.entries.filter(e => e.transactionId !== id)
                            });
                        }
                    }
                }
                await db.transactions.delete(id);
            }
        });
    }
}));
