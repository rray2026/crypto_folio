import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { ImportTransactionsButton } from "@/components/transactions/ImportTransactionsButton"
import { format } from "date-fns"
import { Plus, Trash2, Edit, X, CheckSquare, FileUp, Keyboard } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

export default function Transactions() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [addMode, setAddMode] = useState<'choice' | 'manual'>('choice')
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [confirmDeleteState, setConfirmDeleteState] = useState<{ isOpen: boolean, type: 'single' | 'bulk', targetId?: string }>({ isOpen: false, type: 'single' })
    
    const [filterSymbol, setFilterSymbol] = useState<string>("ALL")
    const [filterTimeRange, setFilterTimeRange] = useState<string>("ALL")

    const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)
    const bulkDeleteTransactions = useTransactionStore((state) => state.bulkDeleteTransactions)

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
                            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/50 rounded-lg border-border/50 text-xs shadow-sm">
                                <SelectValue placeholder="All Assets" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Assets</SelectItem>
                                {uniqueSymbols.map(sym => (
                                    <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterTimeRange} onValueChange={setFilterTimeRange}>
                            <SelectTrigger className="h-9 w-full sm:w-[140px] bg-muted/50 rounded-lg border-border/50 text-xs shadow-sm">
                                <SelectValue placeholder="All Time" />
                            </SelectTrigger>
                            <SelectContent>
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

            {/* Desktop Table Layout */}
            <Card className="hidden md:block">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Asset</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                                <TableHead className="text-right">Fee</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!transactions?.length ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p>No transactions recorded yet.</p>
                                            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                                                Record Your First Trade
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((tx) => (
                                    <TableRow 
                                        key={tx.id} 
                                        className={`group cursor-pointer transition-all duration-200 border-l-[4px] relative ${
                                            selectedIds.has(tx.id) 
                                            ? 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 border-l-primary' 
                                            : 'border-l-transparent hover:border-l-primary/30 hover:bg-muted/30'
                                        }`} 
                                        onClick={() => toggleSelection(tx.id)}
                                    >
                                        <TableCell className="font-bold pl-6 text-base tracking-tight">
                                            {tx.symbol}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground whitespace-nowrap text-xs font-mono">
                                            {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                                        </TableCell>
                                        <TableCell>
                                            <div className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                tx.type === "BUY" 
                                                ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                                            }`}>
                                                {tx.type}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-medium">${tx.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono font-medium">{tx.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono font-black text-primary/90">${tx.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono text-muted-foreground">${tx.fee.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all justify-end -mr-2">
                                                <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }}>
                                                            <Edit className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6">
                                                        <DialogHeader>
                                                            <DialogTitle>Edit Transaction</DialogTitle>
                                                        </DialogHeader>
                                                        <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                                    </DialogContent>
                                                </Dialog>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive hover:bg-destructive/5" onClick={(e) => confirmSingleDelete(tx.id, e)}>
                                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

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
