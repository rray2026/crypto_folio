import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { format } from "date-fns"
import { ArrowLeft, Trash2, Edit, Calendar, Clock, Hash, Target, Circle, EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { badge, txBadgeColor, label, sectionHeader } from "@/lib/styles"

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
    const allStrategies = useLiveQuery(() => db.strategies.toArray())

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

    // Resolve position display name
    const getPositionDisplayName = (pos: typeof linkedPositions[0]) => {
        if (pos.strategyId) {
            const strategy = allStrategies?.find(s => s.id === pos.strategyId)
            if (strategy) return strategy.name
        }
        return pos.strategyName || pos.symbol.split('/')[0]
    }

    const executeDelete = async () => {
        if (!id) return
        await deleteTransaction(id)
        navigate('/transactions')
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 min-h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-2 md:gap-4 flex-col sm:flex-row w-full">
                    <Button variant="ghost" size="icon" className="hidden md:inline-flex shrink-0 self-start mt-1" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 w-full min-w-0">
                        <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{transaction.symbol}</h1>

                        {/* Info chips */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 md:mt-3 text-xs md:text-sm text-muted-foreground font-mono">
                            <span className={`${badge({ color: txBadgeColor(transaction.type) })} px-2 text-[10px] md:text-xs tracking-widest`}>
                                {transaction.type}
                            </span>
                            <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                                <span>{format(new Date(transaction.date), "yyyy/MM/dd")}</span>
                            </div>
                            <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                <Clock className="h-3 w-3 md:h-4 md:w-4" />
                                <span>{format(new Date(transaction.date), "HH:mm:ss")}</span>
                            </div>
                            {(transaction.orderId || transaction.id) && (
                                <div className="flex items-center gap-1 md:gap-1.5 bg-background/50 rounded-md px-1.5 md:px-2 py-1 border border-border/50">
                                    <Hash className="h-3 w-3 md:h-4 md:w-4" />
                                    <span className="truncate max-w-[120px] md:max-w-[200px]" title={transaction.orderId ?? transaction.id}>
                                        {transaction.orderId ?? transaction.id.slice(0, 8)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {transaction.notes && (
                            <div className="mt-3 md:mt-4 p-2 md:p-3 bg-muted/30 rounded-lg border border-border/50 text-xs md:text-sm text-muted-foreground w-full max-w-2xl break-words">
                                <span className="font-semibold text-foreground/80 mr-2">Notes:</span>
                                {transaction.notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop action buttons */}
                <div className="hidden md:flex items-center gap-2 self-start">
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => setIsDeleteConfirmOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Metrics Card */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 sm:gap-y-6 gap-x-4">
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Price</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {currencySymbol}{transaction.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Quantity</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base sm:text-xl font-bold font-mono">{transaction.quantity.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{transaction.symbol.split('/')[0]}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Total Value</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`${label} sm:text-xs mb-1`}>Fee</span>
                            <span className="text-base sm:text-xl font-bold font-mono text-muted-foreground">
                                {transaction.fee > 0 ? `${currencySymbol}${transaction.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Linked Positions */}
            <div className="space-y-1.5">
                <span className={sectionHeader}>
                    Linked Positions ({linkedPositions.length})
                </span>
                <div className="space-y-3">
                    {linkedPositions.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-border/50 text-center">
                            <p className="text-sm text-muted-foreground">Not linked to any positions.</p>
                        </div>
                    ) : (
                        linkedPositions.map(pos => {
                            const entry = pos.entries.find(e => e.transactionId === transaction.id)
                            return (
                                <div
                                    key={pos.id}
                                    className="flex items-center justify-between p-3 border border-border/50 rounded-xl bg-card hover:bg-card/80 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/positions/${pos.id}`)}
                                >
                                    <div className="flex gap-3 md:gap-4 items-center min-w-0">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Target className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-sm font-semibold truncate">{getPositionDisplayName(pos)}</p>
                                            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <span>{pos.symbol}</span>
                                                <span className="opacity-50">·</span>
                                                <span className={pos.status === 'OPEN' ? 'text-primary font-semibold' : ''}>{pos.status}</span>
                                                {entry && (
                                                    <>
                                                        <span className="opacity-50">·</span>
                                                        <span className="bg-primary/5 text-primary px-1 rounded-sm font-semibold">Allocated: {entry.allocatedAmount}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                            pos.status === 'OPEN'
                                            ? 'bg-primary/10 text-primary border-primary/20'
                                            : 'text-muted-foreground border-border'
                                        }`}>
                                            <Circle className={`h-1.5 w-1.5 fill-current ${pos.status === 'OPEN' ? 'animate-pulse' : ''}`} />
                                            {pos.status}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Delete Confirm Dialog */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Transaction?</DialogTitle>
                        <DialogDescription className="pt-2">
                            This will permanently delete this transaction and remove it from all linked positions. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={executeDelete}>Delete</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    <TransactionEditForm transaction={transaction} onSuccess={() => setIsEditDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    )
}
