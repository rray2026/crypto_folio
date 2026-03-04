import { create } from 'zustand';
import { db } from '@/lib/db';
import type { Transaction } from '@/lib/types';

interface TransactionState {
    addTransaction: (tx: Omit<Transaction, 'id' | 'associatedPositionIds'>) => Promise<string>;
    updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<number>;
    deleteTransaction: (id: string) => Promise<void>;
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
    }
}));
