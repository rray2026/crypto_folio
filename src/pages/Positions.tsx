import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { PositionCard } from "@/components/shared/PositionCard"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import type { Position, PositionMetrics } from "@/lib/types"
import { PositionForm } from "@/components/positions/PositionForm"

import { Plus, Target, ChevronDown } from "lucide-react"
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

export default function Positions() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [archivedExpanded, setArchivedExpanded] = useState(false)
    const { setMobileHeader } = useMobileHeader()
    const openAdd = useCallback(() => setIsAddDialogOpen(true), [])
    useEffect(() => {
        setMobileHeader({
            title: "Positions",
            rightActions: (
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="New Position"
                >
                    <Plus className="h-5 w-5" />
                </button>
            ),
        })
    }, [setMobileHeader, openAdd])
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

    const activePositions = positions?.filter(p => p.status === 'OPEN') ?? []
    const archivedPositions = positions?.filter(p => p.status === 'CLOSED') ?? []

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
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your trading strategies and group trades.</p>
                </div>
                <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New Position
                </Button>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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

            {!positions?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center mt-6">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Target className="h-7 w-7 text-primary/60" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">No strategies yet</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                        A position groups related trades under a strategy so you can track their combined P&L and ROI.
                    </p>
                    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Create Your First Strategy
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {activePositions.length > 0 ? (
                        renderPositionGrid(activePositions)
                    ) : (
                        <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card/50 font-medium">
                            No active strategies.
                        </div>
                    )}

                    {archivedPositions.length > 0 && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setArchivedExpanded(prev => !prev)}
                                className="flex items-center gap-2 w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform ${archivedExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                Archived ({archivedPositions.length})
                            </button>
                            {archivedExpanded && renderPositionGrid(archivedPositions)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
