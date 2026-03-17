import { getAveragePrice, mul, sub, add, div } from "./math"
import type { Position, Transaction } from "./types"

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

        if (pos.status === 'OPEN' && totalRemaining > 0) {
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
        totalRemaining = sub(tSold, tBought);
        totalInvestment = tRevenue;

        if (pos.status === 'OPEN' && totalRemaining > 0) {
            const cached = prices[pos.symbol];
            if (cached) {
                currentPrice = parseFloat(cached.price);
                unrealizedPnL = mul(sub(avgSellPrice, currentPrice), totalRemaining);
                totalPnL = add(realizedPnL, unrealizedPnL);
                roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
            }
        } else {
            totalPnL = realizedPnL;
            roi = totalInvestment > 0 ? mul(div(totalPnL, totalInvestment), 100) : 0;
        }
    }

    let breakevenPrice = 0;
    if (totalRemaining > 0) {
        if (positionType === 'LONG') {
            breakevenPrice = div(sub(tCost, tRevenue), totalRemaining);
        } else {
            // For SHORT: (Revenue - Cost) / Remaining. 
            // If you sold 1 BTC @ 100, and bought 0.5 @ 40, you have 0.5 short remaining.
            // You have 60 left to "cover" the remaining 0.5. 60/0.5 = 120.
            // If price hits 120, you close at 120*0.5=60, total profit 0.
            breakevenPrice = div(sub(tRevenue, tCost), totalRemaining);
        }
    }

    return { realizedPnL, unrealizedPnL, totalPnL, roi, totalInvestment, totalRemaining, currentPrice, positionType, derivedStartDate, derivedEndDate, avgBuyPrice, avgSellPrice, breakevenPrice };
}
