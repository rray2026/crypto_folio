import { getAveragePrice, mul, sub, add, div } from "./math"
import type { Position, Transaction, Fund } from "./types"

export type DashboardTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type PositionMetrics = ReturnType<typeof getPositionMetrics>;

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
    const assetsValue = positionMetrics.reduce((sum, m) => {
        if (m.totalRemaining !== 0 && m.currentPrice > 0) return add(sum, mul(m.totalRemaining, m.currentPrice));
        return sum;
    }, 0);
    const cashValue = sub(currentValue, assetsValue);
    return { currentValue, initialNAV, currentNAV, navChangePct, totalPnL, assetsValue, cashValue };
}

/**
 * Comparator for sorting enriched position pairs open-first, then by date descending.
 * Use with Array.prototype.sort on arrays of { pos: Position; metrics: PositionMetrics }.
 */
export function comparePositionsByMetrics(
    a: { pos: Position; metrics: PositionMetrics },
    b: { pos: Position; metrics: PositionMetrics },
): number {
    const aOpen = a.pos.status === 'OPEN' || !a.metrics.derivedEndDate;
    const bOpen = b.pos.status === 'OPEN' || !b.metrics.derivedEndDate;
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    if (!aOpen && !bOpen && a.metrics.derivedEndDate !== b.metrics.derivedEndDate)
        return (b.metrics.derivedEndDate || 0) - (a.metrics.derivedEndDate || 0);
    return (b.metrics.derivedStartDate || b.pos.startDate || 0) - (a.metrics.derivedStartDate || a.pos.startDate || 0);
}

/**
 * Aggregates portfolio-level metrics across all PRIMARY positions, filtered by time range.
 * Returns the computed stats plus the resolved timeThreshold (ms) for card-level filtering.
 */
export function getPortfolioMetrics(
    positions: Position[],
    transactions: Transaction[],
    prices: Record<string, { price: string; timestamp: number }>,
    timeRange: DashboardTimeRange,
) {
    const now = Date.now();
    let timeThreshold = 0;
    if (timeRange === '1M') timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
    if (timeRange === '3M') timeThreshold = now - 90 * 24 * 60 * 60 * 1000;
    if (timeRange === '6M') timeThreshold = now - 180 * 24 * 60 * 60 * 1000;
    if (timeRange === '1Y') timeThreshold = now - 365 * 24 * 60 * 60 * 1000;

    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    let totalInvestment = 0;
    let winningTrades = 0;
    let closedTrades = 0;

    for (const pos of positions) {
        if (pos.type === 'SHADOW') continue;
        const linkedTxIds = new Set(pos.entries.map(e => e.transactionId));
        const linkedTxs = transactions.filter(tx => linkedTxIds.has(tx.id));
        const metrics = getPositionMetrics(pos, linkedTxs, prices);
        const endDate = metrics.derivedEndDate || now;
        const isWithinRange = timeThreshold === 0 || (pos.status === 'CLOSED' ? endDate >= timeThreshold : true);
        if (!isWithinRange) continue;

        totalRealizedPnL = add(totalRealizedPnL, metrics.realizedPnL);
        totalUnrealizedPnL = add(totalUnrealizedPnL, metrics.unrealizedPnL);
        totalInvestment = add(totalInvestment, metrics.totalInvestment);
        if (pos.status === 'CLOSED') {
            closedTrades++;
            if (metrics.realizedPnL > 0) winningTrades++;
        }
    }

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const globalROI = totalInvestment > 0 ? mul(div(add(totalRealizedPnL, totalUnrealizedPnL), totalInvestment), 100) : 0;
    return { totalRealizedPnL, totalUnrealizedPnL, totalInvestment, winRate, winningTrades, closedTrades, globalROI, timeThreshold };
}
