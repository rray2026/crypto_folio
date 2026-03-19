import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { differenceInDays, format } from "date-fns"
import { ArrowLeft, Trash2, Link as LinkIcon, AlertCircle, Edit, Play, Square, Calendar, Clock, TrendingUp, TrendingDown, Circle, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { PositionEditForm } from "@/components/positions/PositionEditForm"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { useState } from "react"
import { getPositionMetrics } from "@/lib/metrics"
import { PullToRefresh } from "@/components/ui/PullToRefresh"

export default function PositionDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const addTransactionToPosition = usePositionStore(state => state.addTransactionToPosition)
    const removeTransactionFromPosition = usePositionStore(state => state.removeTransactionFromPosition)
    const closePosition = usePositionStore(state => state.closePosition)
    const openPosition = usePositionStore(state => state.openPosition)
    const deletePosition = usePositionStore(state => state.deletePosition)
    const { prices, fetchPrices } = useSettingsStore()

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingTxId, setEditingTxId] = useState<string | null>(null)

    const position = useLiveQuery(() => id ? db.positions.get(id) : undefined, [id])
    const allTransactions = useLiveQuery(() => db.transactions.toArray())
    const allPositions = useLiveQuery(() => db.positions.toArray())

    // Fetch live price for the current symbol if OPEN (every 5 mins)
    useState(() => {
        const interval = setInterval(() => {
            if (position?.status === 'OPEN') {
                fetchPrices([position.symbol]);
            }
        }, 300000);
        return () => clearInterval(interval);
    });

    if (position?.status === 'OPEN') {
        const cached = prices[position.symbol];
        if (!cached || (Date.now() - cached.timestamp > 300000)) {
            fetchPrices([position.symbol]);
        }
    }

    if (position === undefined) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    if (position === null) return <div className="p-8 text-center text-foreground">Position not found.</div>

    // Find all transactions that are linked to this position
    const linkedTxIds = new Set(position.entries.map(e => e.transactionId))
    const linkedTxs = allTransactions?.filter(tx => linkedTxIds.has(tx.id)) || []

    // Available transactions matching symbol that can be linked
    const availableTxs = allTransactions?.filter(tx => tx.symbol === position.symbol && !linkedTxIds.has(tx.id)).sort((a, b) => b.date - a.date) || []

    // Handlers
    const handleLink = async (txId: string, quantity: number) => {
        if (!id) return;
        await addTransactionToPosition(id, { transactionId: txId, allocatedAmount: quantity });
    }

    const handleRemove = async (txId: string) => {
        if (!id) return;
        await removeTransactionFromPosition(id, txId);
    }

    const toggleStatus = async () => {
        if (!id || !position) return;
        if (position.status === 'OPEN') {
            await closePosition(id);
        } else {
            await openPosition(id);
        }
    }

    const handleDeletePosition = async () => {
        if (!id || !window.confirm("Are you sure you want to delete this position strategy? All transaction links will be removed.")) return;
        await deletePosition(id);
        navigate('/positions');
    }

    const handleRefresh = async () => {
        if (position?.symbol) {
            await fetchPrices([position.symbol], true);
        }
    }

    // Calculate Metrics
    const {
        realizedPnL, unrealizedPnL, roi,
        totalRemaining, currentPrice, positionType, derivedStartDate,
        derivedEndDate, avgBuyPrice, avgSellPrice, breakevenPrice
    } = getPositionMetrics(position, linkedTxs, prices);

    const totalFee = linkedTxs.reduce((sum, tx) => {
        const allocated = position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0;
        const ratio = tx.quantity > 0 ? allocated / tx.quantity : 0;
        return sum + (tx.fee || 0) * ratio;
    }, 0);

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 min-h-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-2 md:gap-4 flex-col sm:flex-row w-full">
                        <Button variant="ghost" size="icon" className="shrink-0 self-start mt-1" onClick={() => navigate('/positions')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 w-full min-w-0">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{position.strategyName || `${position.symbol.split('/')[0]} Position`}</h1>
                                        {position.type === 'SHADOW' && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                <Eye className="h-3 w-3" />
                                                SHADOW ANALYSIS
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Direction Badge */}
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${
                                        positionType === 'LONG' 
                                        ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    }`}>
                                        {positionType === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {positionType}
                                    </div>
                                    
                                    {/* Status Badge */}
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border ${
                                        position.status === 'OPEN'
                                        ? 'bg-blue-500/5 text-blue-600 border-blue-200 dark:border-blue-900/50 dark:text-blue-400'
                                        : 'bg-muted/50 text-muted-foreground border-border'
                                    }`}>
                                        <Circle className={`h-1.5 w-1.5 fill-current ${position.status === 'OPEN' ? 'animate-pulse' : ''}`} />
                                        {position.status === 'OPEN' ? 'ACTIVE' : 'ARCHIVED'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 md:mt-2.5">
                                <span className="text-sm md:text-lg text-muted-foreground font-mono font-bold tracking-wider">{position.symbol}</span>
                                {position.status === 'OPEN' && currentPrice > 0 && (
                                    <span className="text-primary font-mono font-medium text-sm md:text-lg animate-in fade-in slide-in-from-left-2">
                                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground font-mono">
                                <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                    <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                                    <span>Opened: {derivedStartDate ? format(new Date(derivedStartDate), "yyyy/MM/dd") : 'Unknown'}</span>
                                </div>
                                <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                                    <span>Duration: {differenceInDays(derivedEndDate || Date.now(), derivedStartDate || Date.now())} days</span>
                                </div>
                            </div>

                            {position.notes && (
                                <div className="mt-3 md:mt-4 p-2 md:p-3 bg-muted/30 rounded-lg border border-border/50 text-xs md:text-sm text-muted-foreground w-full max-w-2xl break-words">
                                    <span className="font-semibold text-foreground/80 mr-2">Notes:</span>
                                    {position.notes}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start w-full md:w-auto">
                        <Button variant={position.status === 'OPEN' ? 'secondary' : 'default'} onClick={toggleStatus} className="gap-2 flex-1 md:flex-none">
                            {position.status === 'OPEN' ? <><Square className="h-4 w-4" /> Close</> : <><Play className="h-4 w-4" /> Re-open</>}
                        </Button>
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Edit Position details</DialogTitle>
                                </DialogHeader>
                                <PositionEditForm position={position} onSuccess={() => setIsEditDialogOpen(false)} />
                            </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={handleDeletePosition}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>



                <Card className="overflow-hidden border-border/50 shadow-sm">
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                            {/* Realized PnL */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Realized PnL</span>
                                <span className={`text-base sm:text-xl font-bold ${realizedPnL > 0 ? 'text-green-500' : realizedPnL < 0 ? 'text-destructive' : ''}`}>
                                    ${realizedPnL > 0 ? '+' : ''}{realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Unrealized PnL */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Unrealized PnL</span>
                                <span className={`text-base sm:text-xl font-bold ${unrealizedPnL > 0 ? 'text-green-500' : unrealizedPnL < 0 ? 'text-destructive' : ''}`}>
                                    {totalRemaining > 0 ? `$${unrealizedPnL > 0 ? '+' : ''}${unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                </span>
                            </div>

                            {/* Avg Buy Price */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Buy</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {avgBuyPrice > 0 ? `$${avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>

                            {/* Avg Sell Price */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Sell</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {avgSellPrice > 0 ? `$${avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>

                            {/* Total Fee */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Fee</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {totalFee > 0 ? `$${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                </span>
                            </div>

                            {/* ROI */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">ROI</span>
                                <span className={`text-base sm:text-xl font-bold ${roi > 0 ? 'text-green-500' : roi < 0 ? 'text-destructive' : ''}`}>
                                    {roi > 0 ? '+' : ''}{roi.toFixed(2)}%
                                </span>
                            </div>

                            {/* Holding */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Holding</span>
                                <div className="flex items-baseline gap-1 truncate">
                                    <span className="text-base sm:text-xl font-bold font-mono">{totalRemaining.toLocaleString()}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{position.symbol.split('/')[0]}</span>
                                </div>
                            </div>

                            {/* Avg. Cost (Breakeven) */}
                            <div className="flex flex-col">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1" title="Breakeven price considering realized PnL">Avg Cost</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {(breakevenPrice > 0 && totalRemaining > 0) ? `$${breakevenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card rounded-xl p-6 border shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Linked Trades</h2>
                            {linkedTxs.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No trades linked to this position yet. Link them from the right panel.</p>
                            ) : (
                                <div className="space-y-4">
                                    {linkedTxs.map(tx => {
                                        const entry = position.entries.find(e => e.transactionId === tx.id);
                                        return (
                                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border bg-background/40 hover:bg-background/80 transition-colors group">
                                                <div className="flex gap-3 md:gap-4 items-center min-w-0">
                                                    <div className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${tx.type === "BUY" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                                                        {tx.type}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <p className="font-mono text-xs md:text-sm font-medium truncate">
                                                            ${tx.price.toLocaleString()} <span className="text-muted-foreground mx-0.5">×</span> {tx.quantity}
                                                        </p>
                                                        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                            <span className="bg-primary/5 text-primary px-1 rounded-sm font-semibold">Allocated: {entry?.allocatedAmount}</span>
                                                            <span className="hidden sm:inline opacity-50">•</span>
                                                            <span className="opacity-70">{format(new Date(tx.date), "yyyy/MM/dd")}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-0.5 md:gap-1 shrink-0 ml-2">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/transactions/${tx.id}`); }} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                                                            <DialogHeader>
                                                                <DialogTitle>View / Edit Details</DialogTitle>
                                                            </DialogHeader>
                                                            <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Button variant="ghost" size="icon" onClick={() => handleRemove(tx.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card rounded-xl p-6 border shadow-sm">
                            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Available Trades</h3>
                            <div className="space-y-3">
                                {availableTxs.length === 0 ? (
                                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        No available unlinked trades for this asset.
                                    </p>
                                ) : (
                                    availableTxs.map(tx => (
                                        <div key={tx.id} className="p-3 border rounded-lg hover:border-primary/50 transition-colors text-sm bg-background/50">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tx.type === "BUY" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                                                        {tx.type}
                                                    </div>
                                                    {tx.associatedPositionIds?.length > 0 && (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                    <div className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-border bg-muted/30 text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
                                                                        Linked ({tx.associatedPositionIds.length})
                                                                    </div>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 p-3" align="start">
                                                                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Used by Strategies</p>
                                                                <div className="flex flex-col gap-1">
                                                                    {tx.associatedPositionIds.map((pid: string) => {
                                                                        const pInfo = allPositions?.find(p => p.id === pid)
                                                                        return (
                                                                            <div key={pid} className="text-sm bg-muted/50 rounded-sm p-1.5 flex justify-between items-center group cursor-pointer hover:bg-muted" onClick={() => navigate(`/positions/${pid}`)}>
                                                                                <span className="truncate mr-2" title={pInfo?.strategyName || 'Unnamed'}>{pInfo?.strategyName || 'Unnamed Strategy'}</span>
                                                                                <div className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${pInfo?.status === 'OPEN' ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                                                                                    {pInfo?.status || '?'}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/transactions/${tx.id}`); }} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                                                <Edit className="h-3 w-3" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                                                            <DialogHeader>
                                                                <DialogTitle>View / Edit Details</DialogTitle>
                                                            </DialogHeader>
                                                            <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                                        </DialogContent>
                                                    </Dialog>
                                                    <Button size="sm" variant="secondary" onClick={() => handleLink(tx.id, tx.quantity)} className="h-7 text-xs gap-1">
                                                        <LinkIcon className="h-3 w-3" /> Link 100%
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="font-mono text-muted-foreground">${tx.price} × {tx.quantity}</p>
                                                <span className="text-xs text-muted-foreground/70 font-mono">{format(new Date(tx.date), "yyyy/MM/dd HH:mm:ss")}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PullToRefresh>
    )
}
