import { useState, useEffect } from "react"
import { PositionCard } from "@/components/shared/PositionCard"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { mul, add, div } from "@/lib/math"
import { useSettingsStore } from "@/store/useSettingsStore"
import type { Position } from "@/lib/types"
import { PositionForm } from "@/components/positions/PositionForm"

import { Plus, Target, Activity, Wallet, LineChart, TrendingUp } from "lucide-react"
import { differenceInDays } from "date-fns"
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
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Positions() {
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
        positions.forEach((pos: Position) => {
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
                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-md mb-6">
                        <TabsTrigger value="active" className="font-bold tracking-wider">ACTIVE ({positions.filter(p => p.status === 'OPEN').length})</TabsTrigger>
                        <TabsTrigger value="archived" className="font-bold tracking-wider">ARCHIVED ({positions.filter(p => p.status === 'CLOSED').length})</TabsTrigger>
                        <TabsTrigger value="all" className="font-bold tracking-wider">ALL</TabsTrigger>
                    </TabsList>

                    {['active', 'archived', 'all'].map(tab => {
                        const filteredPositions = positions.filter(p => {
                            if (tab === 'active') return p.status === 'OPEN';
                            if (tab === 'archived') return p.status === 'CLOSED';
                            return true; // all
                        });

                        return (
                            <TabsContent value={tab} key={tab}>
                                {filteredPositions.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card/50 font-medium">
                                        No {tab} strategies found.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {filteredPositions
                                            ?.filter((p: any) => {
                                                if (timeThreshold === 0) return true;
                                                const metrics = getMetrics(p);
                                                return (metrics.derivedStartDate || p.startDate) >= timeThreshold;
                                            })
                                            .map((pos: any) => ({ pos, metrics: getMetrics(pos) }))
                                            .sort((a: any, b: any) => (b.metrics.derivedStartDate || b.pos.startDate || 0) - (a.metrics.derivedStartDate || a.pos.startDate || 0))
                                            .map(({ pos, metrics }: { pos: any, metrics: any }) => {
                                                const duration = metrics.derivedStartDate ? differenceInDays(metrics.derivedEndDate || now, metrics.derivedStartDate) : 0;
                                                const isActive = pos.status === 'OPEN';

                                                return (
                                                    <PositionCard 
                                                        key={pos.id}
                                                        position={pos}
                                                        metrics={metrics}
                                                        isActive={isActive}
                                                        duration={duration}
                                                    />
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
