import { describe, it, expect } from 'vitest';
import { getPositionMetrics } from './metrics';
import type { Position, Transaction } from './types';

describe('getPositionMetrics - Breakeven Price Logic', () => {
    const mockPrices = {
        'BTC/USDT': { price: '50000', timestamp: Date.now() }
    };

    it('calculates LONG breakeven correctly with single buy', () => {
        const pos: Position = {
            id: 'pos-1',
            symbol: 'BTC/USDT',
            type: 'PRIMARY',
            status: 'OPEN',
            entries: [{ transactionId: 'tx-1', allocatedAmount: 1 }],
            startDate: Date.now()
        };
        const txs: Transaction[] = [{
            id: 'tx-1',
            date: Date.now(),
            symbol: 'BTC/USDT',
            type: 'BUY',
            price: 50000,
            quantity: 1,
            amount: 50000,
            fee: 0,
            associatedPositionIds: ['pos-1']
        }];

        const metrics = getPositionMetrics(pos, txs, mockPrices);
        expect(metrics.avgBuyPrice).toBe(50000);
        expect(metrics.breakevenPrice).toBe(50000);
    });

    it('calculates LONG breakeven correctly after partial sell profit', () => {
        const pos: Position = {
            id: 'pos-1',
            symbol: 'BTC/USDT',
            type: 'PRIMARY',
            status: 'OPEN',
            entries: [
                { transactionId: 'tx-1', allocatedAmount: 1 },
                { transactionId: 'tx-2', allocatedAmount: 0.5 }
            ],
            startDate: Date.now()
        };
        const txs: Transaction[] = [
            {
                id: 'tx-1',
                date: 1000,
                symbol: 'BTC/USDT',
                type: 'BUY',
                price: 50000,
                quantity: 1,
                amount: 50000,
                fee: 0,
                associatedPositionIds: ['pos-1']
            },
            {
                id: 'tx-2',
                date: 2000,
                symbol: 'BTC/USDT',
                type: 'SELL',
                price: 80000,
                quantity: 0.5,
                amount: 40000,
                fee: 0,
                associatedPositionIds: ['pos-1']
            }
        ];

        const metrics = getPositionMetrics(pos, txs, mockPrices);
        // Total Cost: 50000
        // Total Revenue: 40000
        // Remaining: 0.5
        // Breakeven: (50000 - 40000) / 0.5 = 20000
        expect(metrics.totalRemaining).toBe(0.5);
        expect(metrics.breakevenPrice).toBe(20000);
    });

    it('calculates LONG breakeven correctly after partial sell loss', () => {
        const pos: Position = {
            id: 'pos-1',
            symbol: 'BTC/USDT',
            type: 'PRIMARY',
            status: 'OPEN',
            entries: [
                { transactionId: 'tx-1', allocatedAmount: 1 },
                { transactionId: 'tx-2', allocatedAmount: 0.5 }
            ],
            startDate: Date.now()
        };
        const txs: Transaction[] = [
            {
                id: 'tx-1',
                date: 1000,
                symbol: 'BTC/USDT',
                type: 'BUY',
                price: 50000,
                quantity: 1,
                amount: 50000,
                fee: 0,
                associatedPositionIds: ['pos-1']
            },
            {
                id: 'tx-2',
                date: 2000,
                symbol: 'BTC/USDT',
                type: 'SELL',
                price: 40000,
                quantity: 0.5,
                amount: 20000,
                fee: 0,
                associatedPositionIds: ['pos-1']
            }
        ];

        const metrics = getPositionMetrics(pos, txs, mockPrices);
        // Total Cost: 50000
        // Total Revenue: 20000
        // Remaining: 0.5
        // Breakeven: (50000 - 20000) / 0.5 = 60000
        expect(metrics.totalRemaining).toBe(0.5);
        expect(metrics.breakevenPrice).toBe(60000);
    });

    it('calculates SHORT breakeven correctly', () => {
        const pos: Position = {
            id: 'pos-2',
            symbol: 'ETH/USDT',
            type: 'PRIMARY',
            status: 'OPEN',
            entries: [
                { transactionId: 'tx-s1', allocatedAmount: 1 },
                { transactionId: 'tx-b1', allocatedAmount: 0.4 }
            ],
            startDate: Date.now()
        };
        const txs: Transaction[] = [
            {
                id: 'tx-s1',
                date: 1000,
                symbol: 'ETH/USDT',
                type: 'SELL',
                price: 2000,
                quantity: 1,
                amount: 2000,
                fee: 0,
                associatedPositionIds: ['pos-2']
            },
            {
                id: 'tx-b1',
                date: 2000,
                symbol: 'ETH/USDT',
                type: 'BUY',
                price: 1500,
                quantity: 0.4,
                amount: 600,
                fee: 0,
                associatedPositionIds: ['pos-2']
            }
        ];

        const metrics = getPositionMetrics(pos, txs, mockPrices);
        // SHORT logic:
        // Total Revenue: 2000
        // Total Cost (Buyback): 600
        // Remaining Short: 0.6
        // Cash Left to cover: 2000 - 600 = 1400
        // Breakeven: 1400 / 0.6 = 2333.333...
        expect(metrics.totalRemaining).toBe(0.6);
        expect(metrics.breakevenPrice).toBeCloseTo(2333.3333, 4);
    });

    it('returns breakEven as 0 when totalRemaining is 0', () => {
        const pos: Position = {
            id: 'pos-3',
            symbol: 'BTC/USDT',
            type: 'PRIMARY',
            status: 'CLOSED',
            entries: [
                { transactionId: 'tx-1', allocatedAmount: 1 },
                { transactionId: 'tx-2', allocatedAmount: 1 }
            ],
            startDate: Date.now()
        };
        const txs: Transaction[] = [
            { id: 'tx-1', date: 1000, symbol: 'BTC/USDT', type: 'BUY', price: 50000, quantity: 1, amount: 50000, fee: 0, associatedPositionIds: ['pos-3'] },
            { id: 'tx-2', date: 2000, symbol: 'BTC/USDT', type: 'SELL', price: 60000, quantity: 1, amount: 60000, fee: 0, associatedPositionIds: ['pos-3'] }
        ];

        const metrics = getPositionMetrics(pos, txs, mockPrices);
        expect(metrics.totalRemaining).toBe(0);
        expect(metrics.breakevenPrice).toBe(0);
    });
});
