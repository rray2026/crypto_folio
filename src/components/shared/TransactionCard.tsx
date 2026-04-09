import { format } from "date-fns"
import { Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { Card, CardContent } from "@/components/ui/card"
import { SwipeActions } from "@/components/shared/SwipeActions"
import type { Transaction } from "@/lib/types"

interface TransactionCardProps {
    tx: Transaction;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onToggleSelection?: (id: string) => void;
    onViewDetail: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    isEditing: boolean;
    setIsEditing: (isOpen: boolean) => void;
    showAsset?: boolean;
    className?: string;
    currencySymbol?: string;
}

/**
 * Shared Header for Transaction Lists (Desktop only)
 */
export function TransactionListHeader({ showAsset = true }: { showAsset?: boolean }) {
    const gridCols = showAsset
        ? "grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_80px]"
        : "grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px]";

    return (
        <div className={`hidden md:grid px-6 py-2 ${gridCols} text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60`}>
            {showAsset && <div>Asset</div>}
            <div>Date</div>
            <div>Side</div>
            <div className="text-right">Price</div>
            <div className="text-right">Quantity</div>
            <div className="text-right">Total Amount</div>
            <div className="text-right">Fee</div>
            <div></div>
        </div>
    );
}

export function TransactionCard({
    tx,
    isSelected,
    isSelectionMode,
    onToggleSelection,
    onViewDetail,
    onEdit,
    onDelete,
    isEditing,
    setIsEditing,
    showAsset = true,
    className = "",
    currencySymbol = "$"
}: TransactionCardProps) {
    const gridCols = showAsset
        ? "md:grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_80px]"
        : "md:grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px]";

    const [base] = tx.symbol.split('/');

    const handleClick = () => {
        if (isSelectionMode) {
            onToggleSelection?.(tx.id);
        } else {
            onViewDetail(tx.id);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`group relative transition-all duration-200 cursor-pointer select-none ${className}`}
        >
            {/* Desktop View: Sleek Row Layout */}
            <div className={`hidden md:grid ${gridCols} items-center px-6 py-3 rounded-xl border ${
                isSelected
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card border-border/50 hover:border-border hover:bg-card/80'
            }`}>
                {showAsset && <div className="font-semibold text-sm tracking-tight">{tx.symbol}</div>}
                <div className="text-[11px] font-mono text-muted-foreground/80">
                    {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                </div>
                <div>
                    <div className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                        tx.type === "BUY"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40"
                    }`}>
                        {tx.type}
                    </div>
                </div>
                <div className="text-right font-mono font-medium text-sm text-foreground/80">{currencySymbol}{tx.price.toLocaleString()}</div>
                <div className="text-right font-mono font-medium text-sm text-foreground/80">{tx.quantity.toLocaleString()}</div>
                <div className="text-right font-mono font-semibold text-sm text-primary/90">{currencySymbol}{tx.amount.toLocaleString()}</div>
                <div className={`text-right font-mono font-medium text-xs text-muted-foreground/60 ${!showAsset ? "mr-4" : ""}`}>{currencySymbol}{tx.fee.toLocaleString()}</div>

                <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <Dialog open={isEditing} onOpenChange={setIsEditing}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background/80" onClick={(e) => { e.stopPropagation(); onEdit(tx.id); }}>
                                <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6">
                            <DialogHeader>
                                <DialogTitle>Edit Transaction</DialogTitle>
                            </DialogHeader>
                            <TransactionEditForm transaction={tx} onSuccess={() => setIsEditing(false)} />
                        </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive hover:bg-destructive/5" onClick={(e) => onDelete(tx.id, e)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            {/* Mobile View: Swipe-to-reveal actions, tap to view detail */}
            <div className="md:hidden">
                <SwipeActions
                    disabled={isSelectionMode}
                    actions={[
                        {
                            icon: <Edit className="h-4 w-4" />,
                            bg: "bg-blue-500",
                            onAction: () => { onEdit(tx.id); setIsEditing(true); },
                        },
                        {
                            icon: <Trash2 className="h-4 w-4" />,
                            bg: "bg-red-500",
                            onAction: () => onDelete(tx.id, { stopPropagation: () => {} } as React.MouseEvent),
                        },
                    ]}
                >
                    <Card className={`overflow-hidden transition-all duration-200 border-border/50 ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'bg-background'
                    }`}>
                        <CardContent className="p-3 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {showAsset && <span className="font-semibold text-sm">{tx.symbol}</span>}
                                        <div className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                                            tx.type === "BUY"
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40"
                                            : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40"
                                        }`}>
                                            {tx.type}
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground mt-1">
                                        {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/30">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Price</span>
                                    <span className="font-mono text-sm">{currencySymbol}{tx.price.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Quantity</span>
                                    <span className="font-mono text-sm">{tx.quantity.toLocaleString()} <span className="text-[10px]">{base}</span></span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Total</span>
                                    <span className="font-mono text-sm font-semibold text-primary/90">{currencySymbol}{tx.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Fee</span>
                                    <span className="font-mono text-xs text-muted-foreground">{currencySymbol}{tx.fee.toLocaleString()}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </SwipeActions>

                {/* Edit dialog — triggered by swipe action */}
                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogContent className="w-[95vw] max-w-lg rounded-xl p-4">
                        <DialogHeader>
                            <DialogTitle>Edit Transaction</DialogTitle>
                        </DialogHeader>
                        <TransactionEditForm transaction={tx} onSuccess={() => setIsEditing(false)} />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
