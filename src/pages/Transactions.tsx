import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { ImportTransactionsButton } from "@/components/transactions/ImportTransactionsButton"
import { format } from "date-fns"
import { Plus, Trash2, Edit, X, CheckSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function Transactions() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [confirmDeleteState, setConfirmDeleteState] = useState<{ isOpen: boolean, type: 'single' | 'bulk', targetId?: string }>({ isOpen: false, type: 'single' })

    const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)
    const bulkDeleteTransactions = useTransactionStore((state) => state.bulkDeleteTransactions)

    // Reactively fetch transactions sorted by newest
    const transactions = useLiveQuery(
        () => db.transactions.orderBy("date").reverse().toArray()
    )

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your foundational trade records.</p>
                </div>
                <div className="hidden sm:flex flex-wrap items-center gap-2 md:gap-3">
                    <ImportTransactionsButton />
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shrink-0">
                                <Plus className="h-4 w-4" />
                                Add Transaction
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Record Transaction</DialogTitle>
                                <DialogDescription>
                                    Enter the details of your spot trade. This will be available to link to positions.
                                </DialogDescription>
                            </DialogHeader>
                            <TransactionForm onSuccess={() => setIsAddDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
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
                            className={`p-2.5 sm:p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                                selectedIds.has(tx.id) 
                                ? 'bg-primary/10 border-primary ring-1 ring-primary/20 shadow-sm' 
                                : 'bg-card border-border hover:border-primary/30 shadow-sm'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-base leading-none">{tx.symbol}</span>
                                    <Badge variant={tx.type === "BUY" ? "default" : "destructive"} className="text-[9px] h-4 px-1 py-0 uppercase tracking-widest leading-none">
                                        {tx.type}
                                    </Badge>
                                </div>
                                <div className="flex gap-0 -mr-2 -mt-2">
                                    <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }}>
                                                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>Edit Transaction</DialogTitle>
                                            </DialogHeader>
                                            <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                        </DialogContent>
                                    </Dialog>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => confirmSingleDelete(tx.id, e)}>
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-x-2 text-xs items-center">
                                <span className="text-muted-foreground">Price</span>
                                <span className="font-mono text-right col-span-3 font-medium">${tx.price.toLocaleString()}</span>
                                
                                <span className="text-muted-foreground">Qty</span>
                                <span className="font-mono text-right col-span-3 font-medium">{tx.quantity.toLocaleString()}</span>
                                
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-mono text-right col-span-3 font-medium">${tx.amount.toLocaleString()}</span>
                                
                                {tx.fee > 0 && (
                                    <>
                                        <span className="text-muted-foreground">Fee</span>
                                        <span className="font-mono text-right col-span-3">${tx.fee.toLocaleString()}</span>
                                    </>
                                )}
                            </div>
                            
                            <div className="mt-1.5 pt-1.5 border-t flex justify-end">
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    {format(new Date(tx.date), "yy/MM/dd HH:mm")}
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
                                        className={`group cursor-pointer transition-all duration-200 border-l-[4px] ${selectedIds.has(tx.id) ? 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 border-l-primary' : 'border-l-transparent hover:border-l-primary/30'}`} 
                                        onClick={() => toggleSelection(tx.id)}
                                    >
                                        <TableCell className="font-bold pl-6">
                                            {tx.symbol}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground whitespace-nowrap">
                                            {format(new Date(tx.date), "yyyy/MM/dd HH:mm:ss")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={tx.type === "BUY" ? "default" : "destructive"}>
                                                {tx.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">${tx.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">{tx.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono font-bold">${tx.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">${tx.fee.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                                <Dialog open={editingTxId === tx.id} onOpenChange={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTxId(tx.id); }}>
                                                            <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[425px]">
                                                        <DialogHeader>
                                                            <DialogTitle>Edit Transaction</DialogTitle>
                                                        </DialogHeader>
                                                        <TransactionEditForm transaction={tx} onSuccess={() => setEditingTxId(null)} />
                                                    </DialogContent>
                                                </Dialog>
                                                <Button variant="ghost" size="icon" onClick={(e) => confirmSingleDelete(tx.id, e)}>
                                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
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
                            <Badge variant="default" className="rounded-full px-2 py-0.5 text-xs shadow-sm">
                                {selectedIds.size}
                            </Badge>
                            <span className="text-sm font-medium hidden sm:inline-block">Selected</span>
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

            {/* Mobile Fixed Action Buttons (bottom-right) */}
            <div className="sm:hidden fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
                <div className="bg-background rounded-full shadow-lg">
                    <ImportTransactionsButton 
                        variant="secondary" 
                        size="icon" 
                        className="h-12 w-12 rounded-full shadow-md hover:bg-secondary/80 border"
                        iconOnly={true}
                    />
                </div>
                
                <Button 
                    size="icon" 
                    className="h-14 w-14 rounded-full shadow-lg"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>
        </div>
    )
}
