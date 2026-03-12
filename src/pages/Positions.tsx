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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your trading strategies and group trades.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="hidden sm:flex gap-2">
                            <Plus className="h-4 w-4" />
                            New Position
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6">
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
                <Card className="border-dashed shadow-none mt-6">
                    <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                        <p>No positions created yet.</p>
                        <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="mt-4">
                            Create Your First Strategy
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
                        <TabsTrigger value="active">Active ({positions.filter(p => p.status === 'OPEN').length})</TabsTrigger>
                        <TabsTrigger value="history">History ({positions.filter(p => p.status === 'CLOSED').length})</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>

                    {['active', 'history', 'all'].map(tab => {
                        const filteredPositions = positions.filter(p => {
                            if (tab === 'active') return p.status === 'OPEN';
                            if (tab === 'history') return p.status === 'CLOSED';
                            return true; // all
                        });

                        return (
                            <TabsContent value={tab} key={tab}>
                                {filteredPositions.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card/50">
                                        No {tab} positions found.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {filteredPositions.map(pos => ({ pos, metrics: getMetrics(pos) }))
                                            .sort((a, b) => (b.metrics.derivedStartDate || b.pos.startDate || 0) - (a.metrics.derivedStartDate || a.pos.startDate || 0))
                                            .map(({ pos, metrics }) => {
                                                const duration = differenceInDays(metrics.derivedEndDate || Date.now(), metrics.derivedStartDate || Date.now());
                                                const isActive = pos.status === 'OPEN';

                                                return (
                                                    <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                                                        <Card className="h-full flex flex-col relative group overflow-hidden bg-card/60 hover:bg-card/100 border-border/40 hover:border-border transition-colors">
                                                            <CardHeader className="pb-3 border-b border-border/40">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <CardTitle className="text-lg font-bold tracking-tight line-clamp-1 mr-2" title={pos.strategyName || "Unnamed Position"}>
                                                                        {pos.strategyName || "Unnamed Position"}
                                                                    </CardTitle>
                                                                    <div className="flex justify-end gap-1">
                                                                        <Badge variant={metrics.positionType === 'LONG' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 h-5">
                                                                            {metrics.positionType}
                                                                        </Badge>
                                                                        <Badge variant={isActive ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0 h-5 whitespace-nowrap">
                                                                            {pos.status}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-sm text-foreground/80 font-mono font-medium">{pos.symbol}</p>
                                                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                                                                        <div className="flex items-center gap-1" title="Start Date">
                                                                            <Calendar className="h-3 w-3" />
                                                                            {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : 'Unknown'}
                                                                        </div>
                                                                        <div className="flex items-center gap-1" title="Duration">
                                                                            <Clock className="h-3 w-3" />
                                                                            {duration}d
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="flex-1 pt-4 pb-2 space-y-4">
                                                                {/* Holdings and Price / Cost */}
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-muted-foreground mb-1">Holdings</span>
                                                                        <span className="font-mono text-sm font-medium">
                                                                            {metrics.totalRemaining} <span className="text-muted-foreground text-[10px]">{pos.symbol.split('/')[0]}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-xs text-muted-foreground mb-1">{isActive && metrics.currentPrice > 0 ? 'Current Price' : 'Avg Cost'}</span>
                                                                        <span className="font-mono text-sm font-medium">
                                                                            ${isActive && metrics.currentPrice > 0 
                                                                                ? metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                                                                : (metrics.totalRemaining > 0 ? (metrics.totalInvestment / metrics.totalRemaining).toFixed(2) : '0.00')}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Investment and Realized PnL */}
                                                                <div className="flex justify-between items-center pt-3 border-t border-border/30">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-muted-foreground mb-1">Total Inv.</span>
                                                                        <span className="font-mono text-sm">${metrics.totalInvestment.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-xs text-muted-foreground mb-1">Realized PnL</span>
                                                                        <span className={`font-mono text-sm font-medium ${metrics.realizedPnL > 0 ? 'text-green-500' : metrics.realizedPnL < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                                                            ${metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Heavy Highlight: Unrealized PnL and ROI (Inspired by Dashboard) */}
                                                                <div className={`mt-2 p-3 rounded-lg flex justify-between items-center ${isActive ? 'bg-muted/50 border border-border/50' : 'bg-transparent border-t border-border/30 pt-4 px-0'}`}>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                                                                            {isActive ? 'Unrealized PnL' : 'Final PnL'}
                                                                        </span>
                                                                        <span className={`font-mono font-bold text-lg ${isActive ? (metrics.unrealizedPnL > 0 ? 'text-green-500' : metrics.unrealizedPnL < 0 ? 'text-destructive' : '') : (metrics.realizedPnL > 0 ? 'text-green-500' : metrics.realizedPnL < 0 ? 'text-destructive' : '')}`}>
                                                                            ${isActive 
                                                                                ? `${metrics.unrealizedPnL > 0 ? '+' : ''}${metrics.unrealizedPnL.toFixed(2)}`
                                                                                : `${metrics.realizedPnL > 0 ? '+' : ''}${metrics.realizedPnL.toFixed(2)}`}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total ROI</span>
                                                                        <span className={`font-mono font-bold text-lg ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : ''}`}>
                                                                            {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                            
                                                            <CardFooter className="pt-2 pb-3 px-4 flex justify-between items-center bg-muted/20 border-t border-border/10 opacity-70 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive z-10 -ml-2" onClick={(e) => handleDelete(pos.id, e)}>
                                                                    <Trash2 className="h-3 w-3 mr-1.5" /> Delete
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                                                                    View Details <ArrowRight className="h-3 w-3" />
                                                                </Button>
                                                            </CardFooter>
                                                        </Card>
                                                    </Link>
                                                );
                                            })}
                                    </div>
                                )}
                            </TabsContent>
                        )
                    })}
                </Tabs>
            )}

            {/* Mobile FAB */}
            <div className="sm:hidden fixed bottom-20 right-4 z-40">
                <Button 
                    size="icon" 
                    className="h-14 w-14 rounded-full shadow-lg opacity-90 backdrop-blur-md hover:opacity-100 transition-opacity border border-primary/20"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>
        </div>
    )
}
