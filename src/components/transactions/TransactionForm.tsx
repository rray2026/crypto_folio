import { useState, useRef } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SymbolSelector } from "./SymbolSelector"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Target, Check } from "lucide-react"

function focusNextInput(formRef: React.RefObject<HTMLFormElement | null>, current: EventTarget) {
    if (!formRef.current) return
    const inputs = Array.from(formRef.current.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]), textarea, [role="combobox"]'))
    const idx = inputs.indexOf(current as HTMLInputElement)
    if (idx >= 0 && idx < inputs.length - 1) {
        inputs[idx + 1].focus()
    }
}

export function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
    const addTransaction = useTransactionStore((state) => state.addTransaction)
    const createPosition = usePositionStore((state) => state.createPosition)
    const addTransactionToPosition = usePositionStore((state) => state.addTransactionToPosition)
    const formRef = useRef<HTMLFormElement>(null)
    const [symbol, setSymbol] = useState("")
    const [type, setType] = useState<"BUY" | "SELL">("BUY")
    const [price, setPrice] = useState("")
    const [quantity, setQuantity] = useState("")
    const [amount, setAmount] = useState("")
    const [fee, setFee] = useState("0")
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
    const [orderId, setOrderId] = useState("")
    const [alsoCreatePosition, setAlsoCreatePosition] = useState(false)
    const [positionName, setPositionName] = useState("")


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

        const upperSymbol = symbol.toUpperCase()
        const parsedAmount = parseFloat(amount)

        const txId = await addTransaction({
            symbol: upperSymbol,
            type,
            price: parseFloat(price),
            quantity: parseFloat(quantity),
            amount: parsedAmount,
            fee: parseFloat(fee || "0"),
            date: new Date(date).getTime(),
            orderId: orderId.trim() || undefined,
        })

        if (alsoCreatePosition) {
            const posId = await createPosition({
                symbol: upperSymbol,
                strategyName: positionName || undefined,
                startDate: new Date(date).getTime(),
            })
            await addTransactionToPosition(posId, {
                transactionId: txId,
                allocatedAmount: parsedAmount,
            })
        }

        onSuccess()
    }

    const isValid = symbol && price && quantity && amount

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            focusNextInput(formRef, e.target)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 pt-2">
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
                            type === "BUY" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
                        }`}
                    >
                        BUY
                    </button>
                    <button
                        type="button"
                        onClick={() => setType("SELL")}
                        className={`flex-1 rounded-lg text-xs font-bold transition-all ${
                            type === "SELL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground"
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
                            <Input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={e => handlePriceChange(e.target.value)} onKeyDown={handleKeyDown} className="rounded-xl border-border/50 h-11 font-mono pl-7 font-bold" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Asset Symbol</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={quantity} onChange={e => handleQuantityChange(e.target.value)} onKeyDown={handleKeyDown} className="rounded-xl border-border/50 h-11 font-mono font-bold" required />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Total Amount</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
                            <Input type="number" step="any" min="0" placeholder="0.00" value={amount} onChange={e => handleAmountChange(e.target.value)} onKeyDown={handleKeyDown} className="rounded-xl border-border/50 h-11 font-mono font-bold pl-7" required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Fee</Label>
                        <Input type="number" step="any" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} onKeyDown={handleKeyDown} className="rounded-xl border-border/50 h-11 font-mono text-muted-foreground font-medium" />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Order ID</Label>
                <Input placeholder="Optional — used for duplicate detection" value={orderId} onChange={e => setOrderId(e.target.value)} onKeyDown={handleKeyDown} className="rounded-xl border-border/50 h-11 font-mono" />
            </div>

            <div
                className={`rounded-xl border transition-all duration-300 ease-out overflow-hidden ${
                    alsoCreatePosition
                        ? 'bg-primary/6 border-primary/25 ring-1 ring-primary/15 shadow-[0_0_16px_hsl(var(--primary)/0.08)]'
                        : 'border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5'
                }`}
            >
                <button
                    type="button"
                    onClick={() => setAlsoCreatePosition(!alsoCreatePosition)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                        alsoCreatePosition
                            ? 'bg-primary/15 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.1)]'
                            : 'bg-muted/50 text-muted-foreground'
                    }`}>
                        <Target className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold transition-colors duration-300 ${alsoCreatePosition ? 'text-foreground' : 'text-muted-foreground'}`}>
                            Create Position
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            Link this trade to a new position
                        </p>
                    </div>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center transition-all duration-300 ${
                        alsoCreatePosition
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border/50 bg-background'
                    }`}>
                        {alsoCreatePosition && <Check className="h-3 w-3" />}
                    </div>
                </button>
                {alsoCreatePosition && (
                    <div className="px-3 pb-3 pt-0">
                        <Input
                            placeholder="Position name (optional)"
                            value={positionName}
                            onChange={e => setPositionName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="rounded-lg border-primary/15 bg-background/80 h-10 text-sm font-medium placeholder:text-muted-foreground/50"
                        />
                    </div>
                )}
            </div>

            <div className="pt-4">
                <Button
                    type="submit"
                    disabled={!isValid}
                    className="w-full h-12 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-[0.98]"
                >
                    Save Transaction
                </Button>
            </div>
        </form>
    )
}
