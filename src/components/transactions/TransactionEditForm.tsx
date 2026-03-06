import { useState } from "react"
import { useTransactionStore } from "@/store/useTransactionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label>Pair / Symbol <span className="text-muted-foreground text-xs ml-2">(Locked: Cannot change symbol on existing items)</span></Label>
                <Input
                    placeholder="e.g. BTC/USDT"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value)}
                    list="edit-transaction-symbols-list"
                    required
                    disabled={true}
                />
                <datalist id="edit-transaction-symbols-list">
                    {predefinedPairs.map(p => <option key={p} value={p} />)}
                </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Type <span className="text-muted-foreground text-xs ml-2">(Locked)</span></Label>
                    <Select value={type} onValueChange={(val: "BUY" | "SELL") => setType(val)} disabled={true}>
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
                <Button type="submit" className="w-full">Update Transaction</Button>
            </div>
        </form>
    )
}
