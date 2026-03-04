import { describe, it, expect } from 'vitest';
import { add, sub, mul, div, getAveragePrice } from './math';

describe('Financial Math Utilities', () => {
    it('solves the classic 0.1 + 0.2 precision problem', () => {
        // Native JS: 0.1 + 0.2 = 0.30000000000000004
        expect(add(0.1, 0.2)).toBe(0.3);
    });

    it('calculates subtraction precisely', () => {
        expect(sub('0.3', '0.1')).toBe(0.2);
    });

    it('calculates multiplication precisely', () => {
        expect(mul(0.1, 0.2)).toBe(0.02);
    });

    it('calculates division safely and precisely', () => {
        expect(div(0.3, 0.1)).toBe(3);
        expect(div(1, 3)).toBeCloseTo(0.3333333333, 5); // decimal.js yields precision
    });

    it('prevents division by zero', () => {
        expect(div(100, 0)).toBe(0); // our logic returns 0 when dividing by 0
    });

    it('calculates average entry price correctly', () => {
        // 5 units at $1.2, 5 units at $1.5
        const totalCost = add(mul(5, 1.2), mul(5, 1.5));
        expect(totalCost).toBe(13.5);
        expect(getAveragePrice(totalCost, 10)).toBe(1.35);
    });

    it('handles negative PnL math correctly', () => {
        const cost = 1000;
        const revenue = 800;
        const pnl = sub(revenue, cost);
        expect(pnl).toBe(-200);
    });
});
