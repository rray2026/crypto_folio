import { create } from 'zustand';
import { db } from '@/lib/db';
import type { Fund } from '@/lib/types';

interface FundState {
    createFund: (data: Omit<Fund, 'id' | 'createdAt'>) => Promise<string>;
    updateFund: (id: string, updates: Partial<Fund>) => Promise<void>;
    deleteFund: (id: string) => Promise<void>;
    assignPositionToFund: (positionId: string, fundId: string) => Promise<void>;
    unassignPosition: (positionId: string) => Promise<void>;
}

export const useFundStore = create<FundState>(() => ({
    createFund: async (data) => {
        const id = crypto.randomUUID();
        await db.funds.add({ ...data, id, createdAt: Date.now() });
        return id;
    },

    updateFund: async (id, updates) => {
        await db.funds.update(id, updates);
    },

    deleteFund: async (id) => {
        await db.transaction('rw', db.funds, db.positions, async () => {
            // Clear fundId from all positions in this fund
            await db.positions.where('fundId').equals(id).modify({ fundId: undefined });
            await db.funds.delete(id);
        });
    },

    assignPositionToFund: async (positionId, fundId) => {
        await db.positions.update(positionId, { fundId });
    },

    unassignPosition: async (positionId) => {
        await db.positions.update(positionId, { fundId: undefined });
    },
}));
