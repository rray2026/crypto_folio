import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { usePositionStore } from "@/store/usePositionStore"
import { useFundStore } from "@/store/useFundStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { differenceInDays, format } from "date-fns"
import { ArrowLeft, Trash2, Link as LinkIcon, AlertCircle, Edit, Play, Square, Calendar, Clock, TrendingUp, TrendingDown, Circle, Eye, Layers, ExternalLink, Share2, Bot, Copy, Check, X, EllipsisVertical, FlaskConical, Plus } from "lucide-react"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { PositionEditForm } from "@/components/positions/PositionEditForm"
import { SwipeActions } from "@/components/shared/SwipeActions"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog"
import { useState, useEffect, useCallback, useMemo } from "react"
import { getPositionMetrics } from "@/lib/metrics"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { badge, txBadgeColor, pnlColor, sectionHeader, label, dialogItem } from "@/lib/styles"

export default function PositionDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const addTransactionToPosition = usePositionStore(state => state.addTransactionToPosition)
    const removeTransactionFromPosition = usePositionStore(state => state.removeTransactionFromPosition)
    const closePosition = usePositionStore(state => state.closePosition)
    const openPosition = usePositionStore(state => state.openPosition)
    const deletePosition = usePositionStore(state => state.deletePosition)
    const { prices, fetchPrices, pairConfigs } = useSettingsStore()

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const [editingAllocTxId, setEditingAllocTxId] = useState<string | null>(null)
    const [allocInputValue, setAllocInputValue] = useState<string>('')
    const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false)
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
    const [isAddTxDialogOpen, setIsAddTxDialogOpen] = useState(false)
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set())
    const [linkTimeFilter, setLinkTimeFilter] = useState<'7D' | '1M' | '6M' | 'ALL'>('ALL')
    const { assignPositionToFund, unassignPosition } = useFundStore()
    const { setMobileHeader } = useMobileHeader()

    const position = useLiveQuery(() => id ? db.positions.get(id) : undefined, [id])
    const allTransactions = useLiveQuery(() => db.transactions.toArray())
    const allPositions = useLiveQuery(() => db.positions.toArray())
    const allFunds = useLiveQuery(() => db.funds.toArray())

    // Compute total allocated quantity per transaction across all positions
    const getTxAllocated = useCallback((txId: string, excludePositionId?: string) => {
        if (!allPositions) return 0
        return allPositions.reduce((sum, p) => {
            if (p.id === excludePositionId) return sum
            const entry = p.entries.find(e => e.transactionId === txId)
            return sum + (entry?.allocatedAmount ?? 0)
        }, 0)
    }, [allPositions])

    const toggleStatus = useCallback(async () => {
        if (!id || !position) return;
        if (position.status === 'OPEN') {
            await closePosition(id);
        } else {
            await openPosition(id);
        }
    }, [id, position, closePosition, openPosition])

    const handleDeletePosition = useCallback(async () => {
        if (!id || !window.confirm("Are you sure you want to delete this position strategy? All transaction links will be removed.")) return;
        await deletePosition(id);
        navigate('/positions');
    }, [id, deletePosition, navigate])

    useEffect(() => {
        const title = position
            ? (position.strategyName || position.symbol.split('/')[0])
            : "Position"
        setMobileHeader({
            title,
            leftAction: (
                <button
                    onClick={() => navigate('/positions')}
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
                            onClick={() => { setIsMobileMenuOpen(false); setIsEditDialogOpen(true); }}
                        >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                            Edit
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); setIsAiDialogOpen(true); }}
                        >
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            Ask AI
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); navigate(`/positions/${id}/simulator`); }}
                        >
                            <FlaskConical className="h-4 w-4 text-muted-foreground" />
                            Simulate Trade
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); toggleStatus(); }}
                        >
                            {position?.status === 'OPEN'
                                ? <><Square className="h-4 w-4 text-muted-foreground" /> Close Position</>
                                : <><Play className="h-4 w-4 text-muted-foreground" /> Re-open Position</>
                            }
                        </button>
                        <div className="border-t border-border/50 my-1" />
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                            onClick={() => { setIsMobileMenuOpen(false); handleDeletePosition(); }}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </PopoverContent>
                </Popover>
            ),
        })
    }, [position, navigate, setMobileHeader, isMobileMenuOpen, toggleStatus, handleDeletePosition])

    // Initial price fetch when position loads or symbol changes
    useEffect(() => {
        if (position?.status === 'OPEN') {
            fetchPrices([position.symbol]);
        }
    }, [position?.status, position?.symbol, fetchPrices]);

    // Periodic refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            if (position?.status === 'OPEN') {
                fetchPrices([position.symbol]);
            }
        }, 300000);
        return () => clearInterval(interval);
    }, [position?.status, position?.symbol, fetchPrices]);

    const now = useState(() => Date.now())[0]

    // Available transactions: same symbol, not already linked, and have remaining allocatable quantity
    const availableTxs = useMemo(() => {
        if (!position || !allTransactions) return []
        const linkedIds = new Set(position.entries.map(e => e.transactionId))
        return allTransactions.filter(tx => {
            if (tx.symbol !== position.symbol || linkedIds.has(tx.id)) return false
            const allocated = getTxAllocated(tx.id)
            return tx.quantity - allocated > 0
        }).sort((a, b) => b.date - a.date)
    }, [position, allTransactions, getTxAllocated])

    const filteredAvailableTxs = useMemo(() => {
        if (linkTimeFilter === 'ALL') return availableTxs
        const cutoff = {
            '7D': now - 7 * 24 * 60 * 60 * 1000,
            '1M': now - 30 * 24 * 60 * 60 * 1000,
            '6M': now - 180 * 24 * 60 * 60 * 1000,
        }[linkTimeFilter]
        return availableTxs.filter(tx => tx.date >= cutoff)
    }, [availableTxs, linkTimeFilter, now])

    const toggleSelectTx = useCallback((txId: string) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev)
            if (next.has(txId)) next.delete(txId)
            else next.add(txId)
            return next
        })
    }, [])

    const handleBulkLink = useCallback(async () => {
        if (!id || selectedTxIds.size === 0) return
        for (const txId of selectedTxIds) {
            const tx = availableTxs.find(t => t.id === txId)
            if (tx) {
                const remaining = tx.quantity - getTxAllocated(tx.id)
                if (remaining > 0) {
                    await addTransactionToPosition(id, { transactionId: txId, allocatedAmount: remaining })
                }
            }
        }
        setSelectedTxIds(new Set())
        setIsLinkDialogOpen(false)
    }, [id, selectedTxIds, availableTxs, addTransactionToPosition, getTxAllocated])

    if (position === undefined) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    if (position === null) return <div className="p-8 text-center text-foreground">Position not found.</div>

    // Find all transactions that are linked to this position
    const linkedTxIds = new Set(position.entries.map(e => e.transactionId))
    const linkedTxs = allTransactions?.filter(tx => linkedTxIds.has(tx.id)) || []

    // Handlers
    const handleRemove = async (txId: string) => {
        if (!id) return;
        await removeTransactionFromPosition(id, txId);
    }

    const startEditAlloc = (txId: string, currentAlloc: number) => {
        setEditingAllocTxId(txId);
        setAllocInputValue(String(currentAlloc));
    }

    const commitEditAlloc = async (txId: string) => {
        const val = parseFloat(allocInputValue);
        if (!id || isNaN(val) || val <= 0) { setEditingAllocTxId(null); return; }
        const tx = allTransactions?.find(t => t.id === txId);
        if (!tx) { setEditingAllocTxId(null); return; }
        const maxAlloc = tx.quantity - getTxAllocated(txId, id);
        const clamped = Math.min(val, maxAlloc);
        if (clamped <= 0) { setEditingAllocTxId(null); return; }
        await addTransactionToPosition(id, { transactionId: txId, allocatedAmount: clamped });
        setEditingAllocTxId(null);
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

    const currencySymbol = getCurrencySymbolForPair(position.symbol, pairConfigs);

    const totalFee = linkedTxs.reduce((sum, tx) => {
        const allocated = position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0;
        const ratio = tx.quantity > 0 ? allocated / tx.quantity : 0;
        return sum + (tx.fee || 0) * ratio;
    }, 0);

    const generateAiPrompt = () => {
        const name = position.strategyName || `${position.symbol.split('/')[0]} Position`
        const startStr = derivedStartDate ? format(new Date(derivedStartDate), "yyyy/MM/dd") : 'Unknown'
        const endStr = derivedEndDate ? format(new Date(derivedEndDate), "yyyy/MM/dd") : (position.status === 'OPEN' ? 'Still Open' : 'Unknown')
        const durationDays = differenceInDays(derivedEndDate || now, derivedStartDate || now)

        const tradesSection = linkedTxs.length === 0 ? '  (No linked trades)' : linkedTxs.map(tx => {
            const alloc = position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount ?? tx.quantity
            return `  - [${tx.type}] ${format(new Date(tx.date), "yyyy/MM/dd HH:mm")}  Price: ${currencySymbol}${tx.price.toLocaleString()}  Qty: ${tx.quantity}  Allocated: ${alloc}  Fee: ${currencySymbol}${(tx.fee || 0).toFixed(2)}${tx.notes ? `  Note: ${tx.notes}` : ''}`
        }).join('\n')

        const lines = [
            `I need your advice on the following trading position.`,
            ``,
            `## Position Overview`,
            `- Name: ${name}`,
            `- Symbol: ${position.symbol}`,
            `- Direction: ${positionType}`,
            `- Status: ${position.status}`,
            `- Opened: ${startStr}`,
            `- Closed: ${endStr}`,
            `- Duration: ${durationDays} days`,
            position.notes ? `- Strategy Notes: ${position.notes}` : null,
            ``,
            `## Performance Metrics`,
            `- Avg Buy Price: ${avgBuyPrice > 0 ? `${currencySymbol}${avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'N/A'}`,
            `- Avg Sell Price: ${avgSellPrice > 0 ? `${currencySymbol}${avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'N/A'}`,
            position.status === 'OPEN' && currentPrice > 0 ? `- Current Price: ${currencySymbol}${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : null,
            `- Holdings: ${totalRemaining} ${position.symbol.split('/')[0]}`,
            `- Realized PnL: ${currencySymbol}${realizedPnL.toFixed(2)}`,
            totalRemaining !== 0 ? `- Unrealized PnL: ${currencySymbol}${unrealizedPnL.toFixed(2)}` : null,
            `- ROI: ${roi.toFixed(2)}%`,
            totalFee > 0 ? `- Total Fees: ${currencySymbol}${totalFee.toFixed(2)}` : null,
            breakevenPrice > 0 && totalRemaining !== 0 ? `- Breakeven Price: ${currencySymbol}${breakevenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : null,
            ``,
            `## Linked Trades (${linkedTxs.length})`,
            tradesSection,
            ``,
            `## Request`,
            `Based on the above data, please provide:`,
            `1. An analysis of this position's performance`,
            `2. Key strengths and weaknesses of the trading strategy`,
            `3. Actionable suggestions for improvement or next steps`,
        ].filter(l => l !== null).join('\n')

        return lines
    }

    const handleCopyPrompt = async () => {
        const prompt = generateAiPrompt()
        await navigator.clipboard.writeText(prompt)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 min-h-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-2 md:gap-4 flex-col sm:flex-row w-full">
                        <Button variant="ghost" size="icon" className="hidden md:inline-flex shrink-0 self-start mt-1" onClick={() => navigate('/positions')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 w-full min-w-0">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{position.strategyName || `${position.symbol.split('/')[0]} Position`}</h1>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Direction Badge */}
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] md:text-xs font-semibold border ${
                                        positionType === 'LONG'
                                        ? 'bg-emerald-500/8 text-emerald-600/80 dark:text-emerald-400/80 border-emerald-500/15'
                                        : 'bg-rose-500/8 text-rose-600/80 dark:text-rose-400/80 border-rose-500/15'
                                    }`}>
                                        {positionType === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {positionType}
                                    </span>

                                    {/* Status Badge */}
                                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] md:text-xs font-semibold border ${
                                        position.status === 'OPEN'
                                        ? 'bg-primary/10 text-primary border-primary/20'
                                        : 'bg-muted text-muted-foreground border-border'
                                    }`}>
                                        <Circle className={`h-1.5 w-1.5 fill-current ${position.status === 'OPEN' ? 'animate-pulse' : ''}`} />
                                        {position.status === 'OPEN' ? 'ACTIVE' : 'CLOSED'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 md:mt-2.5">
                                <span className="text-sm md:text-lg text-muted-foreground font-mono font-bold tracking-wider">{position.symbol}</span>
                                {position.status === 'OPEN' && currentPrice > 0 && (
                                    <span className="text-primary font-mono font-medium text-sm md:text-lg animate-in fade-in slide-in-from-left-2">
                                        {currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
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
                                    <span>Duration: {differenceInDays(derivedEndDate || now, derivedStartDate || now)} days</span>
                                </div>
                                {/* Fund assignment inline */}
                                {position.fundId ? (() => {
                                    const linkedFund = allFunds?.find(f => f.id === position.fundId)
                                    return (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className="flex items-center gap-1 md:gap-1.5 bg-primary/5 rounded-md px-1.5 md:px-2 py-1 border border-primary/20 text-primary hover:bg-primary/10 transition-colors cursor-pointer font-sans">
                                                    <Layers className="h-3 w-3 md:h-4 md:w-4" />
                                                    <span className="font-medium">{linkedFund?.name ?? 'Unknown Fund'}</span>
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-48 p-2" align="start">
                                                <button
                                                    onClick={() => navigate(`/funds/${position.fundId}`)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    View Fund
                                                </button>
                                                <button
                                                    onClick={() => id && unassignPosition(id)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                                                >
                                                    <X className="h-3.5 w-3.5 shrink-0" />
                                                    Unlink
                                                </button>
                                            </PopoverContent>
                                        </Popover>
                                    )
                                })() : (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-dashed border-border/50 hover:border-primary/50 transition-colors cursor-pointer font-sans">
                                                <Layers className="h-3 w-3 md:h-4 md:w-4" />
                                                <span>Link Fund</span>
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="start">
                                            {!allFunds || allFunds.length === 0 ? (
                                                <p className="text-xs text-muted-foreground flex items-center gap-2 px-2 py-1.5">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    No funds available.
                                                </p>
                                            ) : (
                                                allFunds.map(f => (
                                                    <button
                                                        key={f.id}
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                                                        onClick={() => id && assignPositionToFund(id, f.id)}
                                                    >
                                                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                        <span className="truncate">{f.name}</span>
                                                    </button>
                                                ))
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            {position.notes && (
                                <div className="mt-3 md:mt-4 p-2 md:p-3 bg-muted/30 rounded-lg border border-border/50 text-xs md:text-sm text-muted-foreground w-full max-w-2xl break-words">
                                    <span className="font-semibold text-foreground/80 mr-2">Notes:</span>
                                    {position.notes}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop action buttons */}
                    <div className="hidden md:flex items-center gap-2 self-start">
                        <Button variant={position.status === 'OPEN' ? 'secondary' : 'default'} onClick={toggleStatus} className="gap-2">
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

                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate(`/positions/${id}/simulator`)} title="Simulate Trade">
                            <FlaskConical className="h-4 w-4" />
                        </Button>

                        <Popover open={isSharePopoverOpen} onOpenChange={setIsSharePopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-1.5" align="end">
                                <button
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                                    onClick={() => { setIsSharePopoverOpen(false); setIsAiDialogOpen(true); }}
                                >
                                    <Bot className="h-4 w-4 text-primary shrink-0" />
                                    Ask AI
                                </button>
                            </PopoverContent>
                        </Popover>

                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={handleDeletePosition}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Ask AI Dialog (shared by mobile menu and desktop) */}
                    <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Bot className="h-5 w-5 text-primary" />
                                    Ask AI
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-xs text-muted-foreground -mt-1">Copy the prompt below and paste it into any AI chat to get analysis.</p>
                            <div className="flex-1 overflow-y-auto mt-2">
                                <pre className="text-xs bg-muted/40 rounded-lg p-4 whitespace-pre-wrap break-words font-mono border border-border/50 leading-relaxed">
                                    {generateAiPrompt()}
                                </pre>
                            </div>
                            <div className="flex justify-end pt-2 border-t border-border/40">
                                <Button onClick={handleCopyPrompt} className="gap-2" size="sm">
                                    {isCopied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy Prompt</>}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                </div>



                <Card className="overflow-hidden border-border/50 shadow-sm">
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                            {/* Realized PnL */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Realized PnL</span>
                                <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(realizedPnL)}`}>
                                    {currencySymbol}{realizedPnL > 0 ? '+' : ''}{realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Unrealized PnL */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Unrealized PnL</span>
                                <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(unrealizedPnL)}`}>
                                    {totalRemaining !== 0 ? `${currencySymbol}${unrealizedPnL > 0 ? '+' : ''}${unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                </span>
                            </div>

                            {/* Avg Buy Price */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Avg Buy</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {avgBuyPrice > 0 ? `${currencySymbol}${avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>

                            {/* Avg Sell Price */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Avg Sell</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {avgSellPrice > 0 ? `${currencySymbol}${avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>

                            {/* Total Fee */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Total Fee</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {totalFee > 0 ? `${currencySymbol}${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                                </span>
                            </div>

                            {/* ROI */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>ROI</span>
                                <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(roi)}`}>
                                    {roi > 0 ? '+' : ''}{roi.toFixed(2)}%
                                </span>
                            </div>

                            {/* Holding */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Holding</span>
                                <div className="flex items-baseline gap-1 truncate">
                                    <span className="text-base sm:text-xl font-bold font-mono">{totalRemaining.toLocaleString()}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{position.symbol.split('/')[0]}</span>
                                </div>
                            </div>

                            {/* Avg. Cost (Breakeven) */}
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`} title="Breakeven price considering realized PnL">Avg Cost</span>
                                <span className="text-base sm:text-xl font-bold font-mono">
                                    {(breakevenPrice > 0 && totalRemaining !== 0) ? `${currencySymbol}${breakevenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '--'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Linked Trades */}
                <div className="space-y-1.5">
                    <span className={sectionHeader}>
                        Linked Trades ({linkedTxs.length})
                    </span>
                    <div className="space-y-3">
                        {linkedTxs.map(tx => {
                            const entry = position.entries.find(e => e.transactionId === tx.id);
                            return (
                                <div key={tx.id}>
                                <SwipeActions
                                    actions={[
                                        { icon: <X className="h-4 w-4" />, bg: "bg-rose-500", onAction: () => handleRemove(tx.id) },
                                    ]}
                                >
                                    <div
                                        className="flex items-center justify-between p-3 border border-border/50 bg-card hover:bg-card/80 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/transactions/${tx.id}`)}
                                    >
                                        <div className="flex gap-3 md:gap-4 items-center min-w-0">
                                            <div className={badge({ color: txBadgeColor(tx.type) })}>
                                                {tx.type}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <p className="font-mono text-xs md:text-sm font-medium truncate">
                                                    {currencySymbol}{tx.price.toLocaleString()} <span className="text-muted-foreground mx-0.5">×</span> {tx.quantity}
                                                </p>
                                                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                    {editingAllocTxId === tx.id ? (
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            value={allocInputValue}
                                                            onChange={e => setAllocInputValue(e.target.value)}
                                                            onBlur={() => commitEditAlloc(tx.id)}
                                                            onKeyDown={e => { if (e.key === 'Enter') commitEditAlloc(tx.id); if (e.key === 'Escape') setEditingAllocTxId(null); }}
                                                            className="w-20 bg-background border border-primary/50 rounded px-1 py-0 text-[10px] md:text-xs font-semibold text-primary focus:outline-none"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <span
                                                            className="bg-primary/5 text-primary px-1 rounded-sm font-semibold cursor-pointer hover:bg-primary/15 transition-colors"
                                                            onClick={e => { e.stopPropagation(); startEditAlloc(tx.id, entry?.allocatedAmount ?? 0); }}
                                                            title="Click to edit allocated amount"
                                                        >Allocated: {entry?.allocatedAmount}</span>
                                                    )}
                                                    <span className="hidden sm:inline opacity-50">•</span>
                                                    <span className="opacity-70">{format(new Date(tx.date), "yyyy/MM/dd")}</span>
                                                </p>
                                            </div>
                                        </div>
                                        {/* Desktop only: hover-reveal buttons */}
                                        <div className="hidden md:flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-all">
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
                                </SwipeActions>
                                </div>
                            );
                        })}

                        {/* Link More / empty state */}
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedTxIds(new Set())
                                setLinkTimeFilter('ALL')
                                setIsLinkDialogOpen(true)
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border/50 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/30 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            {linkedTxs.length === 0 ? 'Link Trades' : 'Link More'}
                        </button>
                    </div>
                </div>

                {/* Link More Dialog */}
                <Dialog open={isLinkDialogOpen} onOpenChange={(open) => {
                    setIsLinkDialogOpen(open)
                    if (!open) setSelectedTxIds(new Set())
                }}>
                    <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[480px] h-[70vh] flex flex-col [&>button.absolute]:hidden">
                        <DialogHeader>
                            <div className="flex items-center justify-between">
                                <DialogTitle>Link Trades</DialogTitle>
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
                                Select trades to link to this position.
                            </p>
                        </DialogHeader>
                                {/* Transaction list or empty state */}
                                <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
                                    {filteredAvailableTxs.length > 0 ? (
                                        filteredAvailableTxs.map(tx => {
                                            const isSelected = selectedTxIds.has(tx.id)
                                            const allocated = getTxAllocated(tx.id)
                                            const remaining = tx.quantity - allocated
                                            const isPartial = allocated > 0
                                            return (
                                                <button
                                                    key={tx.id}
                                                    type="button"
                                                    onClick={() => toggleSelectTx(tx.id)}
                                                    className={`${dialogItem(isSelected)} flex items-center gap-3`}
                                                >
                                                    <div className={`${badge({ color: txBadgeColor(tx.type) })} shrink-0`}>
                                                        {tx.type}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <p className="font-mono text-xs font-medium truncate">
                                                            {currencySymbol}{tx.price.toLocaleString()} <span className="text-muted-foreground mx-0.5">×</span> {isPartial ? <><span className="text-primary">{remaining}</span><span className="text-muted-foreground">/{tx.quantity}</span></> : tx.quantity}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                                            {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                                                        </p>
                                                    </div>
                                                    {isSelected && (
                                                        <Check className="h-4 w-4 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            )
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full">
                                            <div className="border border-dashed border-border/50 rounded-xl p-8 text-center">
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    {availableTxs.length > 0
                                                        ? 'No trades in this time range.'
                                                        : `No unlinked trades for ${position.symbol}.`
                                                    }
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5"
                                                    onClick={() => { setIsLinkDialogOpen(false); setIsAddTxDialogOpen(true) }}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Add Transaction
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm footer */}
                                {selectedTxIds.size > 0 && (
                                    <div className="pt-3 border-t border-border/40">
                                        <Button
                                            className="w-full h-11 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
                                            onClick={handleBulkLink}
                                        >
                                            <LinkIcon className="h-4 w-4" />
                                            Link {selectedTxIds.size} {selectedTxIds.size === 1 ? 'Trade' : 'Trades'}
                                        </Button>
                                    </div>
                                )}
                    </DialogContent>
                </Dialog>

                <AddTransactionDialog open={isAddTxDialogOpen} onOpenChange={setIsAddTxDialogOpen} />
            </div>
        </PullToRefresh>
    )
}
