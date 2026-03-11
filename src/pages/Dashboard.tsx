import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { mul, add, div } from "@/lib/math"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, Activity, Target, TrendingUp, LineChart } from "lucide-react"
import { useSettingsStore } from "@/store/useSettingsStore"
import { getPositionMetrics } from "@/lib/metrics"
import { useState } from "react"

export default function Dashboard() {
    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())
    const { prices, fetchPrices, dashboardTimeRange } = useSettingsStore()

    // Fetch prices for all OPEN symbols periodically (every 5 mins)
    useState(() => {
        const interval = setInterval(() => {
            if (!positions) return;
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            if (openSymbols.length > 0) {
                fetchPrices(openSymbols);
            }
        }, 300000);
        return () => clearInterval(interval);
    });

    if (positions) {
        // Non-blocking fetch on render if not cached
        const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
        if (openSymbols.length > 0) {
            fetchPrices(openSymbols);
        }
    }

    if (!positions || !transactions) {
        return <div className="p-8 text-muted-foreground">Loading dashboard...</div>
    }

    // Calculate global metrics
    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    let totalInvestment = 0;
    let winningTrades = 0;
    let closedTrades = 0;

    // Time Range Filtering Logic
    const now = Date.now();
    let timeThreshold = 0; // 0 means 'ALL'
    if (dashboardTimeRange === '1M') timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '3M') timeThreshold = now - 90 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '6M') timeThreshold = now - 180 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '1Y') timeThreshold = now - 365 * 24 * 60 * 60 * 1000;

    const openPositionMetrics = new Map<string, ReturnType<typeof getPositionMetrics>>();

    // Pre-calculate metrics for all positions to get their derived dates
    const allMetrics = positions.map(pos => {
        const linkedTxIds = new Set(pos.entries.map(e => e.transactionId));
        const linkedTxs = transactions.filter(tx => linkedTxIds.has(tx.id));
        return {
            pos,
            metrics: getPositionMetrics(pos, linkedTxs, prices)
        };
    });

    // Filter positions based on the selected time range
    const filteredPositions = timeThreshold === 0 ? allMetrics : allMetrics.filter(({ pos, metrics }) => {
        if (pos.status === 'CLOSED') {
            return metrics.derivedEndDate && metrics.derivedEndDate >= timeThreshold;
        } else {
            // For OPEN positions, we consider them relevant if they are currently active (which they are)
            // OR if they were opened after the threshold. We'll show all currently OPEN positions
            // that overlap with the time window (since they are literally 'Active' right now).
            return true;
        }
    });

    const openPositions = filteredPositions.filter(p => p.pos.status === 'OPEN').map(p => p.pos);

    filteredPositions.forEach(({ pos, metrics }) => {
        if (pos.status === 'OPEN') {
            openPositionMetrics.set(pos.id, metrics);
        }

        totalRealizedPnL = add(totalRealizedPnL, metrics.realizedPnL);
        totalUnrealizedPnL = add(totalUnrealizedPnL, metrics.unrealizedPnL);
        totalInvestment = add(totalInvestment, metrics.totalInvestment);

        if (pos.status === 'CLOSED') {
            closedTrades++;
            if (metrics.realizedPnL > 0) winningTrades++;
        }
    });

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const globalROI = totalInvestment > 0 ? mul(div(add(totalRealizedPnL, totalUnrealizedPnL), totalInvestment), 100) : 0;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Overview of your crypto portfolio performance.</p>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border self-start md:self-auto">
                    <Activity className="h-3 w-3 md:h-4 md:w-4" />
                    <span>Time Filter: <strong className="text-foreground">{dashboardTimeRange === 'ALL' ? 'All Time' : dashboardTimeRange}</strong></span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Realized PnL</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalRealizedPnL > 0 ? 'text-green-500' : totalRealizedPnL < 0 ? 'text-destructive' : ''}`}>
                            ${totalRealizedPnL > 0 ? '+' : ''}{totalRealizedPnL.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across all positions
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Unrealized PnL</CardTitle>
                        <LineChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalUnrealizedPnL > 0 ? 'text-green-500' : totalUnrealizedPnL < 0 ? 'text-destructive' : ''}`}>
                            ${totalUnrealizedPnL > 0 ? '+' : ''}{totalUnrealizedPnL.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current open positions
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Global ROI</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${globalROI > 0 ? 'text-green-500' : globalROI < 0 ? 'text-destructive' : ''}`}>
                            {globalROI > 0 ? '+' : ''}{globalROI.toFixed(2)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Return on deployed capital
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {winningTrades} wins / {closedTrades} closed stats
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Strategies</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{openPositions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Currently OPEN positions
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Active Positions</h2>
                {openPositions.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card/50">
                        No active positions. Create one from the Positions tab to track your trades.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openPositions.map(pos => {
                            const metrics = openPositionMetrics.get(pos.id)!;
                            return (
                                <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                                    <Card className="h-full hover:border-primary/50 transition-colors">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base font-bold truncate">
                                                    {pos.strategyName}
                                                </CardTitle>
                                                <Badge variant={metrics.positionType === 'LONG' ? 'default' : 'destructive'} className="ml-2">{metrics.positionType}</Badge>
                                            </div>
                                            <p className="text-sm text-foreground/60 font-mono font-medium">{pos.symbol}</p>
                                        </CardHeader>
                                        <CardContent className="pt-2 mb-2">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Holdings</span>
                                                    <span className="font-mono text-sm">{metrics.totalRemaining} <span className="text-muted-foreground text-xs">{pos.symbol.split('/')[0]}</span></span>
                                                </div>
                                                {metrics.currentPrice > 0 ? (
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-xs text-muted-foreground">Price</span>
                                                        <span className="font-mono text-sm">${metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-xs text-muted-foreground">Cost</span>
                                                        <span className="font-mono text-sm">${metrics.totalInvestment.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center bg-muted/50 rounded p-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Unrealized PnL</span>
                                                    <span className={`font-mono font-bold text-sm ${metrics.unrealizedPnL > 0 ? 'text-green-500' : metrics.unrealizedPnL < 0 ? 'text-destructive' : ''}`}>
                                                        ${metrics.unrealizedPnL > 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-xs text-muted-foreground">ROI</span>
                                                    <span className={`font-mono font-bold text-sm ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : ''}`}>
                                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
