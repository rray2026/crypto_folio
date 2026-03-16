import { format } from "date-fns"
import { Eye, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
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
    className = ""
}: TransactionRowProps) {
    const gridCols = showAsset 
        ? "grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_80px]" 
        : "grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px]";

    return (
        <div
            onClick={() => onToggleSelection?.(tx.id)}
            className={`group relative grid ${gridCols} items-center px-6 py-3 rounded-xl border transition-all duration-200 ${
                onToggleSelection ? 'cursor-pointer' : 'cursor-default'
            } ${
                isSelected
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card/40 border-border/40 hover:border-border hover:bg-card/60'
            } ${className}`}
        >
            {showAsset && <div className="font-bold text-base tracking-tight">{tx.symbol}</div>}
            <div className="text-[11px] font-mono text-muted-foreground/80">
                {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
            </div>
            <div>
                <div className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                    tx.type === "BUY" 
                    ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}>
                    {tx.type}
                </div>
            </div>
            <div className="text-right font-mono font-medium text-sm text-foreground/80">${tx.price.toLocaleString()}</div>
            <div className="text-right font-mono font-medium text-sm text-foreground/80">{tx.quantity.toLocaleString()}</div>
            <div className="text-right font-mono font-bold text-sm text-primary/90">${tx.amount.toLocaleString()}</div>
            <div className={`text-right font-mono font-medium text-xs text-muted-foreground/60 ${!showAsset ? "mr-4" : ""}`}>${tx.fee.toLocaleString()}</div>
            <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
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
}
