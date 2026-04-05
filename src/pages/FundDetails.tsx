import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useFundStore } from "@/store/useFundStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics, getFundMetrics, comparePositionsByMetrics } from "@/lib/metrics"
import type { Position } from "@/lib/types"
import { format } from "date-fns"
import { ArrowLeft, Edit, Trash2, X, Layers, Link as LinkIcon, Eye, AlertCircle, TrendingUp, TrendingDown, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FundForm } from "@/components/funds/FundForm"

export default function FundDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { deleteFund, assignPositionToFund, unassignPosition } = useFundStore()
    const { prices, pairConfigs } = useSettingsStore()

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const { setMobileHeader } = useMobileHeader()

    const fund = useLiveQuery(() => id ? db.funds.get(id) : undefined, [id])
    const allPositions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    useEffect(() => {
        setMobileHeader({
            title: fund?.name ?? "Fund",
            leftAction: (
                <button
                    onClick={() => navigate('/funds')}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
            ),
            rightActions: (
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                        aria-label="Edit"
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            ),
        })
    }, [fund, navigate, setMobileHeader, setIsDeleteConfirmOpen])

    const getPosMetrics = useCallback((pos: Position) => {
        const linkedTxIds = new Set(pos.entries.map((e) => e.transactionId))
        const linkedTxs = transactions?.filter(tx => linkedTxIds.has(tx.id)) ?? []
        return getPositionMetrics(pos, linkedTxs, prices)
    }, [transactions, prices])

    if (!fund) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[50vh]">
                <div className="text-muted-foreground text-sm">
                    {fund === null ? "Fund not found." : "Loading…"}
                </div>
            </div>
        )
    }

    const fundPositions = allPositions?.filter(p => p.fundId === id) ?? []
    const unassignedPositions = allPositions?.filter(p => !p.fundId) ?? []

    const allPosMetrics = fundPositions.map(getPosMetrics)
    const unassignedPosMetrics = unassignedPositions.map(getPosMetrics)

    const sortedFundPositions = fundPositions.map((pos, i) => ({ pos, metrics: allPosMetrics[i] })).sort(comparePositionsByMetrics)
    const sortedUnassignedPositions = unassignedPositions.map((pos, i) => ({ pos, metrics: unassignedPosMetrics[i] })).sort(comparePositionsByMetrics)
    const fundM = getFundMetrics(fund, allPosMetrics)
    const { assetsValue, cashValue } = fundM

    const executeDelete = async () => {
        await deleteFund(fund.id)
        navigate('/funds')
    }

    const handleAssign = async (positionId: string) => {
        await assignPositionToFund(positionId, fund.id)
    }

    const fmtNum = (n: number) =>
        n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const navUp = fundM.navChangePct >= 0

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Back nav (desktop only) */}
            <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex gap-2 mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/funds')}
            >
                <ArrowLeft className="h-4 w-4" />
                Funds
            </Button>

            {/* Header (desktop only — mobile uses MobileHeader) */}
            <div className="hidden md:flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                        <h1 className="text-2xl font-bold tracking-tight">{fund.name}</h1>
                    </div>
                    {fund.description && (
                        <p className="text-sm text-muted-foreground">{fund.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setIsEditOpen(true)}>
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Fund</DialogTitle>
                        <DialogDescription className="pt-2">
                            Delete &quot;{fund.name}&quot;? All positions will be unassigned but not deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={executeDelete}>Delete</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Single Edit dialog — triggered by desktop buttons and mobile header */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Fund</DialogTitle>
                    </DialogHeader>
                    <FundForm initialValues={fund} onSuccess={() => setIsEditOpen(false)} />
                </DialogContent>
            </Dialog>

            {/* NAV metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Initial Amount</p>
                    <p className="text-xl font-bold font-mono">{fmtNum(fund.initialAmount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fund.currency}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                    <p className="text-xl font-bold font-mono">{fmtNum(fundM.currentValue)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fund.currency}</p>
                    <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Assets</span>
                            <span className="font-mono text-foreground/80">{fmtNum(assetsValue)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Cash</span>
                            <span className="font-mono text-foreground/80">{fmtNum(cashValue)}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">NAV / Share</p>
                    <p className="text-xl font-bold font-mono">{fundM.currentNAV.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Initial: {fundM.initialNAV.toFixed(4)}
                    </p>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">NAV Change</p>
                    <p className={`text-xl font-bold font-mono ${navUp ? 'text-green-500' : 'text-destructive'}`}>
                        {navUp ? '+' : ''}{fundM.navChangePct.toFixed(2)}%
                    </p>
                    <p className={`text-[10px] mt-0.5 font-mono ${fundM.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {fundM.totalPnL >= 0 ? '+' : ''}{fmtNum(fundM.totalPnL)} PnL
                    </p>
                </div>
            </div>

            {/* Positions section — two-column layout mirrors PositionDetails */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: assigned positions */}
                <div className="lg:col-span-2">
                    <h2 className="text-base font-semibold mb-3">
                        Linked Positions
                        <span className="ml-2 text-sm text-muted-foreground font-normal">({fundPositions.length})</span>
                    </h2>
                    {fundPositions.length === 0 ? (
                        <div className="border border-dashed border-border/50 rounded-xl p-8 text-center">
                            <p className="text-sm text-muted-foreground">No positions linked yet. Link them from the right panel.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedFundPositions.map(({ pos, metrics }) => {
                                const posValue = metrics.totalRemaining !== 0 && metrics.currentPrice > 0 ? metrics.totalRemaining * metrics.currentPrice : 0
                                const alloc = fundM.currentValue > 0 ? (posValue / fundM.currentValue * 100) : 0
                                const isLong = metrics.positionType === 'LONG'
                                const posCurrencySymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                                return (
                                    <div key={pos.id} className="p-3 rounded-xl border bg-background/40 hover:bg-background/80 transition-colors">
                                        {/* Row 1: badges + name + actions */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`shrink-0 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                                                    pos.status === 'OPEN'
                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {pos.status}
                                                </span>
                                                <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                                                    isLong
                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                }`}>
                                                    {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                    {metrics.positionType}
                                                </span>
                                                <p className="font-medium text-sm truncate">{pos.strategyName || pos.symbol}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => navigate(`/positions/${pos.id}`)}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => unassignPosition(pos.id)} title="Remove from fund">
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Row 2: metrics */}
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                                            <span className="font-mono text-muted-foreground">{pos.symbol}</span>
                                            <span className="text-muted-foreground/40">•</span>
                                            <span className="text-muted-foreground">{pos.entries.length} trade{pos.entries.length !== 1 ? 's' : ''}</span>
                                            <span className="text-muted-foreground/40">•</span>
                                            <span className={`font-semibold font-mono ${metrics.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                PnL {metrics.totalPnL >= 0 ? '+' : ''}{fmtNum(metrics.totalPnL)}
                                            </span>
                                            <span className={`font-mono ${metrics.roi >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                ({metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(2)}%)
                                            </span>
                                            <span className="text-muted-foreground/40">•</span>
                                            {alloc !== 0 && <span className="text-muted-foreground">{alloc > 0 ? '+' : ''}{alloc.toFixed(1)}% alloc</span>}
                                        </div>
                                        {/* Row 3: price info */}
                                        {metrics.avgBuyPrice > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                                                <span>Avg Buy <span className="text-foreground/70">{posCurrencySymbol}{metrics.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>
                                                {metrics.avgSellPrice > 0 && <span>Avg Sell <span className="text-foreground/70">{posCurrencySymbol}{metrics.avgSellPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>}
                                                {metrics.totalRemaining !== 0 && <span>Holding <span className="text-foreground/70">{metrics.totalRemaining.toLocaleString()}</span></span>}
                                            </div>
                                        )}
                                        {/* Row 4: dates */}
                                        <div className="mt-1 flex items-center gap-x-3 text-[10px] text-muted-foreground font-mono">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : '—'}
                                            </span>
                                            <span className="text-muted-foreground/40">→</span>
                                            <span>{metrics.derivedEndDate ? format(new Date(metrics.derivedEndDate), "yyyy/MM/dd") : <span className="text-blue-500 dark:text-blue-400">Open</span>}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Right: available positions panel */}
                <div className="bg-card rounded-xl p-6 border shadow-sm">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Available Positions</h3>
                    <div className="space-y-3">
                        {unassignedPositions.length === 0 ? (
                            <p className="text-muted-foreground text-sm flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                No unassigned positions.
                            </p>
                        ) : (
                            sortedUnassignedPositions.map(({ pos, metrics }) => {
                                const isLong = metrics.positionType === 'LONG'
                                const unassignedCurrencySymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                                const posCurrency = pairConfigs.find(c => c.pair === pos.symbol)?.currency ?? 'USD'
                                const currencyMismatch = posCurrency !== fund.currency
                                return (
                                    <div key={pos.id} className="p-3 border rounded-lg hover:border-primary/50 transition-colors bg-background/50">
                                        {/* Row 1: badges + name + actions */}
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                                                    pos.status === 'OPEN'
                                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                    : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    {pos.status}
                                                </span>
                                                <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                                                    isLong
                                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                }`}>
                                                    {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                    {metrics.positionType}
                                                </span>
                                                <p className="font-medium text-xs truncate">{pos.strategyName || pos.symbol}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/positions/${pos.id}`)}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className={`h-7 text-xs gap-1 ${currencyMismatch ? 'border border-amber-500/40' : ''}`}
                                                    onClick={() => handleAssign(pos.id)}
                                                    title={currencyMismatch ? `Currency mismatch: position uses ${posCurrency}, fund uses ${fund.currency}` : undefined}
                                                >
                                                    <LinkIcon className="h-3 w-3" /> Link
                                                    {currencyMismatch && <AlertCircle className="h-3 w-3 text-amber-500" />}
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Row 2: metrics */}
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                                            <span className="font-mono text-muted-foreground">{pos.symbol}</span>
                                            <span className="text-muted-foreground/40">•</span>
                                            <span className="text-muted-foreground">{pos.entries.length} trade{pos.entries.length !== 1 ? 's' : ''}</span>
                                            {metrics.totalPnL !== 0 && (
                                                <>
                                                    <span className="text-muted-foreground/40">•</span>
                                                    <span className={`font-mono font-semibold ${metrics.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                        {metrics.totalPnL >= 0 ? '+' : ''}{fmtNum(metrics.totalPnL)}
                                                        <span className="font-normal ml-0.5">({metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(1)}%)</span>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {metrics.avgBuyPrice > 0 && (
                                            <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                                                Avg Buy <span className="text-foreground/70">{unassignedCurrencySymbol}{metrics.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                {metrics.totalRemaining !== 0 && <span className="ml-2">Holding <span className="text-foreground/70">{metrics.totalRemaining.toLocaleString()}</span></span>}
                                            </div>
                                        )}
                                        {/* Dates */}
                                        <div className="mt-1 flex items-center gap-x-3 text-[10px] text-muted-foreground font-mono">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : '—'}
                                            </span>
                                            <span className="text-muted-foreground/40">→</span>
                                            <span>{metrics.derivedEndDate ? format(new Date(metrics.derivedEndDate), "yyyy/MM/dd") : <span className="text-blue-500 dark:text-blue-400">Open</span>}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
