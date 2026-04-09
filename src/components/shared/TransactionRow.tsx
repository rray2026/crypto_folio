import { format } from "date-fns"
import { Eye, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { SwipeActions } from "@/components/shared/SwipeActions"
import type { Transaction } from "@/lib/types"

interface TransactionRowProps {
    tx: Transaction;
    isSelected?: boolean;
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

export function TransactionRow({
    tx,
    isSelected,
    onToggleSelection,
    onViewDetail,
    onEdit,
    onDelete,
    isEditing,
    setIsEditing,
    showAsset = true,
    className = "",
    currencySymbol = "$"
}: TransactionRowProps) {
    const gridCols = showAsset
        ? "grid-cols-[1.2fr_0.8fr_1fr] md:grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_80px]"
        : "grid-cols-[1.2fr_0.8fr_1fr] md:grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px]";

    const handleClick = () => {
        if (onToggleSelection) {
            onToggleSelection(tx.id);
        } else {
            onViewDetail(tx.id);
        }
    };

    const rowContent = (
        <div
            onClick={handleClick}
            className={`group relative grid ${gridCols} items-center px-4 md:px-6 py-3 md:rounded-xl border transition-all duration-200 ${
                onToggleSelection ? 'cursor-pointer' : 'cursor-default'
            } ${
                isSelected
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card border-border/50 hover:border-border hover:bg-card/80'
            } ${className}`}
        >
            <div className="flex flex-col md:block">
                {showAsset && <div className="font-semibold text-sm tracking-tight truncate">{tx.symbol}</div>}
                <div className="text-[10px] md:text-[11px] font-mono text-muted-foreground/80 truncate">
                    {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                </div>
            </div>

            <div className="flex justify-center md:justify-start">
                <div className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${
                    tx.type === "BUY"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40"
                }`}>
                    {tx.type}
                </div>
            </div>

            <div className="hidden md:block text-right font-mono font-medium text-sm text-foreground/80">{currencySymbol}{tx.price.toLocaleString()}</div>
            <div className="hidden md:block text-right font-mono font-medium text-sm text-foreground/80">{tx.quantity.toLocaleString()}</div>

            <div className="text-right font-mono font-semibold text-sm text-primary/90">
                {currencySymbol}{tx.amount.toLocaleString()}
                {!showAsset && <div className="md:hidden text-[10px] text-muted-foreground/60 font-normal">Fee: {currencySymbol}{tx.fee.toLocaleString()}</div>}
            </div>

            <div className={`hidden md:block text-right font-mono font-medium text-xs text-muted-foreground/60 ${!showAsset ? "mr-4" : ""}`}>{currencySymbol}{tx.fee.toLocaleString()}</div>

            {/* Desktop only: hover-reveal action buttons */}
            <div className="hidden md:flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background/80" onClick={(e) => { e.stopPropagation(); onViewDetail(tx.id); }}>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </Button>
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
    );

    return (
        <>
            {/* Mobile: wrap with swipe-to-reveal (Edit + Delete only, tap to view) */}
            <div className="md:hidden">
                <SwipeActions
                    disabled={!!isSelected}
                    actions={[
                        {
                            icon: <Edit className="h-4 w-4" />,
                            bg: "bg-amber-500",
                            onAction: () => { onEdit(tx.id); setIsEditing(true); },
                        },
                        {
                            icon: <Trash2 className="h-4 w-4" />,
                            bg: "bg-red-500",
                            onAction: () => onDelete(tx.id, { stopPropagation: () => {} } as React.MouseEvent),
                        },
                    ]}
                >
                    {rowContent}
                </SwipeActions>

                {/* Edit dialog for mobile swipe action */}
                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogContent className="w-[95vw] max-w-lg rounded-xl p-4">
                        <DialogHeader>
                            <DialogTitle>Edit Transaction</DialogTitle>
                        </DialogHeader>
                        <TransactionEditForm transaction={tx} onSuccess={() => setIsEditing(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Desktop: render row directly */}
            <div className="hidden md:block">
                {rowContent}
            </div>
        </>
    );
}
