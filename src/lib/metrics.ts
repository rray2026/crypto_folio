import { getAveragePrice, mul, sub, add, div } from "./math"
import type { Position, Transaction, Fund } from "./types"

export function getPositionMetrics(pos: Position, linkedTxs: Transaction[], prices: Record<string, { price: string; timestamp: number }>) {
    let tBought = 0;
    let tSold = 0;
    let tCost = 0;
    let tRevenue = 0;

    linkedTxs.forEach(tx => {
        const allocated = pos.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0;
        if (tx.type === 'BUY') {
            tBought = add(tBought, allocated);
            tCost = add(tCost, mul(allocated, tx.price));
        } else {
            tSold = add(tSold, allocated);
            tRevenue = add(tRevenue, mul(allocated, tx.price));
        }
    });

    const chronologicalTxs = [...linkedTxs].sort((a, b) => a.date - b.date);
    const positionType: 'LONG' | 'SHORT' = chronologicalTxs.length > 0 && chronologicalTxs[0].type === 'SELL' ? 'SHORT' : 'LONG';
    const derivedStartDate = chronologicalTxs.length > 0 ? chronologicalTxs[0].date : pos.startDate;
    const derivedEndDate = pos.status === 'CLOSED' ? (chronologicalTxs.length > 0 ? chronologicalTxs[chronologicalTxs.length - 1].date : pos.endDate) : pos.endDate;

    const avgBuyPrice = tBought > 0 ? getAveragePrice(tCost, tBought) : 0;
    const avgSellPrice = tSold > 0 ? getAveragePrice(tRevenue, tSold) : 0;

    let realizedPnL = 0;
    let unrealizedPnL = 0;
    let totalPnL = 0;
    let totalInvestment = 0;
    let totalRemaining = 0;
    let roi = 0;
    let currentPrice = 0;

    if (positionType === 'LONG') {
        realizedPnL = tSold > 0 ? mul(sub(avgSellPrice, avgBuyPrice), tSold) : 0;
        totalRemaining = sub(tBought, tSold);
        totalInvestment = tCost;

        if (pos.status === 'OPEN' && totalRemaining !== 0) {
            const cached = prices[pos.symbol];
            if (cached) {
                currentPrice = parseFloat(cached.price);
                const currentValue = mul(totalRemaining, currentPrice);
                const costOfRemaining = mul(totalRemaining, avgBuyPrice);
                unrealizedPnL = sub(currentValue, costOfRemaining);
                totalPnL = add(realizedPnL, unrealizedPnL);
                roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
            }
        } else {
            totalPnL = realizedPnL;
            roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
        }
    } else {
        // SHORT POSITION
        realizedPnL = tBought > 0 ? mul(sub(avgSellPrice, avgBuyPrice), tBought) : 0;
        totalRemaining = sub(tBought, tSold);
        totalInvestment = tRevenue;

        if (pos.status === 'OPEN' && totalRemaining !== 0) {
            const cached = prices[pos.symbol];
            if (cached) {
                currentPrice = parseFloat(cached.price);
                unrealizedPnL = mul(sub(currentPrice, avgSellPrice), totalRemaining);
                totalPnL = add(realizedPnL, unrealizedPnL);
                roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
            }
        } else {
            totalPnL = realizedPnL;
            roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
        }
    }

    let breakevenPrice = 0;
    if (totalRemaining !== 0) {
        // Unified formula works for both LONG (positive remaining) and SHORT (negative remaining).
        // LONG example: cost=50k, revenue=40k, remaining=0.5 → (50k-40k)/0.5 = 20k ✓
        // SHORT example: cost=600, revenue=2000, remaining=-0.6 → (600-2000)/(-0.6) = 2333 ✓
        breakevenPrice = div(sub(tCost, tRevenue), totalRemaining);
    }

    return { realizedPnL, unrealizedPnL, totalPnL, roi, totalInvestment, totalRemaining, currentPrice, positionType, derivedStartDate, derivedEndDate, avgBuyPrice, avgSellPrice, breakevenPrice };
}

/**
 * Computes NAV-based metrics for a Fund, given pre-computed position metrics.
 *
 * Formula (ETF-style):
 *   fundCurrentValue = initialAmount + totalPnL
 *   initialNAV       = initialAmount / initialShares
 *   currentNAV       = fundCurrentValue / initialShares
 *   navChangePct     = (currentNAV - initialNAV) / initialNAV × 100
 */
export function getFundMetrics(
    fund: Fund,
    positionMetrics: ReturnType<typeof getPositionMetrics>[],
) {
    const totalPnL = positionMetrics.reduce((sum, m) => add(sum, m.totalPnL), 0);
    const currentValue = add(fund.initialAmount, totalPnL);
    const initialNAV = fund.initialShares > 0 ? div(fund.initialAmount, fund.initialShares) : 0;
    const currentNAV = fund.initialShares > 0 ? div(currentValue, fund.initialShares) : 0;
    const navChangePct = initialNAV > 0
        ? mul(div(sub(currentNAV, initialNAV), initialNAV), 100)
        : 0;
    return { currentValue, initialNAV, currentNAV, navChangePct, totalPnL };
}
