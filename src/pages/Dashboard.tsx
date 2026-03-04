import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { getAveragePrice, mul, sub, add, div } from "@/lib/math"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Wallet, Activity, Target, TrendingUp } from "lucide-react"

export default function Dashboard() {
    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    if (!positions || !transactions) {
        return <div className="p-8 text-muted-foreground">Loading dashboard...</div>
    }

    // Calculate global metrics
    let totalRealizedPnL = 0;
    let totalInvestment = 0;
    let winningTrades = 0;
    let closedTrades = 0;

    const openPositions = positions.filter(p => p.status === 'OPEN');

    positions.forEach(pos => {
        // Calc this position's PnL
        const linkedTxIds = new Set(pos.entries.map(e => e.transactionId));
        const linkedTxs = transactions.filter(tx => linkedTxIds.has(tx.id));

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

        const avgBuyPrice = tBought > 0 ? getAveragePrice(tCost, tBought) : 0;
        const avgSellPrice = tSold > 0 ? getAveragePrice(tRevenue, tSold) : 0;
        const realizedPnL = tSold > 0 ? mul(sub(avgSellPrice, avgBuyPrice), tSold) : 0;

        totalRealizedPnL = add(totalRealizedPnL, realizedPnL);
        totalInvestment = add(totalInvestment, tCost);

        if (pos.status === 'CLOSED') {
            closedTrades++;
            if (realizedPnL > 0) winningTrades++;
        }
    });

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const globalROI = totalInvestment > 0 ? mul(div(totalRealizedPnL, totalInvestment), 100) : 0;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Overview of your crypto portfolio performance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        {openPositions.map(pos => (
                            <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                                <Card className="h-full hover:border-primary/50 transition-colors">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base font-bold truncate">
                                                {pos.strategyName}
                                            </CardTitle>
                                            <Badge variant="default" className="ml-2">OPEN</Badge>
                                        </div>
                                        <p className="text-sm text-foreground/60 font-mono font-medium">{pos.symbol}</p>
                                    </CardHeader>
                                    <CardContent className="flex justify-between items-center text-sm pt-2 mb-2 text-muted-foreground">
                                        <span>{pos.entries.length} Links</span>
                                        <span className="flex items-center text-primary group-hover:underline">
                                            View <ArrowRight className="h-3 w-3 ml-1" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
