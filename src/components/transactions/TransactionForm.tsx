import { useState } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SymbolSelector } from "./SymbolSelector"
import { DateTimePicker } from "@/components/ui/DateTimePicker"

export function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
    const addTransaction = useTransactionStore((state) => state.addTransaction)
    const [symbol, setSymbol] = useState("")
    const [type, setType] = useState<"BUY" | "SELL">("BUY")
    const [price, setPrice] = useState("")
    const [quantity, setQuantity] = useState("")
    const [amount, setAmount] = useState("")
    const [fee, setFee] = useState("0")
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
    const [exchange, setExchange] = useState("")
    const [orderId, setOrderId] = useState("")


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

        await addTransaction({
            symbol: symbol.toUpperCase(),
            type,
            price: parseFloat(price),
            quantity: parseFloat(quantity),
            amount: parseFloat(amount),
            fee: parseFloat(fee || "0"),
            date: new Date(date).getTime(),
            exchange: exchange.trim() || undefined,
            orderId: orderId.trim() || undefined,
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Trading Pair</Label>
                <SymbolSelector value={symbol} onChange={setSymbol} />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Side</Label>
                <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50 h-11">
                    <button
                        type="button"
                        onClick={() => setType("BUY")}
                        className={`flex-1 rounded-lg text-xs font-bold transition-all ${
                            type === "BUY" ? "bg-background text-green-600 shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                        }`}
                    >
                        BUY
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("SELL")}
                        className={`flex-1 rounded-lg text-xs font-bold transition-all ${
                            type === "SELL" ? "bg-background text-red-600 shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                        }`}
                    >
                        SELL
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Date & Time</Label>
                <DateTimePicker value={date} onChange={setDate} />
            </div>



            <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Unit Price</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={e => handlePriceChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono pl-7 font-bold" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Asset Symbol</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={quantity} onChange={e => handleQuantityChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono font-bold" required />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Total Amount</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={amount} onChange={e => handleAmountChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-primary font-bold pl-7" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Fee</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-muted-foreground font-medium" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Exchange</Label>
                    <Input placeholder="Binance, OKX…" value={exchange} onChange={e => setExchange(e.target.value)} className="rounded-xl border-border/50 h-11" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Order ID</Label>
                    <Input placeholder="Optional" value={orderId} onChange={e => setOrderId(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono" />
                </div>
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                    Save Transaction
                </Button>
            </div>
        </form>
    )
}
