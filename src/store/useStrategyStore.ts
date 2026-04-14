import { create } from 'zustand';
import { db } from '@/lib/db';
import type { Strategy } from '@/lib/types';

interface StrategyState {
    createStrategy: (data: Omit<Strategy, 'id' | 'createdAt'>) => Promise<string>;
    updateStrategy: (id: string, updates: Partial<Strategy>) => Promise<void>;
    deleteStrategy: (id: string) => Promise<void>;
    assignPositionToStrategy: (positionId: string, strategyId: string) => Promise<void>;
    unassignPositionFromStrategy: (positionId: string) => Promise<void>;
}

export const useStrategyStore = create<StrategyState>(() => ({
    createStrategy: async (data) => {
        const id = crypto.randomUUID();
        await db.strategies.add({ ...data, id, createdAt: Date.now() });
        return id;
    },

    updateStrategy: async (id, updates) => {
        await db.strategies.update(id, updates);
    },

    deleteStrategy: async (id) => {
        await db.transaction('rw', db.strategies, db.positions, async () => {
            await db.positions.where('strategyId').equals(id).modify({ strategyId: undefined });
            await db.strategies.delete(id);
        });
    },

    assignPositionToStrategy: async (positionId, strategyId) => {
        await db.positions.update(positionId, { strategyId });
    },

    unassignPositionFromStrategy: async (positionId) => {
        await db.positions.update(positionId, { strategyId: undefined });
    },
}));
