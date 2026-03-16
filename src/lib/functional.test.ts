import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { useTransactionStore } from '../store/useTransactionStore';
import { usePositionStore } from '../store/usePositionStore';
import { getPositionMetrics } from './metrics';

// Polyfill for indexedDB in node
import 'fake-indexeddb/auto';

/**
 * Functional tests for core use cases using existing stores and logic.
 * No source code modifications were required to run these tests.
 */
describe('Core Functional Use Cases', () => {

    beforeEach(async () => {
        await db.transactions.clear();
        await db.positions.clear();
    });

    describe('UC4: Trade Journaling', () => {
        it('persists journal entry reason and mood score', async () => {
            const { createPosition, updatePosition } = usePositionStore.getState();

            const posId = await createPosition({
                symbol: 'ETH/USDT',
                strategyName: 'Trend Follow',
                type: 'PRIMARY',
                startDate: Date.now()
            });

            const journal = {
                entryReason: 'RSI Divergence',
                moodScore: 5
            };

            await updatePosition(posId, { journal });

            const posInDb = await db.positions.get(posId);
            expect(posInDb?.journal).toEqual(expect.objectContaining(journal));
        });
    });

    describe('UC1.3: Multi-Position Allocation', () => {
        it('allows a single transaction to be allocated to multiple positions', async () => {
            const { addTransaction } = useTransactionStore.getState();
            const { createPosition, addTransactionToPosition } = usePositionStore.getState();

            // 1. Create a large buy transaction
            const txId = await addTransaction({
                date: Date.now(),
                symbol: 'SOL/USDT',
                type: 'BUY',
                price: 150,
                quantity: 100,
                amount: 15000,
                fee: 0
            });

            // 2. Create two positions
            const posId1 = await createPosition({ symbol: 'SOL/USDT', strategyName: 'Long TermSOL', type: 'PRIMARY', startDate: Date.now() });
            const posId2 = await createPosition({ symbol: 'SOL/USDT', strategyName: 'SwingSOL', type: 'SHADOW', startDate: Date.now() });

            // 3. Allocate partially to each
            await addTransactionToPosition(posId1, { transactionId: txId, allocatedAmount: 40 });
            await addTransactionToPosition(posId2, { transactionId: txId, allocatedAmount: 60 });

            // 4. Verify transaction linking
            const tx = await db.transactions.get(txId);
            expect(tx?.associatedPositionIds).toContain(posId1);
            expect(tx?.associatedPositionIds).toContain(posId2);

            // 5. Verify position metrics
            const p1 = await db.positions.get(posId1);
            const p2 = await db.positions.get(posId2);
            
            const prices = { 'SOL/USDT': { price: '200', timestamp: Date.now() } };
            const m1 = getPositionMetrics(p1!, [tx!], prices);
            const m2 = getPositionMetrics(p2!, [tx!], prices);

            expect(m1.totalInvestment).toBe(6000); // 40 * 150
            expect(m2.totalInvestment).toBe(9000); // 60 * 150
            
            expect(m1.unrealizedPnL).toBe(2000); // (200 - 150) * 40
            expect(m2.unrealizedPnL).toBe(3000); // (200 - 150) * 60
        });
    });

    describe('Position Status Lifecycle', () => {
        it('transitions from OPEN to CLOSED updating endDate', async () => {
            const { createPosition, closePosition } = usePositionStore.getState();
            const posId = await createPosition({ symbol: 'BTC/USDT', type: 'PRIMARY', startDate: Date.now() });
            
            const before = await db.positions.get(posId);
            expect(before?.status).toBe('OPEN');
            expect(before?.endDate).toBeUndefined();

            await closePosition(posId);

            const after = await db.positions.get(posId);
            expect(after?.status).toBe('CLOSED');
            expect(after?.endDate).toBeDefined();
        });
    });
});
