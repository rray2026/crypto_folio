import { useState } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Sparkles } from "lucide-react"

export function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
    const addTransaction = useTransactionStore((state) => state.addTransaction)
    const predefinedPairs = useSettingsStore((state) => state.predefinedPairs)
    const [symbol, setSymbol] = useState("")
    const [type, setType] = useState<"BUY" | "SELL">("BUY")
    const [price, setPrice] = useState("")
    const [quantity, setQuantity] = useState("")
    const [amount, setAmount] = useState("")
    const [fee, setFee] = useState("0")
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))

    // Common assets for quick access
    const commonAssets = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]

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
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Trading Pair</Label>
                    <span className="text-[10px] text-primary flex items-center gap-1 font-medium">
                        <Sparkles className="h-3 w-3" /> Auto-uppercase
                    </span>
                </div>
                <Input
                    placeholder="e.g. BTC/USDT"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    className="rounded-xl border-border/50 h-11 text-base font-bold tracking-tight"
                    required
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {commonAssets.map(asset => (
                        <button
                            key={asset}
                            type="button"
                            onClick={() => setSymbol(asset)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                symbol === asset 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-muted/30 text-muted-foreground border-border/50 hover:border-primary/50 hover:bg-muted/50"
                            }`}
                        >
                            {asset.split('/')[0]}
                        </button>
                    ))}
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-muted/10 text-muted-foreground/40 border-dashed border-border/50">
                        Others
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Side</Label>
                    <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50 h-11">
                        <button
                            type="button"
                            onClick={() => setType("BUY")}
                            className={`flex-1 rounded-lg text-xs font-black transition-all ${
                                type === "BUY" ? "bg-background text-green-600 shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                            }`}
                        >
                            BUY
                        </button>
                        <button
                            type="button"
                            onClick={() => setType("SELL")}
                            className={`flex-1 rounded-lg text-xs font-black transition-all ${
                                type === "SELL" ? "bg-background text-red-600 shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                            }`}
                        >
                            SELL
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Time</Label>
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
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Price</Label>
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
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Total Value</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={amount} onChange={e => handleAmountChange(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-primary font-black pl-7" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Fees</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} className="rounded-xl border-border/50 h-11 font-mono text-muted-foreground font-medium" />
                    </div>
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
