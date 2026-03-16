import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { mul, add, div } from "@/lib/math"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { PositionForm } from "@/components/positions/PositionForm"

import { Plus, Trash2, ArrowRight, Calendar, Clock, Wallet, Activity, Target, TrendingUp, TrendingDown, LineChart, Circle, Eye } from "lucide-react"
import { differenceInDays, format } from "date-fns"
import { getPositionMetrics } from "@/lib/metrics"

import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Positions() {
    const navigate = useNavigate()
    const deletePosition = usePositionStore((state) => state.deletePosition)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const { prices, fetchPrices, dashboardTimeRange, setDashboardTimeRange } = useSettingsStore()

    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    // Fetch prices for all OPEN symbols
    // Fetch prices for all OPEN symbols periodically (every 5 mins)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!positions) return;
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            if (openSymbols.length > 0) {
                fetchPrices(openSymbols);
            }
        }, 300000);
        return () => clearInterval(interval);
    }, [positions, fetchPrices]); // Added dependencies

    // Non-blocking fetch on render if not cached
    useEffect(() => {
        if (positions) {
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            if (openSymbols.length > 0) {
                fetchPrices(openSymbols);
            }
        }
    }, [positions, fetchPrices]); // Added dependencies

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

    // Calculate global metrics
    let totalRealizedPnL = 0;
    let totalUnrealizedPnL = 0;
    let totalInvestment = 0;
    let winningTrades = 0;
    let closedTrades = 0;
    let activeStrategiesCount = 0;

    // Time Range Filtering Logic
    const now = Date.now();
    let timeThreshold = 0; // 0 means 'ALL'
    if (dashboardTimeRange === '1M') timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '3M') timeThreshold = now - 90 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '6M') timeThreshold = now - 180 * 24 * 60 * 60 * 1000;
    if (dashboardTimeRange === '1Y') timeThreshold = now - 365 * 24 * 60 * 60 * 1000;

    if (positions && transactions) {
        positions.forEach(pos => {
            const metrics = getMetrics(pos);
            const endDate = metrics.derivedEndDate || now;
            
            // Only count towards global metrics if it's a PRIMARY position,
            // AND if it closed within the time range OR is currently open.
            const isPrimary = pos.type !== 'SHADOW';
            const isWithinRange = timeThreshold === 0 || (pos.status === 'CLOSED' ? endDate >= timeThreshold : true);

            if (isWithinRange && isPrimary) {
                totalRealizedPnL = add(totalRealizedPnL, metrics.realizedPnL);
                totalUnrealizedPnL = add(totalUnrealizedPnL, metrics.unrealizedPnL);
                totalInvestment = add(totalInvestment, metrics.totalInvestment);

                if (pos.status === 'CLOSED') {
                    closedTrades++;
                    if (metrics.realizedPnL > 0) winningTrades++;
                } else if (pos.status === 'OPEN') {
                    activeStrategiesCount++;
                }
            }
        });
    }

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const globalROI = totalInvestment > 0 ? mul(div(add(totalRealizedPnL, totalUnrealizedPnL), totalInvestment), 100) : 0;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your trading strategies and group trades.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <Select value={dashboardTimeRange} onValueChange={(val: any) => setDashboardTimeRange(val)}>
                        <SelectTrigger className="h-9 w-[150px] bg-muted/40 rounded-full border-border/50 text-xs shadow-sm hover:bg-muted/60 transition-colors">
                            <div className="flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Range" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="1M">Last 1 Month</SelectItem>
                            <SelectItem value="3M">Last 3 Months</SelectItem>
                            <SelectItem value="6M">Last 6 Months</SelectItem>
                            <SelectItem value="1Y">Last 1 Year</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                            <PositionForm onSuccess={() => setIsAddDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Portfolio Summary Card */}
            <Card className="mb-8 overflow-hidden shadow-sm border bg-card">
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/50">
                        <div className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Realized PnL</span>
                            </div>
                            <div className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${totalRealizedPnL > 0 ? 'text-green-500' : totalRealizedPnL < 0 ? 'text-destructive' : ''}`}>
                                ${totalRealizedPnL > 0 ? '+' : ''}{totalRealizedPnL.toFixed(2)}
                            </div>
                        </div>

                        <div className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-2 mb-2">
                                <LineChart className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Unrealized PnL</span>
                            </div>
                            <div className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${totalUnrealizedPnL > 0 ? 'text-green-500' : totalUnrealizedPnL < 0 ? 'text-destructive' : ''}`}>
                                ${totalUnrealizedPnL > 0 ? '+' : ''}{totalUnrealizedPnL.toFixed(2)}
                            </div>
                        </div>

                        <div className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Global ROI</span>
                            </div>
                            <div className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${globalROI > 0 ? 'text-green-500' : globalROI < 0 ? 'text-destructive' : ''}`}>
                                {globalROI > 0 ? '+' : ''}{globalROI.toFixed(2)}%
                            </div>
                        </div>

                        <div className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Win Rate</span>
                            </div>
                            <div className="text-xl md:text-2xl font-bold font-mono tracking-tight">
                                {winRate.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 font-medium">{winningTrades}W / {closedTrades}C</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            {!positions?.length ? (
                <Card className="border-dashed shadow-none mt-6">
                    <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                        <p>No positions created yet.</p>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} className="mt-4">
                            Create Your First Strategy
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="unrealized" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
                        <TabsTrigger value="unrealized">UNREALIZED ({positions.filter(p => p.status === 'OPEN').length})</TabsTrigger>
                        <TabsTrigger value="realized">REALIZED ({positions.filter(p => p.status === 'CLOSED').length})</TabsTrigger>
                        <TabsTrigger value="all">ALL</TabsTrigger>
                    </TabsList>

                    {['unrealized', 'realized', 'all'].map(tab => {
                        const filteredPositions = positions.filter(p => {
                            if (tab === 'unrealized') return p.status === 'OPEN';
                            if (tab === 'realized') return p.status === 'CLOSED';
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
                                                        <Card 
                                                            className={`h-full flex flex-col relative group overflow-hidden border-border/40 hover:border-border transition-colors bg-card/60 hover:bg-card/100 shadow-sm ${
                                                                pos.type === 'SHADOW' 
                                                                ? 'border-dashed border-2' 
                                                                : ''
                                                            }`}
                                                        >
                                                            <CardHeader className="pb-3 border-b border-border/40">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <CardTitle className="text-lg font-bold tracking-tight line-clamp-1 mr-2" title={pos.strategyName || `${pos.symbol.split('/')[0]} Position`}>
                                                                        {pos.strategyName || `${pos.symbol.split('/')[0]} Position`}
                                                                    </CardTitle>
                                                                    <div className="flex justify-end gap-1.5 shrink-0 flex-wrap">
                                                                        {/* Shadow Badge */}
                                                                        {pos.type === 'SHADOW' && (
                                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
                                                                                <Eye className="h-2.5 w-2.5" />
                                                                                SHADOW
                                                                            </div>
                                                                        )}
                                                                        {/* Direction Badge */}
                                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                                            metrics.positionType === 'LONG' 
                                                                            ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                                                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                                        }`}>
                                                                            {metrics.positionType === 'LONG' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                                            {metrics.positionType}
                                                                        </div>
                                                                        {/* Status Badge */}
                                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                            isActive
                                                                            ? 'bg-blue-500/5 text-blue-600 border-blue-200 dark:border-blue-900/50 dark:text-blue-400'
                                                                            : 'bg-muted/50 text-muted-foreground border-border'
                                                                        }`}>
                                                                            <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} />
                                                                            {isActive ? 'UNREALIZED' : 'REALIZED'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <p 
                                                                        className="text-sm text-foreground/80 font-mono font-medium hover:text-primary transition-colors cursor-pointer"
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/assets/${pos.symbol.replace('/', '_')}`); }}
                                                                    >
                                                                        {pos.symbol}
                                                                    </p>
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
                                                                        <span className="font-mono text-sm font-bold">
                                                                            {metrics.totalRemaining} <span className="text-muted-foreground text-[10px]">{pos.symbol.split('/')[0]}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-xs text-muted-foreground mb-1">{isActive && metrics.currentPrice > 0 ? 'Current Price' : 'Avg Cost'}</span>
                                                                        <span className="font-mono text-sm font-bold">
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

                                                                {/* Primary Metrics: Unrealized PnL and ROI (Cleaner, unboxed version) */}
                                                                <div className="mt-2 pt-4 border-t border-border/30 flex justify-between items-center">
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
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>
        </div>
    )
}
