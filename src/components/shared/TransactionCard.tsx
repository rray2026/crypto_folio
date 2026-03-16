import { format } from "date-fns"
import { Eye, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TransactionEditForm } from "@/components/transactions/TransactionEditForm"
import { Card, CardContent } from "@/components/ui/card"
import type { Transaction } from "@/lib/types"

interface TransactionCardProps {
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
    onToggleSelection, 
    onViewDetail, 
    onEdit, 
    onDelete,
    isEditing,
    setIsEditing,
    showAsset = true,
    className = ""
}: TransactionCardProps) {
    const gridCols = showAsset 
        ? "md:grid-cols-[1.2fr_1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_80px]" 
        : "md:grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px]";

    const [base] = tx.symbol.split('/');

    return (
        <div
            onClick={() => onToggleSelection?.(tx.id)}
            className={`group relative transition-all duration-200 ${
                onToggleSelection ? 'cursor-pointer' : 'cursor-default'
            } ${className}`}
        >
            {/* Desktop View: Sleek Row Layout */}
            <div className={`hidden md:grid ${gridCols} items-center px-6 py-3 rounded-xl border ${
                isSelected
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card/40 border-border/40 hover:border-border hover:bg-card/60'
            }`}>
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

            {/* Mobile View: Premium Card Layout */}
            <Card className={`md:hidden overflow-hidden transition-all duration-200 border-border/40 ${
                isSelected ? 'ring-2 ring-primary bg-primary/5' : 'bg-card/60'
            }`}>
                <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                {showAsset && <span className="font-bold text-lg">{tx.symbol}</span>}
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    tx.type === "BUY" 
                                    ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                                }`}>
                                    {tx.type}
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground mt-1">
                                {format(new Date(tx.date), "yyyy/MM/dd HH:mm")}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onViewDetail(tx.id); }}>
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(tx.id); }}>
                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-lg rounded-xl p-4">
                                    <DialogHeader>
                                        <DialogTitle>Edit Transaction</DialogTitle>
                                    </DialogHeader>
                                    <TransactionEditForm transaction={tx} onSuccess={() => setIsEditing(false)} />
                                </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={(e) => onDelete(tx.id, e)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Price</span>
                            <span className="font-mono text-sm">${tx.price.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Quantity</span>
                            <span className="font-mono text-sm">{tx.quantity.toLocaleString()} <span className="text-[10px]">{base}</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Total</span>
                            <span className="font-mono text-sm font-bold text-primary">${tx.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Fee</span>
                            <span className="font-mono text-xs text-muted-foreground">${tx.fee.toLocaleString()}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
