import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { usePositionStore } from './usePositionStore';
import { useTransactionStore } from './useTransactionStore';

describe('usePositionStore', () => {

    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
    });

    it('creates an open position', async () => {
        const { createPosition } = usePositionStore.getState();
        const posId = await createPosition({
            symbol: 'SOL/USDT',
            strategyName: 'Solana Swing',
            type: 'PRIMARY',
            startDate: Date.now()
        });

        const pos = await db.positions.get(posId);
        expect(pos).toBeDefined();
        expect(pos?.status).toBe('OPEN');
        expect(pos?.entries).toHaveLength(0);
    });

    it('links a transaction to a position and updates both', async () => {
        const { createPosition, addTransactionToPosition } = usePositionStore.getState();
        const { addTransaction } = useTransactionStore.getState();

        const txId = await addTransaction({
            date: Date.now(),
            symbol: 'SOL/USDT',
            type: 'BUY',
            price: 150,
            quantity: 10,
            amount: 1500,
            fee: 0
        });

        const posId = await createPosition({ symbol: 'SOL/USDT', type: 'PRIMARY', startDate: Date.now() });

        await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 5 });

        // Verify Position entry
        const pos = await db.positions.get(posId);
        expect(pos?.entries).toHaveLength(1);
        expect(pos?.entries[0].allocatedAmount).toBe(5);

        // Verify Transaction association
        const tx = await db.transactions.get(txId);
        expect(tx?.associatedPositionIds).toContain(posId);
    });

    it('removes a transaction from a position and cleans up both', async () => {
        const { createPosition, addTransactionToPosition, removeTransactionFromPosition } = usePositionStore.getState();
        const { addTransaction } = useTransactionStore.getState();

        const txId = await addTransaction({ date: Date.now(), symbol: 'SOL/USDT', type: 'BUY', price: 150, quantity: 10, amount: 1500, fee: 0 });
        const posId = await createPosition({ symbol: 'SOL/USDT', type: 'PRIMARY', startDate: Date.now() });

        await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 10 });
        await removeTransactionFromPosition(posId, txId);

        const pos = await db.positions.get(posId);
        expect(pos?.entries).toHaveLength(0);

        const tx = await db.transactions.get(txId);
        expect(tx?.associatedPositionIds).not.toContain(posId);
    });

    it('cleans up transactions when a position is deleted', async () => {
        const { createPosition, addTransactionToPosition, deletePosition } = usePositionStore.getState();
        const { addTransaction } = useTransactionStore.getState();

        const txId = await addTransaction({ date: Date.now(), symbol: 'SOL/USDT', type: 'BUY', price: 150, quantity: 10, amount: 1500, fee: 0 });
        const posId = await createPosition({ symbol: 'SOL/USDT', type: 'PRIMARY', startDate: Date.now() });

        await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 10 });
        await deletePosition(posId);

        const tx = await db.transactions.get(txId);
        expect(tx?.associatedPositionIds).not.toContain(posId);
    });

    it('closes and opens a position', async () => {
        const { createPosition, closePosition, openPosition } = usePositionStore.getState();
        const posId = await createPosition({ symbol: 'SOL/USDT', type: 'PRIMARY', startDate: Date.now() });

        await closePosition(posId);
        let pos = await db.positions.get(posId);
        expect(pos?.status).toBe('CLOSED');
        expect(pos?.endDate).toBeDefined();

        await openPosition(posId);
        pos = await db.positions.get(posId);
        expect(pos?.status).toBe('OPEN');
        expect(pos?.endDate).toBeUndefined();
    });
});
