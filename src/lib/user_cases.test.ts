import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { useTransactionStore } from '../store/useTransactionStore';
import { usePositionStore } from '../store/usePositionStore';
import { add, sub, mul, getAveragePrice } from './math';

// Polyfill crypto for node environment testing
import 'fake-indexeddb/auto';

describe('User Cases Integration Tests', () => {

    // Clean the database before every test to ensure isolation
    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
    });

    describe('UC1: Record Transaction & UC2: Manage Trade Position', () => {
        it('Creates a transaction and allows it to be linked to a new position', async () => {
            const { addTransaction } = useTransactionStore.getState();
            const { createPosition, addTransactionToPosition } = usePositionStore.getState();

            const txId = await addTransaction({
                date: Date.now(),
                symbol: 'BTC/USDT',
                type: 'BUY',
                price: 90000,
                quantity: 1,
                amount: 90000,
                fee: 0
            });

            const posId = await createPosition({
                symbol: 'BTC/USDT',
                strategyName: 'Long Term Hold',
                type: 'PRIMARY',
                startDate: Date.now()
            });

            // User links 0.5 BTC of the transaction to this position
            await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 0.5 });

            const txInDb = await db.transactions.get(txId);
            const posInDb = await db.positions.get(posId);

            // Verify the linking updated both the Position and the Transaction records
            expect(txInDb?.associatedPositionIds).toContain(posId);
            expect(posInDb?.entries).toHaveLength(1);
            expect(posInDb?.entries[0].allocatedAmount).toEqual(0.5);
        });
    });

    describe('UC3: Calculate Position PnL & Metrics', () => {
        it('Correctly calculates realized PnL from partial linked trades', async () => {
            const { addTransaction } = useTransactionStore.getState();
            const { createPosition, addTransactionToPosition } = usePositionStore.getState();

            // Setup trades
            const buyTxPath1 = await addTransaction({ date: Date.now(), symbol: 'SOL/USDT', type: 'BUY', price: 100, quantity: 10, amount: 1000, fee: 0 });
            const buyTxPath2 = await addTransaction({ date: Date.now(), symbol: 'SOL/USDT', type: 'BUY', price: 150, quantity: 10, amount: 1500, fee: 0 });
            const sellTxPath = await addTransaction({ date: Date.now(), symbol: 'SOL/USDT', type: 'SELL', price: 200, quantity: 15, amount: 3000, fee: 0 });

            // Create Position
            const posId = await createPosition({ symbol: 'SOL/USDT', strategyName: 'SOL Swing Trade', type: 'PRIMARY', startDate: Date.now() });

            // Link trades (allocating only partial amounts)
            await addTransactionToPosition(posId, { transactionId: buyTxPath1, allocatedAmount: 5 }); // 5 * 100 = $500 cost
            await addTransactionToPosition(posId, { transactionId: buyTxPath2, allocatedAmount: 5 }); // 5 * 150 = $750 cost
            await addTransactionToPosition(posId, { transactionId: sellTxPath, allocatedAmount: 8 }); // 8 * 200 = $1600 revenue

            // Simulate Component logic connecting to the DB
            const position = await db.positions.get(posId);
            const allTxIds = position?.entries.map(e => e.transactionId) || [];
            const linkedTxs = await db.transactions.where('id').anyOf(allTxIds).toArray();

            let totalBought = 0; let totalSold = 0;
            let totalCost = 0; let totalRevenue = 0;

            linkedTxs.forEach(tx => {
                const allocated = position?.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0;
                if (tx.type === 'BUY') {
                    totalBought = add(totalBought, allocated);
                    totalCost = add(totalCost, mul(allocated, tx.price));
                } else {
                    totalSold = add(totalSold, allocated);
                    totalRevenue = add(totalRevenue, mul(allocated, tx.price));
                }
            });

            const avgBuyPrice = getAveragePrice(totalCost, totalBought); // (500 + 750) / 10 = $125
            const avgSellPrice = getAveragePrice(totalRevenue, totalSold); // 1600 / 8 = $200

            const realizedPnL = mul(sub(avgSellPrice, avgBuyPrice), totalSold); // (200 - 125) * 8 = 75 * 8 = 600

            expect(totalBought).toBe(10);
            expect(totalSold).toBe(8);
            expect(avgBuyPrice).toBe(125);
            expect(avgSellPrice).toBe(200);
            expect(realizedPnL).toBe(600);
        });
    });

    describe('UC2: Deleting associations', () => {
        it('Removes position ID from transaction when the position is deleted', async () => {
            const { addTransaction } = useTransactionStore.getState();
            const { createPosition, addTransactionToPosition, deletePosition } = usePositionStore.getState();

            const txId = await addTransaction({
                date: Date.now(), symbol: 'ETH/USDT', type: 'BUY', price: 3000, quantity: 1, amount: 3000, fee: 0
            });
            const posId = await createPosition({ symbol: 'ETH/USDT', strategyName: 'Short Term', type: 'PRIMARY', startDate: Date.now() });

            await addTransactionToPosition(posId, { transactionId: txId, allocatedAmount: 1 });

            let txInDb = await db.transactions.get(txId);
            expect(txInDb?.associatedPositionIds).toContain(posId);

            // Delete position
            await deletePosition(posId);

            // Verify transaction no longer contains this position ID
            txInDb = await db.transactions.get(txId);
            expect(txInDb?.associatedPositionIds).not.toContain(posId);
        });
    });

});
