import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useStrategyStore } from "@/store/useStrategyStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics, comparePositionsByMetrics } from "@/lib/metrics"
import type { Position } from "@/lib/types"
import { StrategyForm } from "@/components/strategies/StrategyForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
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
import { SwipeActions } from "@/components/shared/SwipeActions"
import { ArrowLeft, Archive, Play, Pencil, Trash2, LinkIcon, X, Target, Calendar, Circle, EllipsisVertical, Plus, Check, TrendingUp, TrendingDown } from "lucide-react"
import { badge, dirBadgeColor, statusBadgeColor, label, pnlColor, sectionHeader, dialogItem } from "@/lib/styles"
import { format } from "date-fns"

export default function StrategyDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { setMobileHeader } = useMobileHeader()
    const { updateStrategy, deleteStrategy, assignPositionToStrategy, unassignPositionFromStrategy } = useStrategyStore()
    const { prices, pairConfigs } = useSettingsStore()

    const strategy = useLiveQuery(() => id ? db.strategies.get(id) : undefined, [id])
    const linkedPositions = useLiveQuery(
        () => id ? db.positions.where('strategyId').equals(id).toArray() : [],
        [id]
    )
    const allPositions = useLiveQuery(() => db.positions.toArray())
    const allTransactions = useLiveQuery(() => db.transactions.toArray())

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
    const [selectedPosIds, setSelectedPosIds] = useState<Set<string>>(new Set())
    const [linkTimeFilter, setLinkTimeFilter] = useState<'7D' | '1M' | '6M' | 'ALL'>('ALL')

    const toggleStatus = useCallback(async () => {
        if (!strategy) return
        await updateStrategy(strategy.id, {
            status: strategy.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
        })
    }, [strategy, updateStrategy])

    const handleDelete = useCallback(async () => {
        if (!strategy) return
        await deleteStrategy(strategy.id)
        navigate('/strategies', { replace: true })
    }, [strategy, deleteStrategy, navigate])

    const getPosMetrics = useCallback((pos: Position) => {
        const linkedTxIds = new Set(pos.entries.map((e) => e.transactionId))
        const linkedTxs = allTransactions?.filter(tx => linkedTxIds.has(tx.id)) ?? []
        return getPositionMetrics(pos, linkedTxs, prices)
    }, [allTransactions, prices])

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
            await assignPositionToStrategy(posId, id)
        }
        setSelectedPosIds(new Set())
        setIsLinkDialogOpen(false)
    }, [id, selectedPosIds, assignPositionToStrategy])

    const now = useState(() => Date.now())[0]

    useEffect(() => {
        setMobileHeader({
            title: strategy?.name ?? "Strategy",
            leftAction: (
                <button
                    onClick={() => navigate(-1)}
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
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                            Edit
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); toggleStatus(); }}
                        >
                            {strategy?.status === 'ACTIVE'
                                ? <><Archive className="h-4 w-4 text-muted-foreground" /> Archive</>
                                : <><Play className="h-4 w-4 text-muted-foreground" /> Activate</>
                            }
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
    }, [setMobileHeader, navigate, strategy?.name, strategy?.status, isMobileMenuOpen, toggleStatus])

    // Positions not linked to any strategy (available to link)
    const unassignedPositions = useMemo(
        () => allPositions?.filter(p => !p.strategyId) ?? [],
        [allPositions]
    )

    const filteredUnassigned = useMemo(() => {
        if (linkTimeFilter === 'ALL') return unassignedPositions
        const cutoff = {
            '7D': now - 7 * 24 * 60 * 60 * 1000,
            '1M': now - 30 * 24 * 60 * 60 * 1000,
            '6M': now - 180 * 24 * 60 * 60 * 1000,
        }[linkTimeFilter]
        return unassignedPositions.filter(pos => {
            const m = getPosMetrics(pos)
            return (m.derivedStartDate || pos.startDate) >= cutoff
        })
    }, [unassignedPositions, linkTimeFilter, now, getPosMetrics])

    if (!strategy) {
        return (
            <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    {strategy === undefined ? "Loading..." : "Strategy not found."}
                </div>
            </div>
        )
    }

    // Metrics for linked positions
    const positionMetrics = (linkedPositions ?? []).map(pos => {
        const txs = (allTransactions ?? []).filter(t => pos.entries.some(e => e.transactionId === t.id))
        return {
            position: pos,
            metrics: getPositionMetrics(pos, txs, prices),
        }
    })

    const totalPositions = positionMetrics.length
    const openPositions = positionMetrics.filter(p => p.position.status === 'OPEN').length
    const closedPositions = positionMetrics.filter(p => p.position.status === 'CLOSED')
    const profitablePositions = closedPositions.filter(p => p.metrics.totalPnL > 0)
    const winRate = closedPositions.length > 0
        ? ((profitablePositions.length / closedPositions.length) * 100).toFixed(0)
        : '—'
    const avgRoi = positionMetrics.length > 0
        ? (positionMetrics.reduce((sum, p) => sum + p.metrics.roi, 0) / positionMetrics.length).toFixed(1)
        : '—'
    const totalPnL = positionMetrics.reduce((sum, p) => sum + p.metrics.totalPnL, 0)
    const totalRealizedPnL = positionMetrics.reduce((sum, p) => sum + p.metrics.realizedPnL, 0)
    const totalUnrealizedPnL = positionMetrics.reduce((sum, p) => sum + p.metrics.unrealizedPnL, 0)

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto flex flex-col gap-6 md:gap-8 min-h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-2 md:gap-4 flex-col sm:flex-row w-full">
                    <Button variant="ghost" size="icon" className="hidden md:inline-flex shrink-0 self-start mt-1" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 w-full min-w-0">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="space-y-1">
                                <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{strategy.name}</h1>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Status Badge */}
                                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] md:text-xs font-semibold border ${
                                    strategy.status === 'ACTIVE'
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : 'text-muted-foreground border-border'
                                }`}>
                                    <Circle className={`h-1.5 w-1.5 fill-current ${strategy.status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                                    {strategy.status}
                                </span>
                            </div>
                        </div>

                        {/* Info chips */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground font-mono">
                            <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-lg px-1.5 md:px-2 py-1 border border-border/20">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                                <span>Created: {format(new Date(strategy.createdAt), "yyyy/MM/dd")}</span>
                            </div>
                            {totalPositions > 0 && (
                                <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-lg px-1.5 md:px-2 py-1 border border-border/20">
                                    <Target className="h-3 w-3 md:h-4 md:w-4" />
                                    <span>{totalPositions} {totalPositions === 1 ? 'position' : 'positions'}{openPositions > 0 ? ` · ${openPositions} open` : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* Description (notes-style) */}
                        {strategy.description && (
                            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-muted/30 rounded-xl border border-border/20 text-xs md:text-sm text-muted-foreground w-full max-w-2xl break-words">
                                <span className="font-semibold text-foreground/80 mr-2">Description:</span>
                                {strategy.description}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop action buttons */}
                <div className="hidden md:flex items-center gap-2 self-start">
                    <Button variant={strategy.status === 'ACTIVE' ? 'secondary' : 'default'} onClick={toggleStatus} className="gap-2">
                        {strategy.status === 'ACTIVE'
                            ? <><Archive className="h-4 w-4" /> Archive</>
                            : <><Play className="h-4 w-4" /> Activate</>
                        }
                    </Button>
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => setIsEditOpen(true)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => setIsDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Stats Card */}
            <Card className="overflow-hidden border-border/20 shadow-ambient rounded-2xl impressionist-card">
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Total P&L</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(totalPnL)} ${totalPnL > 0 ? 'pnl-glow-up' : totalPnL < 0 ? 'pnl-glow-down' : ''}`}>
                                {totalPnL !== 0 ? `$${totalPnL > 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Realized PnL</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(totalRealizedPnL)}`}>
                                {totalRealizedPnL !== 0 ? `$${totalRealizedPnL > 0 ? '+' : ''}${totalRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Unrealized PnL</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(totalUnrealizedPnL)}`}>
                                {totalUnrealizedPnL !== 0 ? `$${totalUnrealizedPnL > 0 ? '+' : ''}${totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Win Rate</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {winRate}{winRate !== '—' && '%'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Avg ROI</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${avgRoi !== '—' ? pnlColor(parseFloat(avgRoi)) : ''}`}>
                                {avgRoi !== '—' ? `${parseFloat(avgRoi) > 0 ? '+' : ''}${avgRoi}%` : '—'}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Closed / Total</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {closedPositions.length} / {totalPositions}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Linked Positions */}
            <div className="space-y-1.5">
                <span className={sectionHeader}>
                    Linked Positions ({totalPositions})
                </span>
                <div className="space-y-3">
                    {(linkedPositions ?? []).map(pos => {
                        const pm = positionMetrics.find(p => p.position.id === pos.id)
                        const currSymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                        return (
                            <div key={pos.id}>
                                <SwipeActions
                                    actions={[
                                        { icon: <X className="h-4 w-4" />, bg: "bg-muted-foreground", onAction: () => unassignPositionFromStrategy(pos.id) },
                                    ]}
                                >
                                    <div
                                        className="flex items-center justify-between p-3 border border-border/20 bg-card impressionist-card hover:bg-card/80 transition-all duration-300 ease-out group cursor-pointer"
                                        onClick={() => navigate(`/positions/${pos.id}`)}
                                    >
                                        <div className="flex gap-3 md:gap-4 items-center min-w-0">
                                            <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                                                <Target className="h-3.5 w-3.5 text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <p className="text-sm font-semibold truncate">{pos.strategyName || pos.symbol}</p>
                                                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                    <span>{pos.symbol}</span>
                                                    <span className="opacity-50">·</span>
                                                    <span className={`font-semibold ${pos.status === 'OPEN' ? 'text-primary' : 'text-muted-foreground'}`}>{pos.status}</span>
                                                    {pm && (
                                                        <>
                                                            <span className="opacity-50">·</span>
                                                            <span className={`font-semibold ${pnlColor(pm.metrics.roi)}`}>
                                                                ROI {pm.metrics.roi > 0 ? '+' : ''}{pm.metrics.roi.toFixed(1)}%
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            {pm && (
                                                <span className={`text-sm font-bold font-mono ${pnlColor(pm.metrics.totalPnL)}`}>
                                                    {currSymbol}{pm.metrics.totalPnL > 0 ? '+' : ''}{pm.metrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            )}
                                            {/* Desktop only: hover-reveal unlink */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); unassignPositionFromStrategy(pos.id); }}
                                                className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </SwipeActions>
                            </div>
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
                        className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border/40 rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 hover:shadow-ambient transition-all duration-300 ease-out"
                    >
                        <Plus className="h-4 w-4" />
                        {totalPositions === 0 ? 'Link Positions' : 'Link More'}
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
                            Select unassigned positions to add to this strategy.
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
                                            className={dialogItem(isSelected)}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`shrink-0 ${badge({ color: statusBadgeColor(pos.status) })}`}>
                                                        {pos.status}
                                                    </span>
                                                    <span className={`shrink-0 ${badge({ color: dirBadgeColor(metrics.positionType) })}`}>
                                                        {isLong ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                                        {metrics.positionType}
                                                    </span>
                                                    <p className="font-semibold text-sm truncate">{pos.strategyName || pos.symbol}</p>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                            </div>
                                            {/* Metrics row */}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                                                <span className="font-mono text-muted-foreground">{pos.symbol}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className="text-muted-foreground">{pos.entries.length} trade{pos.entries.length !== 1 ? 's' : ''}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span className={`font-semibold font-mono ${pnlColor(metrics.totalPnL)}`}>
                                                    PnL {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                <span className={`font-mono ${pnlColor(metrics.roi)}`}>
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
                                                <span>{metrics.derivedEndDate ? format(new Date(metrics.derivedEndDate), "yyyy/MM/dd") : <span className="text-foreground font-medium">Open</span>}</span>
                                            </div>
                                        </button>
                                    )
                                })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <div className="border border-dashed border-border/30 rounded-2xl p-8 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        {unassignedPositions.length > 0
                                            ? 'No positions in this time range.'
                                            : 'No unassigned positions available.'}
                                    </p>
                                    {unassignedPositions.length === 0 && (
                                        <p className="text-xs text-muted-foreground/60 mt-1">
                                            Create a position first, or unlink one from another strategy.
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
                                className="w-full h-11 rounded-xl font-bold gap-2 shadow-lg"
                                onClick={handleBulkAssign}
                            >
                                <LinkIcon className="h-4 w-4" />
                                Link {selectedPosIds.size} {selectedPosIds.size === 1 ? 'Position' : 'Positions'}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Edit Strategy</DialogTitle>
                    </DialogHeader>
                    <StrategyForm initialValues={strategy} onSuccess={() => setIsEditOpen(false)} />
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Strategy?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete <strong>{strategy.name}</strong> and unlink all associated positions. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
