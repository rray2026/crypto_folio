import { useState } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Lock } from "lucide-react"
import type { Transaction } from "@/lib/types"

export function TransactionEditForm({ transaction, onSuccess }: { transaction: Transaction, onSuccess: () => void }) {
    const updateTransaction = useTransactionStore((state) => state.updateTransaction)
    const predefinedPairs = useSettingsStore((state) => state.predefinedPairs)

    // Initial State using existing transaction data
    const [symbol, setSymbol] = useState(transaction.symbol)
    const [type, setType] = useState<"BUY" | "SELL">(transaction.type)
    const [price, setPrice] = useState(transaction.price.toString())
    const [quantity, setQuantity] = useState(transaction.quantity.toString())
    const [amount, setAmount] = useState(transaction.amount.toString())
    const [fee, setFee] = useState(transaction.fee.toString())

    // Format timestamp back to HTML datetime-local string (YYYY-MM-DDThh:mm)
    const [date, setDate] = useState(() => {
        const d = new Date(transaction.date);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    })

    // Handlers for dynamic math
    const handlePriceChange = (val: string) => {
        setPrice(val);
        const p = parseFloat(val);
        const q = parseFloat(quantity);
        if (!isNaN(p) && !isNaN(q)) setAmount((p * q).toString());
    }

    const handleQuantityChange = (val: string) => {
        setQuantity(val);
        const q = parseFloat(val);
        const p = parseFloat(price);
        if (!isNaN(p) && !isNaN(q)) setAmount((p * q).toString());
    }

    const handleAmountChange = (val: string) => {
        setAmount(val);
        const a = parseFloat(val);
        const p = parseFloat(price);
        if (!isNaN(a) && !isNaN(p) && p > 0) setQuantity((a / p).toString());
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!symbol || !price || !quantity || !amount) return

        await updateTransaction(transaction.id, {
            symbol: symbol.toUpperCase(),
            type,
            price: parseFloat(price),
            quantity: parseFloat(quantity),
            amount: parseFloat(amount),
            fee: parseFloat(fee || "0"),
            date: new Date(date).getTime(),
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Asset Symbol</Label>
                    <span className="text-[9px] flex items-center gap-1 text-muted-foreground/50">
                        <Lock className="h-2.5 w-2.5" /> Immutable
                    </span>
                </div>
                <Input
                    value={symbol}
                    className="rounded-xl bg-muted/20 border-border/30 h-11 text-base font-bold tracking-tight opacity-70"
                    disabled={true}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Side</Label>
                    <div className="flex p-1 bg-muted/20 rounded-xl border border-border/30 h-11 opacity-70">
                        <div className={`flex-1 flex items-center justify-center rounded-lg text-xs font-black ${
                            type === "BUY" ? "bg-background text-green-600 shadow-sm" : "text-muted-foreground/40"
                        }`}>
                            BUY
                        </div>
                        <div className={`flex-1 flex items-center justify-center rounded-lg text-xs font-black ${
                            type === "SELL" ? "bg-background text-red-600 shadow-sm" : "text-muted-foreground/40"
                        }`}>
                            SELL
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Date & Time</Label>
                    <div className="relative">
                        <Input 
                            type="datetime-local" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="rounded-xl border-border/50 h-11 font-mono text-xs pl-9"
                            required 
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Unit Price</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={e => handlePriceChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono pl-7 font-bold" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Quantity</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={quantity} onChange={e => handleQuantityChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono font-bold" required />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Total Amount</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={amount} onChange={e => handleAmountChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-primary font-black pl-7" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Fee</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-muted-foreground font-medium" />
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                    Update Transaction
                </Button>
            </div>
        </form>
    )
}
