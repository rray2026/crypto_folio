import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useStrategyStore } from "@/store/useStrategyStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics } from "@/lib/metrics"
import { StrategyForm } from "@/components/strategies/StrategyForm"
import { Button } from "@/components/ui/button"
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
import { ArrowLeft, Archive, Play, Pencil, Trash2, LinkIcon, X, AlertCircle, Target } from "lucide-react"

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

    useEffect(() => {
        setMobileHeader({
            title: strategy?.name ?? "Strategy",
            leftAction: (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            ),
        })
    }, [setMobileHeader, navigate, strategy?.name])

    if (!strategy) {
        return (
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    {strategy === undefined ? "Loading..." : "Strategy not found."}
                </div>
            </div>
        )
    }

    const toggleStatus = async () => {
        await updateStrategy(strategy.id, {
            status: strategy.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
        })
    }

    const handleDelete = async () => {
        await deleteStrategy(strategy.id)
        navigate('/strategies', { replace: true })
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
    const closedPositions = positionMetrics.filter(p => p.position.status === 'CLOSED')
    const profitablePositions = closedPositions.filter(p => p.metrics.totalPnL > 0)
    const winRate = closedPositions.length > 0
        ? ((profitablePositions.length / closedPositions.length) * 100).toFixed(0)
        : '—'
    const avgRoi = positionMetrics.length > 0
        ? (positionMetrics.reduce((sum, p) => sum + p.metrics.roi, 0) / positionMetrics.length).toFixed(1)
        : '—'
    const totalPnL = positionMetrics.reduce((sum, p) => sum + p.metrics.totalPnL, 0)

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{strategy.name}</h1>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                strategy.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-muted text-muted-foreground'
                            }`}>
                                {strategy.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Created {new Date(strategy.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={toggleStatus} className="gap-2">
                        {strategy.status === 'ACTIVE'
                            ? <><Archive className="h-4 w-4" /> Archive</>
                            : <><Play className="h-4 w-4" /> Activate</>
                        }
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
                        <Pencil className="h-4 w-4" /> Edit
                    </Button>
                </div>
            </div>

            {/* Mobile status + actions */}
            <div className="md:hidden space-y-4">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        strategy.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {strategy.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Created {new Date(strategy.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={toggleStatus} className="gap-1.5 flex-1">
                        {strategy.status === 'ACTIVE'
                            ? <><Archive className="h-3.5 w-3.5" /> Archive</>
                            : <><Play className="h-3.5 w-3.5" /> Activate</>
                        }
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)} className="gap-1.5 flex-1">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsDeleteConfirmOpen(true)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Description */}
            {strategy.description && (
                <div className="bg-card rounded-xl border border-border/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Description</p>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{strategy.description}</p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-card rounded-xl border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Positions</p>
                    <p className="text-xl font-bold font-mono">{totalPositions}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Win Rate</p>
                    <p className="text-xl font-bold font-mono">{winRate}{winRate !== '—' && '%'}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Avg ROI</p>
                    <p className="text-xl font-bold font-mono">{avgRoi}{avgRoi !== '—' && '%'}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Total P&L</p>
                    <p className={`text-xl font-bold font-mono ${totalPnL > 0 ? 'text-emerald-500' : totalPnL < 0 ? 'text-rose-500' : ''}`}>
                        {totalPnL !== 0 ? `$${totalPnL > 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </p>
                </div>
            </div>

            {/* Linked Positions */}
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                    <h3 className="text-sm font-semibold">Linked Positions</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                                <LinkIcon className="h-3 w-3" /> Link
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            {unlinkedPositions.length === 0 ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-2 px-2 py-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    No unlinked open positions.
                                </p>
                            ) : (
                                unlinkedPositions.map(p => (
                                    <button
                                        key={p.id}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                                        onClick={() => assignPositionToStrategy(p.id, strategy.id)}
                                    >
                                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{p.strategyName || p.symbol}</span>
                                    </button>
                                ))
                            )}
                        </PopoverContent>
                    </Popover>
                </div>

                {(linkedPositions ?? []).length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                        No positions linked to this strategy yet.
                    </div>
                ) : (
                    <div>
                        {(linkedPositions ?? []).map((pos, i) => {
                            const pm = positionMetrics.find(p => p.position.id === pos.id)
                            const currSymbol = getCurrencySymbolForPair(pos.symbol, pairConfigs)
                            return (
                                <div
                                    key={pos.id}
                                    className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${
                                        i < (linkedPositions?.length ?? 0) - 1 ? 'border-b border-border/20' : ''
                                    }`}
                                >
                                    <button
                                        onClick={() => navigate(`/positions/${pos.id}`)}
                                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Target className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">{pos.strategyName || pos.symbol}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {pos.symbol} · {pos.status}
                                                {pm && ` · ROI ${pm.metrics.roi > 0 ? '+' : ''}${pm.metrics.roi.toFixed(1)}%`}
                                            </p>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {pm && (
                                            <span className={`text-sm font-bold font-mono ${pm.metrics.totalPnL > 0 ? 'text-emerald-500' : pm.metrics.totalPnL < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                                {currSymbol}{pm.metrics.totalPnL > 0 ? '+' : ''}{pm.metrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => unassignPositionFromStrategy(pos.id)}
                                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Delete (desktop) */}
            <div className="hidden md:flex justify-end">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete Strategy
                </Button>
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
