import { useState, useEffect } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { PositionCard } from "@/components/shared/PositionCard"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair, getCurrencySymbol } from "@/store/useSettingsStore"
import type { Position, PositionMetrics } from "@/lib/types"
import { PositionForm } from "@/components/positions/PositionForm"
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog"

import { Card, CardContent } from "@/components/ui/card"
import { Plus, Target, ChevronDown, LineChart, ReceiptText } from "lucide-react"
import { label, pnlColor } from "@/lib/styles"
import { differenceInDays } from "date-fns"
import { getPositionMetrics, comparePositionsByMetrics } from "@/lib/metrics"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function Positions() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isAddTxDialogOpen, setIsAddTxDialogOpen] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [closedExpanded, setClosedExpanded] = useState(false)
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => {
        setMobileHeader({
            title: "Positions",
            rightActions: (
                <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                            aria-label="Add"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto min-w-48 p-1" align="end">
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left whitespace-nowrap"
                            onClick={() => { setIsMenuOpen(false); setIsAddDialogOpen(true) }}
                        >
                            <LineChart className="h-4 w-4 text-muted-foreground shrink-0" />
                            Empty Position
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left whitespace-nowrap"
                            onClick={() => { setIsMenuOpen(false); setIsAddTxDialogOpen(true) }}
                        >
                            <ReceiptText className="h-4 w-4 text-muted-foreground shrink-0" />
                            New Transaction
                        </button>
                    </PopoverContent>
                </Popover>
            ),
        })
    }, [setMobileHeader, isMenuOpen])
    const { prices, fetchPrices, pairConfigs } = useSettingsStore()

    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())
    const funds = useLiveQuery(() => db.funds.toArray())
    const fundMap = Object.fromEntries((funds ?? []).map(f => [f.id, f.name]))

    // Fetch prices for all OPEN symbols
    useEffect(() => {
        const interval = setInterval(() => {
            if (!positions) return;
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            if (openSymbols.length > 0) {
                fetchPrices(openSymbols);
            }
        }, 300000);
        return () => clearInterval(interval);
    }, [positions, fetchPrices]);

    // Non-blocking fetch on render if not cached
    useEffect(() => {
        if (positions) {
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            if (openSymbols.length > 0) {
                fetchPrices(openSymbols);
            }
        }
    }, [positions, fetchPrices]);

    const getMetrics = (pos: Position) => {
        if (!transactions) return { realizedPnL: 0, unrealizedPnL: 0, totalPnL: 0, roi: 0, totalInvestment: 0, totalRemaining: 0, currentPrice: 0, positionType: 'LONG' as const, derivedStartDate: pos.startDate, derivedEndDate: pos.endDate, avgBuyPrice: 0, avgSellPrice: 0, breakevenPrice: 0 };
        const linkedTxIds = new Set(pos.entries.map((e) => e.transactionId));
        const linkedTxs = transactions.filter(tx => linkedTxIds.has(tx.id));
        return getPositionMetrics(pos, linkedTxs, prices);
    };

    const now = useState(() => Date.now())[0];

    const openPositions = positions?.filter(p => p.status === 'OPEN') ?? []
    const closedPositions = positions?.filter(p => p.status === 'CLOSED') ?? []

    const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + getMetrics(pos).unrealizedPnL, 0)
    const portfolioCurrencies = new Set(
        openPositions.map(pos => pairConfigs.find(p => p.pair === pos.symbol)?.currency ?? 'USD')
    )
    const singleCurrency = portfolioCurrencies.size === 1 ? [...portfolioCurrencies][0] : 'USD'
    const currSymbol = getCurrencySymbol(singleCurrency)

    const renderPositionGrid = (list: Position[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {list
                .map((pos) => ({ pos, metrics: getMetrics(pos) }))
                .sort(comparePositionsByMetrics)
                .map(({ pos, metrics }: { pos: Position, metrics: PositionMetrics }) => {
                    const duration = metrics.derivedStartDate ? differenceInDays(metrics.derivedEndDate || now, metrics.derivedStartDate) : 0;
                    return (
                        <PositionCard
                            key={pos.id}
                            position={pos}
                            metrics={metrics}
                            isActive={pos.status === 'OPEN'}
                            duration={duration}
                            fundName={pos.fundId ? fundMap[pos.fundId] : undefined}
                            currencySymbol={getCurrencySymbolForPair(pos.symbol, pairConfigs)}
                        />
                    );
                })}
        </div>
    )

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
            <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your positions and group trades.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setIsAddTxDialogOpen(true)}>
                        <ReceiptText className="h-4 w-4" />
                        New Transaction
                    </Button>
                    <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Empty Position
                    </Button>
                </div>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Create Empty Position</DialogTitle>
                        <DialogDescription>
                            Create a placeholder position. You can link trades to it later.
                        </DialogDescription>
                    </DialogHeader>
                    <PositionForm onSuccess={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            {/* Summary bar */}
            {positions && positions.length > 0 && (
                <Card className="overflow-hidden border-border/20 shadow-ambient rounded-2xl mb-6 impressionist-card">
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-2 gap-x-4">
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Open Positions</span>
                                <span className="text-xl sm:text-2xl font-bold font-mono">{openPositions.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Unrealized PnL</span>
                                <span className={`text-xl sm:text-2xl font-bold font-mono ${pnlColor(totalUnrealizedPnL)} ${totalUnrealizedPnL > 0 ? 'pnl-glow-up' : totalUnrealizedPnL < 0 ? 'pnl-glow-down' : ''}`}>
                                    {currSymbol}{totalUnrealizedPnL > 0 ? '+' : ''}{totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!positions?.length ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4 shadow-glow shimmer-accent">
                        <Target className="h-7 w-7 text-primary/70 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">No positions yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                        A position groups related trades so you can track their combined P&L and ROI.
                    </p>
                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5 hover:shadow-ambient transition-all duration-300 ease-out group text-left w-full max-w-sm"
                    >
                        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                            <Plus className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Create Your First Position</p>
                            <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Pick a symbol and start grouping trades to track performance.</p>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {openPositions.length > 0 ? (
                        renderPositionGrid(openPositions)
                    ) : (
                        <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card/50 font-medium">
                            No open positions
                        </div>
                    )}

                    {closedPositions.length > 0 && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setClosedExpanded(prev => !prev)}
                                className="flex items-center gap-3 w-full py-4 group"
                            >
                                <div className="h-px flex-1 bg-border/40" />
                                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${closedExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                    {closedPositions.length} more closed
                                </span>
                                <div className="h-px flex-1 bg-border/40" />
                            </button>
                            {closedExpanded && renderPositionGrid(closedPositions)}
                        </div>
                    )}
                </div>
            )}

            <AddTransactionDialog open={isAddTxDialogOpen} onOpenChange={setIsAddTxDialogOpen} />
        </div>
    )
}
