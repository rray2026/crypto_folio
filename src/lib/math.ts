import Decimal from 'decimal.js';

// We configure decimal.js for reasonable float calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function mul(a: number | string, b: number | string): number {
    return new Decimal(a).times(b).toNumber();
}

export function div(a: number | string, b: number | string): number {
    if (new Decimal(b).isZero()) return 0;
    return new Decimal(a).dividedBy(b).toNumber();
}

export function add(a: number | string, b: number | string): number {
    return new Decimal(a).plus(b).toNumber();
}

export function sub(a: number | string, b: number | string): number {
    return new Decimal(a).minus(b).toNumber();
}

/**
 * Calculates Average Price = Total Cost / Total Amount
 */
export function getAveragePrice(totalCost: number | string, totalAmount: number | string): number {
    return div(totalCost, totalAmount);
}
