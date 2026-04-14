import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useStrategyStore } from "@/store/useStrategyStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics } from "@/lib/metrics"
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
import { SwipeActions } from "@/components/shared/SwipeActions"
import { ArrowLeft, Archive, Play, Pencil, Trash2, LinkIcon, X, AlertCircle, Target, Calendar, Circle, EllipsisVertical, Plus } from "lucide-react"
import { label, pnlColor, sectionHeader } from "@/lib/styles"
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

    if (!strategy) {
        return (
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    {strategy === undefined ? "Loading..." : "Strategy not found."}
                </div>
            </div>
        )
    }

    // Positions not linked to any strategy (available to link)
    const unlinkedPositions = allPositions?.filter(p => !p.strategyId && p.status === 'OPEN') ?? []

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
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 min-h-full">
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
                            <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                                <span>Created: {format(new Date(strategy.createdAt), "yyyy/MM/dd")}</span>
                            </div>
                            {totalPositions > 0 && (
                                <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                    <Target className="h-3 w-3 md:h-4 md:w-4" />
                                    <span>{totalPositions} {totalPositions === 1 ? 'position' : 'positions'}{openPositions > 0 ? ` · ${openPositions} open` : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* Description (notes-style) */}
                        {strategy.description && (
                            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-muted/30 rounded-lg border border-border/50 text-xs md:text-sm text-muted-foreground w-full max-w-2xl break-words">
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
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Total P&L</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(totalPnL)}`}>
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
                                        { icon: <X className="h-4 w-4" />, bg: "bg-rose-500", onAction: () => unassignPositionFromStrategy(pos.id) },
                                    ]}
                                >
                                    <div
                                        className="flex items-center justify-between p-3 border border-border/50 bg-card hover:bg-card/80 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/positions/${pos.id}`)}
                                    >
                                        <div className="flex gap-3 md:gap-4 items-center min-w-0">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Target className="h-3.5 w-3.5 text-primary" />
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

                    {/* Link more / empty state */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border/50 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/30 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                {totalPositions === 0 ? 'Link Position' : 'Link More'}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="center">
                            {unlinkedPositions.length === 0 ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-2 px-2 py-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    No unlinked open positions.
                                </p>
                            ) : (
                                <div className="max-h-60 overflow-y-auto space-y-0.5">
                                    {unlinkedPositions.map(p => (
                                        <button
                                            key={p.id}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                                            onClick={() => assignPositionToStrategy(p.id, strategy.id)}
                                        >
                                            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="truncate">{p.strategyName || p.symbol}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

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
