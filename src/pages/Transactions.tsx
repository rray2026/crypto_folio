import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { ImportTransactionsButton } from "@/components/transactions/ImportTransactionsButton"
import { format } from "date-fns"
import { Plus, Trash2, Edit } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"

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
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
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

            {selectedIds.size > 0 && (
                <div className="mb-4 p-4 border rounded-md bg-secondary flex items-center justify-between">
                    <span className="text-sm font-medium">
                        {selectedIds.size} transaction(s) selected
                    </span>
                    <Button variant="destructive" onClick={confirmBulkDelete} className="gap-2 shrink-0">
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                    </Button>
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={transactions && transactions.length > 0 && selectedIds.size === transactions.length}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Pair</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
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
                                    <TableRow key={tx.id} className="group cursor-pointer" onClick={() => toggleSelection(tx.id)}>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.has(tx.id)}
                                                onCheckedChange={() => toggleSelection(tx.id)}
                                                aria-label={`Select transaction ${tx.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {format(new Date(tx.date), "yyyy/MM/dd HH:mm:ss")}
                                        </TableCell>
                                        <TableCell className="font-bold">{tx.symbol}</TableCell>
                                        <TableCell>
                                            <Badge variant={tx.type === "BUY" ? "default" : "destructive"}>
                                                {tx.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">${tx.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">{tx.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">${tx.amount.toLocaleString()}</TableCell>
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
        </div>
    )
}
