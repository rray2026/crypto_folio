import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PositionForm({ onSuccess }: { onSuccess: () => void }) {
    const createPosition = usePositionStore(state => state.createPosition)
    const predefinedPairs = useSettingsStore(state => state.predefinedPairs)
    const [symbol, setSymbol] = useState("")
    const [strategyName, setStrategyName] = useState("")
    const [notes, setNotes] = useState("")
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!symbol) return

        await createPosition({
            symbol: symbol.toUpperCase(),
            strategyName: strategyName || undefined,
            notes: notes || undefined,
            startDate: new Date(startDate).getTime()
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label>Pair / Symbol</Label>
                <Input
                    placeholder="e.g. BTC/USDT"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value)}
                    list="position-symbols-list"
                    required
                />
                <datalist id="position-symbols-list">
                    {predefinedPairs.map(p => <option key={p} value={p} />)}
                </datalist>
            </div>
            <div className="space-y-2">
                <Label>Strategy Name / Label (Optional)</Label>
                <Input placeholder="e.g. Q4 BTC Accumulation" value={strategyName} onChange={e => setStrategyName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input placeholder="Any initial thoughts..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="pt-4 text-right">
                <Button type="submit" className="w-full">Create Position</Button>
            </div>
        </form>
    )
}
