import { useParams, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { format } from "date-fns"
import { ArrowLeft, Trash2, Edit, Calendar, Clock, Wallet, Activity, Hash, Link as LinkIcon, Circle, EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { useState } from "react"
import { badge, txBadgeColor, statusBadgeColor } from "@/lib/styles"

export default function TransactionDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const deleteTransaction = useTransactionStore(state => state.deleteTransaction)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { setMobileHeader } = useMobileHeader()

    const transaction = useLiveQuery(() => id ? db.transactions.get(id) : undefined, [id])
    const allPositions = useLiveQuery(() => db.positions.toArray())

    useEffect(() => {
        setMobileHeader({
            title: transaction ? `${transaction.symbol}` : "Transaction",
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
                            onClick={() => { setIsMobileMenuOpen(false); setIsEditDialogOpen(true); }}
                        >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                            Edit
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
    }, [transaction, navigate, setMobileHeader, isMobileMenuOpen])

    if (transaction === undefined) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    if (transaction === null) return <div className="p-8 text-center text-foreground">Transaction not found.</div>

    // Find positions that use this transaction
    const linkedPositions = allPositions?.filter(pos =>
        pos.entries.some(e => e.transactionId === transaction.id)
    ) || []

    const { pairConfigs } = useSettingsStore.getState()
    const currencySymbol = getCurrencySymbolForPair(transaction.symbol, pairConfigs)

    const executeDelete = async () => {
        if (!id) return
        await deleteTransaction(id)
        navigate('/transactions')
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8">
            {/* Header (desktop only — mobile uses MobileHeader) */}
            <div className="hidden md:flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">{transaction.symbol}</h1>
                        <div className={`${badge({ color: txBadgeColor(transaction.type) })} px-2 text-[10px] md:text-xs tracking-widest`}>
                            {transaction.type}
                        </div>
                    </div>
                    <p className="text-muted-foreground text-xs md:text-sm mt-1">Transaction Details</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-2 h-9" onClick={() => setIsDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Delete</span>
                    </Button>
                </div>
            </div>
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                        <DialogDescription className="pt-2">
                            Are you sure you want to delete this transaction? It will be removed from all associated positions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={executeDelete}>Delete</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Single Edit dialog — shared between desktop and mobile menu */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    <TransactionEditForm transaction={transaction} onSuccess={() => setIsEditDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Information */}
                <Card className="md:col-span-2 bg-card/40 border-border/40 overflow-hidden">
                    <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Execution Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-y-8">
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
                                    <Wallet className="h-3 w-3" /> Execution Price
                                </span>
                                <p className="text-xl md:text-2xl font-mono font-black">{currencySymbol}{transaction.price.toLocaleString()}</p>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1.5">
                                    <Activity className="h-3 w-3" /> Quantity
                                </span>
                                <p className="text-xl md:text-2xl font-mono font-black">{transaction.quantity.toLocaleString()}</p>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-tight">Total Value</span>
                                <p className="text-xl md:text-2xl font-mono font-black">{currencySymbol}{transaction.amount.toLocaleString()}</p>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-tight">Fee Paid</span>
                                <p className="text-xl md:text-2xl font-mono font-black text-muted-foreground">{currencySymbol}{transaction.fee.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-muted/50">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Execution Date</p>
                                    <p className="text-sm font-medium">{format(new Date(transaction.date), "yyyy/MM/dd")}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-muted/50">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Execution Time</p>
                                    <p className="text-sm font-medium">{format(new Date(transaction.date), "HH:mm:ss")}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 sm:col-span-2">
                                <div className="p-2 rounded-lg bg-muted/50">
                                    <Hash className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                        {transaction.orderId ? "Order ID" : "Transaction ID"}
                                    </p>
                                    <p className="text-xs font-mono break-all text-muted-foreground select-all">
                                        {transaction.orderId ?? transaction.id}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Linked Positions */}
                <div className="space-y-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                        <LinkIcon className="h-4 w-4" />
                        Linked Strategies
                    </h2>
                    {linkedPositions.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Not linked to any positions.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {linkedPositions.map(pos => {
                                const entry = pos.entries.find(e => e.transactionId === transaction.id);
                                return (
                                    <button 
                                        key={pos.id}
                                        onClick={() => navigate(`/positions/${pos.id}`)}
                                        className="w-full text-left p-4 rounded-xl border bg-card/40 hover:bg-card/80 transition-all group border-border/40 hover:border-border shadow-sm"
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="font-bold text-sm truncate pr-2">
                                                {pos.strategyName || `${pos.symbol.split('/')[0]} Strategy`}
                                            </span>
                                            <span className={badge({ color: statusBadgeColor(pos.status) })}>
                                                <Circle className={`h-1.5 w-1.5 fill-current ${pos.status === 'OPEN' ? 'animate-pulse' : ''}`} aria-hidden="true" />
                                                {pos.status === 'OPEN' ? 'ACTIVE' : 'CLOSED'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/10">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Allocated</span>
                                            <span className="text-xs font-mono font-bold">{entry?.allocatedAmount}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
