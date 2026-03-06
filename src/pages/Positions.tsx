import { useState } from "react"
import { Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { PositionForm } from "@/components/positions/PositionForm"

import { Plus, Trash2, ArrowRight, Calendar, Clock } from "lucide-react"
import { differenceInDays, format } from "date-fns"
import { getPositionMetrics } from "@/lib/metrics"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export default function Positions() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const deletePosition = usePositionStore((state) => state.deletePosition)
    const { prices, fetchPrices } = useSettingsStore()

    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    // Fetch prices for all OPEN symbols
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
        const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
        if (openSymbols.length > 0) {
            // Non-blocking fetch on render if not cached
            fetchPrices(openSymbols);
        }
    }

    const getMetrics = (pos: any) => {
        if (!transactions) return { realizedPnL: 0, unrealizedPnL: 0, totalPnL: 0, roi: 0, totalInvestment: 0, totalRemaining: 0, currentPrice: 0, positionType: 'LONG' as const, derivedStartDate: pos.startDate, derivedEndDate: pos.endDate, avgBuyPrice: 0, avgSellPrice: 0 };
        const linkedTxIds = new Set(pos.entries.map((e: any) => e.transactionId));
        const linkedTxs = transactions.filter(tx => linkedTxIds.has(tx.id));
        return getPositionMetrics(pos, linkedTxs, prices);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this position? Linkings to transactions will be removed (but transactions are kept).")) {
            await deletePosition(id)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-2">Manage your trading strategies and group trades.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Position
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create Position</DialogTitle>
                            <DialogDescription>
                                Group your trades under a strategy to view its performance.
                            </DialogDescription>
                        </DialogHeader>
                        <PositionForm onSuccess={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {!positions?.length ? (
                <Card className="border-dashed shadow-none">
                    <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                        <p>No positions created yet.</p>
                        <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="mt-4">
                            Create Your First Strategy
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {positions.map(pos => ({ pos, metrics: getMetrics(pos) })).sort((a, b) => (b.metrics.derivedStartDate || b.pos.startDate || 0) - (a.metrics.derivedStartDate || a.pos.startDate || 0)).map(({ pos, metrics }) => {
                        const duration = differenceInDays(metrics.derivedEndDate || Date.now(), metrics.derivedStartDate || Date.now());

                        return (
                            <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                                <Card className="h-full flex flex-col relative group overflow-hidden bg-card/60 hover:bg-card/100 border-border/40 hover:border-border transition-colors">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg font-bold tracking-tight line-clamp-1 mr-2" title={pos.strategyName || "Unnamed Position"}>
                                                {pos.strategyName || "Unnamed Position"}
                                            </CardTitle>
                                            <div className="flex items-center gap-1 ml-2">
                                                <Badge variant={metrics.positionType === 'LONG' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 h-5">
                                                    {metrics.positionType}
                                                </Badge>
                                                <Badge variant={pos.status === 'OPEN' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 h-5 whitespace-nowrap">
                                                    {pos.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-sm text-foreground/60 font-mono font-medium">{pos.symbol}</p>
                                            {pos.status === 'OPEN' && prices[pos.symbol] && (
                                                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
                                                    ${parseFloat(prices[pos.symbol].price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-mono bg-background/50 rounded-md p-1.5 border border-border/50">
                                            <div className="flex items-center gap-1" title="Start Date">
                                                <Calendar className="h-3 w-3" />
                                                {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : 'Unknown'}
                                            </div>
                                            <div className="flex items-center gap-1" title="Duration">
                                                <Clock className="h-3 w-3" />
                                                {duration} {duration === 1 ? 'day' : 'days'}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="text-sm flex flex-col gap-2 text-muted-foreground mt-2">
                                            <div className="flex justify-between">
                                                <span>Investment</span>
                                                <span className="font-mono text-foreground">${metrics.totalInvestment.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Realized PnL</span>
                                                <span className={`font-mono font-medium ${metrics.realizedPnL > 0 ? 'text-green-500' : metrics.realizedPnL < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                    ${metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                                </span>
                                            </div>
                                            {pos.status === 'OPEN' && metrics.totalRemaining > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Unrealized PnL</span>
                                                    <span className={`font-mono font-medium ${metrics.unrealizedPnL > 0 ? 'text-green-500' : metrics.unrealizedPnL < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                        ${metrics.unrealizedPnL > 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-semibold border-t border-border/50 pt-1 mt-1">
                                                <span>Total Return</span>
                                                <span className={`font-mono ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                    {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between mt-1 items-center">
                                                <span>Holding</span>
                                                <div className="text-right">
                                                    <div className="font-mono text-foreground">{metrics.totalRemaining} {pos.symbol.split('/')[0]}</div>
                                                    {pos.status === 'OPEN' && metrics.currentPrice > 0 && (
                                                        <div className="text-[10px] text-muted-foreground font-mono">@ ${metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-0 flex justify-between items-center opacity-80 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive z-10 -ml-2" onClick={(e) => handleDelete(pos.id, e)}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                        </Button>
                                        <Button variant="ghost" size="sm" className="gap-1 text-primary">
                                            Details <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    )
}
