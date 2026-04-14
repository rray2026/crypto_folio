import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { TransactionCard, TransactionListHeader } from "@/components/shared/TransactionCard"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog"
import { Plus, Trash2, X, CheckSquare, FolderPlus, AlertCircle, Activity, Calendar, Loader2 } from "lucide-react"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { getPositionMetrics } from "@/lib/metrics"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
} from "@/components/ui/dialog"

export default function Transactions() {
    const navigate = useNavigate()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const { setMobileHeader } = useMobileHeader()
    const openAdd = useCallback(() => setIsAddDialogOpen(true), [])
    const openSelectMode = useCallback(() => setIsSelectionMode(true), [setIsSelectionMode])
    useEffect(() => {
        setMobileHeader({
            title: "Transactions",
            rightActions: (
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={openSelectMode}
                        className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                        aria-label="Select transactions"
                    >
                        <CheckSquare className="h-4 w-4" />
                    </button>
                    <button
                        onClick={openAdd}
                        className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                        aria-label="Add Transaction"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
            ),
        })
    }, [setMobileHeader, openAdd, openSelectMode])
    const [confirmDeleteState, setConfirmDeleteState] = useState<{ isOpen: boolean, type: 'single' | 'bulk', targetId?: string }>({ isOpen: false, type: 'single' })
    const [isCreatePositionDialogOpen, setIsCreatePositionDialogOpen] = useState(false)
    const [createPositionError, setCreatePositionError] = useState<string | null>(null)
    const [isFetchingPreviewPrice, setIsFetchingPreviewPrice] = useState(false)
    const [newPositionName, setNewPositionName] = useState("")
    
    const [filterSymbol, setFilterSymbol] = useState<string>("ALL")
    const [filterTimeRange, setFilterTimeRange] = useState<string>("ALL")
    const [filterTimeRangeNow, setFilterTimeRangeNow] = useState(() => Date.now())

    const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)
    const bulkDeleteTransactions = useTransactionStore((state) => state.bulkDeleteTransactions)
    const createPosition = usePositionStore((state) => state.createPosition)
    const addTransactionToPosition = usePositionStore((state) => state.addTransactionToPosition)
    const { prices, fetchPrices, pairConfigs } = useSettingsStore()

    // Reactively fetch all transactions
    const allTransactions = useLiveQuery(
        () => db.transactions.orderBy("date").reverse().toArray()
    )

    // Get unique symbols for filter
    const uniqueSymbols = Array.from(new Set(allTransactions?.map(tx => tx.symbol) || [])).sort();
    const now = filterTimeRangeNow

    // Filter logic
    const transactions = allTransactions?.filter(tx => {
        const symbolMatch = filterSymbol === "ALL" || tx.symbol === filterSymbol;
        
        let timeMatch = true;
        if (filterTimeRange !== "ALL") {
            const txDate = new Date(tx.date).getTime();
            const dayMs = 24 * 60 * 60 * 1000;
            
            if (filterTimeRange === "24H") timeMatch = txDate >= now - dayMs;
            else if (filterTimeRange === "1W") timeMatch = txDate >= now - 7 * dayMs;
            else if (filterTimeRange === "1M") timeMatch = txDate >= now - 30 * dayMs;
            else if (filterTimeRange === "3M") timeMatch = txDate >= now - 90 * dayMs;
            else if (filterTimeRange === "6M") timeMatch = txDate >= now - 180 * dayMs;
        }

        return symbolMatch && timeMatch;
    });

    const confirmSingleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setConfirmDeleteState({ isOpen: true, type: 'single', targetId: id })
    }

    const confirmBulkDelete = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (selectedIds.size === 0) return;
        setConfirmDeleteState({ isOpen: true, type: 'bulk' })
    }

    const executeDelete = async () => {
        if (confirmDeleteState.type === 'single' && confirmDeleteState.targetId) {
            await deleteTransaction(confirmDeleteState.targetId)
            setSelectedIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(confirmDeleteState.targetId!)
                return newSet
            })
        } else if (confirmDeleteState.type === 'bulk') {
            await bulkDeleteTransactions(Array.from(selectedIds));
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
        setConfirmDeleteState({ isOpen: false, type: 'single' });
    }

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            if (newSet.size === 0) setIsSelectionMode(false);
            return newSet;
        });
    }

    const toggleAll = () => {
        if (!transactions) return;
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    }

    const handleCreatePositionClick = async () => {
        if (!allTransactions || selectedIds.size === 0) return

        const selectedTxs = allTransactions.filter(tx => selectedIds.has(tx.id))
        const symbols = new Set(selectedTxs.map(tx => tx.symbol))

        if (symbols.size > 1) {
            setCreatePositionError("All selected transactions must have the same trading pair.")
            setIsCreatePositionDialogOpen(true)
            return
        }

        const symbol = Array.from(symbols)[0]
        setNewPositionName("")
        setCreatePositionError(null)

        // Await fresh price before showing the preview dialog
        setIsFetchingPreviewPrice(true)
        await fetchPrices([symbol], true)
        setIsFetchingPreviewPrice(false)
        setIsCreatePositionDialogOpen(true)
    }

    const executeCreatePosition = async () => {
        if (!allTransactions || selectedIds.size === 0) return

        const selectedTxs = allTransactions.filter(tx => selectedIds.has(tx.id))
        const symbol = selectedTxs[0].symbol

        const positionId = await createPosition({
            symbol,
            strategyName: newPositionName || undefined,
            startDate: Math.min(...selectedTxs.map(tx => tx.date))
        })

        for (const tx of selectedTxs) {
            await addTransactionToPosition(positionId, {
                transactionId: tx.id,
                allocatedAmount: tx.quantity
            })
        }

        setIsCreatePositionDialogOpen(false)
        setSelectedIds(new Set())
        setIsSelectionMode(false)
        // toast.success("Position created", {
        //     description: `Successfully created ${newPositionName} with ${selectedTxs.length} trades.`
        // })
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 md:mb-8 gap-4">
                <div className="hidden sm:block">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your foundational trade records.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-3">
                    {/* Filters */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/40 rounded-full border-border/50 text-xs shadow-sm hover:bg-muted/60 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="All Assets" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="ALL">All Assets</SelectItem>
                                {uniqueSymbols.map(sym => (
                                    <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterTimeRange} onValueChange={(val) => { setFilterTimeRange(val); setFilterTimeRangeNow(Date.now()) }}>
                            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/40 rounded-full border-border/50 text-xs shadow-sm hover:bg-muted/60 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="All Time" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="24H">Last 24 Hours</SelectItem>
                                <SelectItem value="1W">Last 1 Week</SelectItem>
                                <SelectItem value="1M">Last 1 Month</SelectItem>
                                <SelectItem value="3M">Last 3 Months</SelectItem>
                                <SelectItem value="6M">Last 6 Months</SelectItem>
                                <SelectItem value="ALL">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto">
                        <Button className="gap-2 shrink-0 h-9 rounded-lg shadow-sm" onClick={openAdd}>
                            <Plus className="h-4 w-4" />
                            Add
                        </Button>
                    </div>
                </div>
            </div>

            <AddTransactionDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
                {allTransactions === undefined ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : !transactions?.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Activity className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">No transactions yet</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                            Every buy or sell you make is a transaction — the building block of your portfolio.
                        </p>
                        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Record Your First Trade
                        </Button>
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <TransactionCard
                            key={tx.id}
                            tx={tx}
                            currencySymbol={getCurrencySymbolForPair(tx.symbol, pairConfigs)}
                            isSelected={selectedIds.has(tx.id)}
                            isSelectionMode={isSelectionMode}
                            onToggleSelection={toggleSelection}
                            onViewDetail={(id) => navigate(`/transactions/${id}`)}
                            onEdit={(id) => setEditingTxId(id)}
                            onDelete={confirmSingleDelete}
                            isEditing={editingTxId === tx.id}
                            setIsEditing={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}
                        />
                    ))
                )}

                {/* Edit dialog for mobile swipe action */}
                {editingTxId && (() => {
                    const editTx = transactions?.find(t => t.id === editingTxId);
                    if (!editTx) return null;
                    return (
                        <Dialog open={true} onOpenChange={(isOpen) => { if (!isOpen) setEditingTxId(null); }}>
                            <DialogContent className="w-[95vw] max-w-lg rounded-xl p-4">
                                <DialogHeader>
                                    <DialogTitle>Edit Transaction</DialogTitle>
                                </DialogHeader>
                                <TransactionEditForm transaction={editTx} onSuccess={() => setEditingTxId(null)} />
                            </DialogContent>
                        </Dialog>
                    );
                })()}
            </div>

            {/* Desktop Row-Card Layout */}
            <div className="hidden md:block space-y-3">
                {allTransactions === undefined ? (
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : !transactions?.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Activity className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">No transactions yet</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                            Every buy or sell you make is a transaction — the building block of your portfolio.
                        </p>
                        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Record Your First Trade
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 md:space-y-2">
                        <TransactionListHeader showAsset={true} />
                        
                        {transactions.map((tx) => (
                            <TransactionCard
                                key={tx.id}
                                tx={tx}
                                currencySymbol={getCurrencySymbolForPair(tx.symbol, pairConfigs)}
                                isSelected={selectedIds.has(tx.id)}
                                isSelectionMode={isSelectionMode}
                                onToggleSelection={toggleSelection}
                                onViewDetail={(id) => navigate(`/transactions/${id}`)}
                                onEdit={(id) => setEditingTxId(id)}
                                onDelete={confirmSingleDelete}
                                isEditing={editingTxId === tx.id}
                                setIsEditing={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={confirmDeleteState.isOpen} onOpenChange={(isOpen) => setConfirmDeleteState(prev => ({ ...prev, isOpen }))}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription className="pt-2">
                            {confirmDeleteState.type === 'bulk'
                                ? `Are you sure you want to delete ${selectedIds.size} transaction(s)? This will cascade correctly removing them from any associated active strategy tracking.`
                                : `Are you sure you want to delete this transaction? It will be removed from all associated strategies.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setConfirmDeleteState({ isOpen: false, type: 'single' })}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={executeDelete}>
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreatePositionDialogOpen} onOpenChange={setIsCreatePositionDialogOpen}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Strategy</DialogTitle>
                        {!createPositionError && (
                            <DialogDescription>
                                Review the performance of the {selectedIds.size} selected trades before creating.
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {createPositionError ? (
                        <div className="flex gap-2 p-3 bg-destructive/5 text-destructive border border-destructive/20 rounded-xl">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold">Cannot Create Strategy</p>
                                <p className="text-xs mt-0.5">{createPositionError}</p>
                            </div>
                        </div>
                    ) : null}

                    {/* Performance Preview + form — only shown when no error */}
                    <div className={createPositionError ? 'hidden' : ''}>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        {(() => {
                            const selectedTxs = allTransactions?.filter(tx => selectedIds.has(tx.id)) || []
                            if (selectedTxs.length === 0) return null
                            
                            const symbol = selectedTxs[0].symbol
                            const previewCurrencySymbol = getCurrencySymbolForPair(symbol, pairConfigs)
                            const virtualPos = {
                                symbol,
                                status: 'OPEN' as const,
                                entries: selectedTxs.map(tx => ({ transactionId: tx.id, allocatedAmount: tx.quantity })),
                                id: 'preview',
                                startDate: Math.min(...selectedTxs.map(tx => tx.date))
                            }
                            
                            const metrics = getPositionMetrics(virtualPos, selectedTxs, prices)
                            
                            return (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground uppercase font-bold tracking-widest">Asset</span>
                                        <span className="font-mono font-bold text-foreground">{symbol}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Avg Buy</span>
                                            <span className="text-sm font-mono font-bold">{metrics.avgBuyPrice > 0 ? `${previewCurrencySymbol}${metrics.avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '--'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Qty</span>
                                            <span className="text-sm font-mono font-bold text-right">{metrics.totalRemaining.toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">PnL (Est.)</span>
                                            <span className={`text-sm font-mono font-bold ${metrics.totalPnL > 0 ? 'text-pnl-up' : metrics.totalPnL < 0 ? 'text-pnl-down' : 'text-foreground'}`}>
                                                {previewCurrencySymbol}{metrics.totalPnL > 0 ? '+' : ''}{metrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">ROI</span>
                                            <span className={`text-sm font-mono font-bold text-right ${metrics.roi > 0 ? 'text-pnl-up' : metrics.roi < 0 ? 'text-pnl-down' : 'text-foreground'}`}>
                                                {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Strategy Name</Label>
                            <Input 
                                id="name" 
                                value={newPositionName} 
                                onChange={(e) => setNewPositionName(e.target.value)}
                                className="rounded-xl border-border/50 h-11 font-bold"
                                placeholder="Enter strategy name (e.g. Swing Trade)"
                            />
                        </div>

                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setIsCreatePositionDialogOpen(false)} className="rounded-xl h-11 flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={executeCreatePosition}
                            className="rounded-xl font-bold h-11 flex-[2]"
                        >
                            Create Strategy
                        </Button>
                    </div>
                    </div>{/* end hidden wrapper */}

                    {createPositionError && (
                        <div className="flex justify-end pt-2">
                            <Button variant="outline" onClick={() => setIsCreatePositionDialogOpen(false)} className="rounded-xl h-11">
                                Close
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>



            {selectedIds.size > 0 && (
                <div className="fixed bottom-28 md:bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-popover text-popover-foreground border shadow-xl rounded-full px-3 py-2.5 md:px-4 md:py-3 flex items-center justify-between gap-3 md:gap-6 w-max max-w-[90vw]">
                        <div className="flex items-center gap-2">
                            <div className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm">
                                {selectedIds.size}
                            </div>
                            <span className="text-sm font-semibold hidden sm:inline-block">Selected</span>
                        </div>
                        
                        <div className="h-4 w-[1px] bg-border hidden sm:block"></div>
                        
                        <div className="flex items-center gap-1 md:gap-2">
                            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-8 rounded-full text-xs md:text-sm px-2 md:px-3">
                                <CheckSquare className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">{selectedIds.size === transactions?.length ? 'Deselect All' : 'Select All'}</span>
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCreatePositionClick}
                                disabled={isFetchingPreviewPrice}
                                className="h-8 rounded-full text-xs md:text-sm px-2 md:px-4 shadow-sm bg-primary/10 hover:bg-primary/20 text-primary border-none"
                            >
                                {isFetchingPreviewPrice
                                    ? <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
                                    : <FolderPlus className="h-4 w-4 md:mr-2" />
                                }
                                <span className="hidden md:inline">Create Strategy</span>
                            </Button>
                            <Button variant="destructive" size="sm" onClick={confirmBulkDelete} className="h-8 rounded-full text-xs md:text-sm px-2 md:px-4 shadow-sm">
                                <Trash2 className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Delete</span>
                            </Button>
                        </div>
                        
                        <div className="h-4 w-[1px] bg-border"></div>
                        
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

        </div>
    )
}
