import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { useTransactionStore } from './useTransactionStore';
import { usePositionStore } from './usePositionStore';

describe('useTransactionStore', () => {

    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
    });

    it('adds a transaction to the database', async () => {
        const { addTransaction } = useTransactionStore.getState();
        const txId = await addTransaction({
            date: Date.now(),
            symbol: 'BTC/USDT',
            type: 'BUY',
            price: 60000,
            quantity: 1,
            amount: 60000,
            fee: 10
        });

        const tx = await db.transactions.get(txId);
        expect(tx).toBeDefined();
        expect(tx?.symbol).toBe('BTC/USDT');
    });

    it('updates an existing transaction', async () => {
        const { addTransaction, updateTransaction } = useTransactionStore.getState();
        const txId = await addTransaction({
            date: Date.now(),
            symbol: 'BTC/USDT',
            type: 'BUY',
            price: 60000,
            quantity: 1,
            amount: 60000,
            fee: 10
        });

        await updateTransaction(txId, { price: 61000, amount: 61000 });

        const tx = await db.transactions.get(txId);
        expect(tx?.price).toBe(61000);
    });

    it('bulk adds transactions', async () => {
        const { bulkAddTransactions } = useTransactionStore.getState();
        const txs = [
            { date: Date.now(), symbol: 'BTC/USDT', type: 'BUY', price: 60000, quantity: 1, amount: 60000, fee: 10 },
            { date: Date.now(), symbol: 'ETH/USDT', type: 'BUY', price: 3000, quantity: 1, amount: 3000, fee: 5 },
        ];

        const ids = await bulkAddTransactions(txs as any);
        expect(ids).toHaveLength(2);

        const count = await db.transactions.count();
        expect(count).toBe(2);
    });

    it('deletes a transaction and cleans up related positions', async () => {
        const { addTransaction, deleteTransaction } = useTransactionStore.getState();
        const { createPosition, addTransactionToPosition } = usePositionStore.getState();

        // 1. Setup TX and Position
        const txId = await addTransaction({ date: Date.now(), symbol: 'BTC/USDT', type: 'BUY', price: 60000, quantity: 1, amount: 60000, fee: 10 });
        const posId = await createPosition({ symbol: 'BTC/USDT', strategyName: 'Test', type: 'PRIMARY', startDate: Date.now() });
        
        // 2. Link them
        await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 1 });

        // Verify initial link
        const posBefore = await db.positions.get(posId);
        expect(posBefore?.entries).toHaveLength(1);

        // 3. Delete Transaction
        await deleteTransaction(txId);

        // 4. Verify cleanup
        const txAfter = await db.transactions.get(txId);
        expect(txAfter).toBeUndefined();

        const posAfter = await db.positions.get(posId);
        expect(posAfter?.entries).toHaveLength(0);
    });

    it('bulk deletes transactions and cleans up related positions', async () => {
        const { addTransaction, bulkDeleteTransactions } = useTransactionStore.getState();
        const { createPosition, addTransactionToPosition } = usePositionStore.getState();

        const txId1 = await addTransaction({ date: Date.now(), symbol: 'BTC/USDT', type: 'BUY', price: 60000, quantity: 1, amount: 60000, fee: 0 });
        const txId2 = await addTransaction({ date: Date.now(), symbol: 'BTC/USDT', type: 'BUY', price: 61000, quantity: 1, amount: 61000, fee: 0 });
        const posId = await createPosition({ symbol: 'BTC/USDT', type: 'PRIMARY', startDate: Date.now() });

        await addTransactionToPosition(posId, { transactionId: txId1, allocatedAmount: 1 });
        await addTransactionToPosition(posId, { transactionId: txId2, allocatedAmount: 1 });

        await bulkDeleteTransactions([txId1, txId2]);

        const pos = await db.positions.get(posId);
        expect(pos?.entries).toHaveLength(0);
    });
});
