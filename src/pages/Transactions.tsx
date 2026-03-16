import { useState } from "react"
import { TransactionCard, TransactionListHeader } from "@/components/shared/TransactionCard"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { ImportTransactionsButton } from "@/components/transactions/ImportTransactionsButton"
import { format } from "date-fns"
import { Plus, Trash2, Edit, X, CheckSquare, FileUp, Keyboard, Eye, FolderPlus, AlertCircle, Activity, Calendar } from "lucide-react"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
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
    DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

export default function Transactions() {
    const navigate = useNavigate()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [addMode, setAddMode] = useState<'choice' | 'manual'>('choice')
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [confirmDeleteState, setConfirmDeleteState] = useState<{ isOpen: boolean, type: 'single' | 'bulk', targetId?: string }>({ isOpen: false, type: 'single' })
    const [isCreatePositionDialogOpen, setIsCreatePositionDialogOpen] = useState(false)
    const [newPositionName, setNewPositionName] = useState("")
    const [newPositionType, setNewPositionType] = useState<'PRIMARY' | 'SHADOW'>('PRIMARY')
    
    const [filterSymbol, setFilterSymbol] = useState<string>("ALL")
    const [filterTimeRange, setFilterTimeRange] = useState<string>("ALL")

    const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)
    const bulkDeleteTransactions = useTransactionStore((state) => state.bulkDeleteTransactions)
    const createPosition = usePositionStore((state) => state.createPosition)
    const addTransactionToPosition = usePositionStore((state) => state.addTransactionToPosition)
    const positions = useLiveQuery(() => db.positions.toArray())
    const { prices, fetchPrices } = useSettingsStore()

    // Reactively fetch all transactions
    const allTransactions = useLiveQuery(
        () => db.transactions.orderBy("date").reverse().toArray()
    )

    // Get unique symbols for filter
    const uniqueSymbols = Array.from(new Set(allTransactions?.map(tx => tx.symbol) || [])).sort();

    // Filter logic
    const transactions = allTransactions?.filter(tx => {
        const symbolMatch = filterSymbol === "ALL" || tx.symbol === filterSymbol;
        
        let timeMatch = true;
        if (filterTimeRange !== "ALL") {
            const now = Date.now();
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
            return newSet;
        });
    }

    const toggleAll = () => {
        if (!transactions) return;
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    }

    const handleCreatePositionClick = () => {
        if (!allTransactions || selectedIds.size === 0) return

        const selectedTxs = allTransactions.filter(tx => selectedIds.has(tx.id))
        const symbols = new Set(selectedTxs.map(tx => tx.symbol))

        if (symbols.size > 1) {
            alert("Cannot create position: All selected transactions must have the same trading pair.")
            return
        }

        const symbol = Array.from(symbols)[0]
        setNewPositionName("")
        setIsCreatePositionDialogOpen(true)
        
        // Ensure price is fresh for the preview
        fetchPrices([symbol])
    }

    const executeCreatePosition = async () => {
        if (!allTransactions || selectedIds.size === 0) return

        const selectedTxs = allTransactions.filter(tx => selectedIds.has(tx.id))
        const symbol = selectedTxs[0].symbol

        const positionId = await createPosition({
            symbol,
            strategyName: newPositionName || undefined,
            type: newPositionType,
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
        // toast.success("Position created", {
        //     description: `Successfully created ${newPositionName} with ${selectedTxs.length} trades.`
        // })
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
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

                        <Select value={filterTimeRange} onValueChange={setFilterTimeRange}>
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
                        <Dialog 
                            open={isAddDialogOpen} 
                            onOpenChange={(open) => {
                                setIsAddDialogOpen(open);
                                if (open) setAddMode('choice');
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button className="gap-2 shrink-0 h-9 rounded-lg shadow-sm">
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6 overflow-hidden">
                                <DialogHeader>
                                    <DialogTitle>
                                        {addMode === 'manual' ? 'Record Transaction' : 'Add Transaction'}
                                    </DialogTitle>
                                    {addMode === 'choice' && (
                                        <DialogDescription>
                                            Choose how you want to add your trade records.
                                        </DialogDescription>
                                    )}
                                </DialogHeader>
                                
                                {addMode === 'choice' ? (
                                    <div className="grid grid-cols-1 gap-4 py-6">
                                        <Button 
                                            variant="outline" 
                                            className="h-24 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                                            onClick={() => setAddMode('manual')}
                                        >
                                            <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                                <Keyboard className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">Manual Entry</span>
                                                <span className="text-xs text-muted-foreground">Type trade details manually</span>
                                            </div>
                                        </Button>
                                        
                                        <ImportTransactionsButton 
                                            className="h-24 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                                            variant="outline"
                                        >
                                            <div className="p-2 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                                                <FileUp className="h-6 w-6 text-blue-500" />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">Import from Binance</span>
                                                <span className="text-xs text-muted-foreground">Upload exported Excel file</span>
                                            </div>
                                        </ImportTransactionsButton>
                                    </div>
                                ) : (
                                    <TransactionForm onSuccess={() => setIsAddDialogOpen(false)} />
                                )}
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* FAB replaces the top selection bar */}

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
                {!transactions?.length ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground border rounded-lg bg-card/50">
                        <p>No transactions recorded yet.</p>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                            Record Your First Trade
                        </Button>
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div 
                            key={tx.id} 
                            onClick={() => toggleSelection(tx.id)}
                            className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer group ${
                                selectedIds.has(tx.id) 
                                ? 'bg-primary/10 border-primary shadow-sm' 
                                : 'bg-background/40 border-border hover:border-primary/40 hover:bg-background/60 shadow-sm'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg tracking-tight">{tx.symbol}</span>
                                    <div className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        tx.type === "BUY" 
                                        ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                                    }`}>
                                        {tx.type}
                                    </div>
                                </div>
                                <div className="flex gap-1 -mr-2 -mt-1.5">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/transactions/${tx.id}`); }}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6">
                                            <DialogHeader>
                                                <DialogTitle>Edit Transaction</DialogTitle>
                                            </DialogHeader>
                                            <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                        </DialogContent>
                                    </Dialog>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={(e) => confirmSingleDelete(tx.id, e)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-y-2.5 text-xs">
                                <div className="flex justify-between items-center pr-4">
                                    <span className="text-muted-foreground font-medium">Price</span>
                                    <span className="font-mono font-bold">${tx.price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">Qty</span>
                                    <span className="font-mono font-bold">{tx.quantity.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pr-4">
                                    <span className="text-muted-foreground font-medium">Value</span>
                                    <span className="font-mono font-black text-primary/90">${tx.amount.toLocaleString()}</span>
                                </div>
                                {tx.fee > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Fee</span>
                                        <span className="font-mono text-muted-foreground font-bold">${tx.fee.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-3 pt-2.5 border-t border-border/20 flex justify-end">
                                <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tighter">
                                    {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Row-Card Layout */}
            <div className="hidden md:block space-y-3">
                {!transactions?.length ? (
                    <Card className="border-dashed shadow-none">
                        <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                            <p>No transactions recorded yet.</p>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} className="mt-4">
                                Record Your First Trade
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4 md:space-y-2">
                        <TransactionListHeader showAsset={true} />
                        
                        {transactions.map((tx) => (
                            <TransactionCard 
                                key={tx.id}
                                tx={tx}
                                isSelected={selectedIds.has(tx.id)}
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
                                ? `Are you sure you want to delete ${selectedIds.size} transaction(s)? This will cascade correctly removing them from any associated active position tracking.`
                                : `Are you sure you want to delete this transaction? It will be removed from all associated positions.`
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
                        <DialogTitle>Create New Position</DialogTitle>
                        <DialogDescription>
                            Review the performance of the {selectedIds.size} selected trades before creating.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {/* Performance Preview */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        {(() => {
                            const selectedTxs = allTransactions?.filter(tx => selectedIds.has(tx.id)) || []
                            if (selectedTxs.length === 0) return null
                            
                            const symbol = selectedTxs[0].symbol
                            const virtualPos = {
                                symbol,
                                status: 'OPEN' as const,
                                type: 'PRIMARY' as const,
                                entries: selectedTxs.map(tx => ({ transactionId: tx.id, allocatedAmount: tx.quantity })),
                                id: 'preview',
                                startDate: Math.min(...selectedTxs.map(tx => tx.date))
                            }
                            
                            const metrics = getPositionMetrics(virtualPos, selectedTxs, prices)
                            
                            return (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground uppercase font-bold tracking-widest">Asset</span>
                                        <span className="font-mono font-bold text-primary">{symbol}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Avg Entry</span>
                                            <span className="text-sm font-mono font-bold">${(metrics.positionType === 'LONG' ? metrics.avgBuyPrice : metrics.avgSellPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Qty</span>
                                            <span className="text-sm font-mono font-bold text-right">{metrics.totalRemaining.toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">PnL (Est.)</span>
                                            <span className={`text-sm font-mono font-bold ${metrics.totalPnL > 0 ? 'text-green-500' : metrics.totalPnL < 0 ? 'text-red-500' : ''}`}>
                                                ${metrics.totalPnL > 0 ? '+' : ''}{metrics.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">ROI</span>
                                            <span className={`text-sm font-mono font-bold text-right ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-red-500' : ''}`}>
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
                            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Position Name / Strategy</Label>
                            <Input 
                                id="name" 
                                value={newPositionName} 
                                onChange={(e) => setNewPositionName(e.target.value)}
                                className="rounded-xl border-border/50 h-11 font-bold"
                                placeholder="Enter strategy name (e.g. Swing Trade)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Position Type</Label>
                            <Select value={newPositionType} onValueChange={(val: any) => setNewPositionType(val)}>
                                <SelectTrigger className="w-full h-11 rounded-xl font-bold border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRIMARY">🎯 Strategic (Primary)</SelectItem>
                                    <SelectItem value="SHADOW">👀 Analysis (Shadow)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                                {newPositionType === 'PRIMARY' 
                                    ? "Counted towards global portfolio metrics. Best for real trades." 
                                    : "Educational or experimental group. Not counted in total profit."}
                            </p>
                        </div>

                        {/* Conflict Warning */}
                        {newPositionType === 'PRIMARY' && (() => {
                            const selectedTxs = allTransactions?.filter(tx => selectedIds.has(tx.id)) || []
                            const transactionsWithPrimary = selectedTxs.filter(tx => {
                                const associatedPrimary = positions?.filter(p => p.type === 'PRIMARY')
                                    .some(p => p.entries.some(e => e.transactionId === tx.id))
                                return associatedPrimary
                            })
                            
                            if (transactionsWithPrimary.length > 0) {
                                return (
                                    <div className="flex gap-2 p-3 bg-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/10 rounded-xl">
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-bold leading-none">Duplicate Account Detection</p>
                                            <p className="text-[10px] leading-relaxed">
                                                {transactionsWithPrimary.length} of the selected trades are already in another <b>Strategic (Primary)</b> position. 
                                                Including them here will cause double-counting in your total PnL.
                                            </p>
                                        </div>
                                    </div>
                                )
                            }
                            return null
                        })()}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setIsCreatePositionDialogOpen(false)} className="rounded-xl h-11 flex-1">
                            Cancel
                        </Button>
                        <Button 
                            onClick={executeCreatePosition} 
                            className="rounded-xl font-bold h-11 flex-[2]"
                        >
                            Create Position
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>



            {selectedIds.size > 0 && (
                <div className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
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
                                className="h-8 rounded-full text-xs md:text-sm px-2 md:px-4 shadow-sm bg-primary/10 hover:bg-primary/20 text-primary border-none"
                            >
                                <FolderPlus className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Create Position</span>
                            </Button>
                            <Button variant="destructive" size="sm" onClick={confirmBulkDelete} className="h-8 rounded-full text-xs md:text-sm px-2 md:px-4 shadow-sm">
                                <Trash2 className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Delete</span>
                            </Button>
                        </div>
                        
                        <div className="h-4 w-[1px] bg-border"></div>
                        
                        <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Mobile Fixed Action Button (bottom-right) */}
            <div className="sm:hidden fixed bottom-20 right-4 z-40">
                <Button 
                    size="icon" 
                    className="h-14 w-14 rounded-full shadow-lg opacity-90 backdrop-blur-md hover:opacity-100 transition-opacity border border-primary/20"
                    onClick={() => {
                        setAddMode('choice');
                        setIsAddDialogOpen(true);
                    }}
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>
        </div>
    )
}
