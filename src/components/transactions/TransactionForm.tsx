import { useState } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
    const addTransaction = useTransactionStore((state) => state.addTransaction)
    const [symbol, setSymbol] = useState("")
    const [type, setType] = useState<"BUY" | "SELL">("BUY")
    const [price, setPrice] = useState("")
    const [quantity, setQuantity] = useState("")
    const [amount, setAmount] = useState("")
    const [fee, setFee] = useState("0")
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))

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
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label>Pair / Symbol</Label>
                <Input placeholder="e.g. BTC/USDT" value={symbol} onChange={e => setSymbol(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(val: "BUY" | "SELL") => setType(val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="BUY">BUY</SelectItem>
                            <SelectItem value="SELL">SELL</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={e => handlePriceChange(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" step="any" min="0" placeholder="0.00" value={quantity} onChange={e => handleQuantityChange(e.target.value)} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <Input type="number" step="any" min="0" placeholder="0.00" value={amount} onChange={e => handleAmountChange(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label>Fee</Label>
                    <Input type="number" step="any" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)} />
                </div>
            </div>
            <div className="pt-4 text-right">
                <Button type="submit" className="w-full">Save Transaction</Button>
            </div>
        </form>
    )
}
