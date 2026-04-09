import { useState, useEffect, useCallback, useMemo } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useFundStore } from "@/store/useFundStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics, getFundMetrics, comparePositionsByMetrics } from "@/lib/metrics"
import type { Position } from "@/lib/types"
import { format } from "date-fns"
import { ArrowLeft, Edit, Trash2, X, Layers, Link as LinkIcon, Eye, Check, TrendingUp, TrendingDown, Calendar, EllipsisVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { FundForm } from "@/components/funds/FundForm"
import { SwipeActions } from "@/components/shared/SwipeActions"

export default function FundDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { deleteFund, assignPositionToFund, unassignPosition } = useFundStore()
    const { prices, pairConfigs } = useSettingsStore()

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
    const [selectedPosIds, setSelectedPosIds] = useState<Set<string>>(new Set())
    const [linkTimeFilter, setLinkTimeFilter] = useState<'7D' | '1M' | '6M' | 'ALL'>('ALL')
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
                <Popover open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                            aria-label="More actions"
                        >
                            <EllipsisVertical className="h-5 w-5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="end">
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); setIsEditOpen(true); }}
                        >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                            Edit
                        </button>
                        <div className="border-t border-border/50 my-1" />
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); setIsDeleteConfirmOpen(true); }}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </PopoverContent>
                </Popover>
            ),
        })
    }, [fund, navigate, setMobileHeader, isMobileMenuOpen])

    const getPosMetrics = useCallback((pos: Position) => {
        const linkedTxIds = new Set(pos.entries.map((e) => e.transactionId))
        const linkedTxs = transactions?.filter(tx => linkedTxIds.has(tx.id)) ?? []
        return getPositionMetrics(pos, linkedTxs, prices)
    }, [transactions, prices])

    const toggleSelectPos = useCallback((posId: string) => {
        setSelectedPosIds(prev => {
            const next = new Set(prev)
            if (next.has(posId)) next.delete(posId)
            else next.add(posId)
            return next
        })
    }, [])

    const handleBulkAssign = useCallback(async () => {
        if (!id || selectedPosIds.size === 0) return
        for (const posId of selectedPosIds) {
            await assignPositionToFund(posId, id)
        }
        setSelectedPosIds(new Set())
        setIsLinkDialogOpen(false)
    }, [id, selectedPosIds, assignPositionToFund])

    const now = useState(() => Date.now())[0]

    const filteredUnassigned = useMemo(() => {
        const list = allPositions?.filter(p => !p.fundId) ?? []
        if (linkTimeFilter === 'ALL') return list
        const cutoff = {
            '7D': now - 7 * 24 * 60 * 60 * 1000,
            '1M': now - 30 * 24 * 60 * 60 * 1000,
            '6M': now - 180 * 24 * 60 * 60 * 1000,
        }[linkTimeFilter]
        return list.filter(pos => {
            const m = getPosMetrics(pos)
            return (m.derivedStartDate || pos.startDate) >= cutoff
        })
    }, [allPositions, linkTimeFilter, now, getPosMetrics])

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

    const sortedFundPositions = fundPositions.map((pos, i) => ({ pos, metrics: allPosMetrics[i] })).sort(comparePositionsByMetrics)
    const fundM = getFundMetrics(fund, allPosMetrics)
    const { assetsValue, cashValue } = fundM

    const executeDelete = async () => {
        await deleteFund(fund.id)
        navigate('/funds')
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
                <div className="bg-card rounded-xl border border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Initial Amount</p>
                    <p className="text-xl font-bold font-mono">{fmtNum(fund.initialAmount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fund.currency}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Value</p>
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
                <div className="bg-card rounded-xl border border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">NAV / Share</p>
                    <p className="text-xl font-bold font-mono">{fundM.currentNAV.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Initial: {fundM.initialNAV.toFixed(4)}
                    </p>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">NAV Change</p>
                    <p className={`text-xl font-bold font-mono ${navUp ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {navUp ? '+' : ''}{fundM.navChangePct.toFixed(2)}%
                    </p>
                    <p className={`text-[10px] mt-0.5 font-mono ${fundM.totalPnL >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {fundM.totalPnL >= 0 ? '+' : ''}{fmtNum(fundM.totalPnL)} PnL
                    </p>
                </div>
            </div>

            {/* Linked Positions */}
            <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-1">
                    Linked Positions ({fundPositions.length})
                </span>
                <div className="space-y-3">
                    {sortedFundPositions.map(({ pos, metrics }) => {
                        const posValue = metrics.totalRemaining !== 0 && metrics.currentPrice > 0 ? metrics.totalRemaining * metrics.currentPrice : 0
                        const alloc = fundM.currentValue > 0 ? (posValue / fundM.currentValue * 100) : 0
                        const isLong = metrics.positionType === 'LONG'
                        const posCurrencySymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                        return (
                            <SwipeActions
                                key={pos.id}
                                actions={[
                                    { icon: <X className="h-4 w-4" />, bg: "bg-red-500", onAction: () => unassignPosition(pos.id) },
                                ]}
                            >
                                <div
                                    className="p-3 border bg-card hover:bg-card/80 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/positions/${pos.id}`)}
                                >
                                    {/* Row 1: badges + name + actions */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                                                pos.status === 'OPEN'
                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                : 'bg-muted text-muted-foreground border-border'
                                            }`}>
                                                {pos.status}
                                            </span>
                                            <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                                                isLong
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40'
                                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40'
                                            }`}>
                                                {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                {metrics.positionType}
                                            </span>
                                            <p className="font-medium text-sm truncate">{pos.strategyName || pos.symbol}</p>
                                        </div>
                                        {/* Desktop only: hover-reveal buttons */}
                                        <div className="hidden md:flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={(e) => { e.stopPropagation(); navigate(`/positions/${pos.id}`); }}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={(e) => { e.stopPropagation(); unassignPosition(pos.id); }} title="Remove from fund">
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
                                        <span className={`font-semibold font-mono ${metrics.totalPnL >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                            PnL {metrics.totalPnL >= 0 ? '+' : ''}{fmtNum(metrics.totalPnL)}
                                        </span>
                                        <span className={`font-mono ${metrics.roi >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
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
                                        <span>{metrics.derivedEndDate ? format(new Date(metrics.derivedEndDate), "yyyy/MM/dd") : <span className="text-primary">Open</span>}</span>
                                    </div>
                                </div>
                            </SwipeActions>
                        )
                    })}

                    {/* Link More */}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedPosIds(new Set())
                            setLinkTimeFilter('ALL')
                            setIsLinkDialogOpen(true)
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border/50 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/30 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {fundPositions.length === 0 ? 'Link Positions' : 'Link More'}
                    </button>
                </div>
            </div>

            {/* Link Positions Dialog */}
            <Dialog open={isLinkDialogOpen} onOpenChange={(open) => {
                setIsLinkDialogOpen(open)
                if (!open) setSelectedPosIds(new Set())
            }}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[480px] h-[70vh] flex flex-col [&>button.absolute]:hidden">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>Link Positions</DialogTitle>
                            <Select value={linkTimeFilter} onValueChange={(val) => setLinkTimeFilter(val as '7D' | '1M' | '6M' | 'ALL')}>
                                <SelectTrigger className="h-8 w-[130px] bg-muted/40 rounded-full border-border/50 text-xs shadow-sm hover:bg-muted/60 transition-colors">
                                    <Calendar className="h-3 w-3 opacity-50" />
                                    <SelectValue placeholder="Range" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="7D">Last 7 Days</SelectItem>
                                    <SelectItem value="1M">Last 1 Month</SelectItem>
                                    <SelectItem value="6M">Last 6 Months</SelectItem>
                                    <SelectItem value="ALL">All Time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Select unassigned positions to add to this fund.
                        </p>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
                        {filteredUnassigned.length > 0 ? (
                            filteredUnassigned
                                .map(pos => ({ pos, metrics: getPosMetrics(pos) }))
                                .sort(comparePositionsByMetrics)
                                .map(({ pos, metrics }) => {
                                    const isSelected = selectedPosIds.has(pos.id)
                                    const isLong = metrics.positionType === 'LONG'
                                    const posCurrencySymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                                    return (
                                        <button
                                            key={pos.id}
                                            type="button"
                                            onClick={() => toggleSelectPos(pos.id)}
                                            className={`w-full p-3 rounded-lg border transition-colors text-left ${
                                                isSelected
                                                    ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                                                    : 'border-border/50 hover:bg-muted/30'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                                                        pos.status === 'OPEN'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-muted text-muted-foreground border-border'
                                                    }`}>
                                                        {pos.status}
                                                    </span>
                                                    <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                                                        isLong
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40'
                                                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40'
                                                    }`}>
                                                        {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                        {metrics.positionType}
                                                    </span>
                                                    <p className="font-medium text-sm truncate">{pos.strategyName || pos.symbol}</p>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                            </div>
                                            {/* Metrics row */}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                                                <span className="font-mono text-muted-foreground">{pos.symbol}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className="text-muted-foreground">{pos.entries.length} trade{pos.entries.length !== 1 ? 's' : ''}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className={`font-semibold font-mono ${metrics.totalPnL >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    PnL {metrics.totalPnL >= 0 ? '+' : ''}{fmtNum(metrics.totalPnL)}
                                                </span>
                                                <span className={`font-mono ${metrics.roi >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    ({metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(2)}%)
                                                </span>
                                            </div>
                                            {/* Price info */}
                                            {metrics.avgBuyPrice > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                                                    <span>Avg Buy <span className="text-foreground/70">{posCurrencySymbol}{metrics.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>
                                                    {metrics.avgSellPrice > 0 && <span>Avg Sell <span className="text-foreground/70">{posCurrencySymbol}{metrics.avgSellPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>}
                                                    {metrics.totalRemaining !== 0 && <span>Holding <span className="text-foreground/70">{metrics.totalRemaining.toLocaleString()}</span></span>}
                                                </div>
                                            )}
                                            {/* Dates */}
                                            <div className="mt-1 flex items-center gap-x-3 text-[10px] text-muted-foreground font-mono">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : '—'}
                                                </span>
                                                <span className="text-muted-foreground/40">→</span>
                                                <span>{metrics.derivedEndDate ? format(new Date(metrics.derivedEndDate), "yyyy/MM/dd") : <span className="text-primary">Open</span>}</span>
                                            </div>
                                        </button>
                                    )
                                })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <div className="border border-dashed border-border/50 rounded-xl p-8 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        {unassignedPositions.length > 0
                                            ? 'No positions in this time range.'
                                            : 'No unassigned positions available.'}
                                    </p>
                                    {unassignedPositions.length === 0 && (
                                        <p className="text-xs text-muted-foreground/60 mt-1">
                                            Create a position first, or unlink one from another fund.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm footer */}
                    {selectedPosIds.size > 0 && (
                        <div className="pt-3 border-t border-border/40">
                            <Button
                                className="w-full h-11 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
                                onClick={handleBulkAssign}
                            >
                                <LinkIcon className="h-4 w-4" />
                                Link {selectedPosIds.size} {selectedPosIds.size === 1 ? 'Position' : 'Positions'}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
