import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PositionForm({ onSuccess }: { onSuccess: () => void }) {
    const createPosition = usePositionStore(state => state.createPosition)
    const [symbol, setSymbol] = useState("")
    const [strategyName, setStrategyName] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!symbol || !strategyName) return

        await createPosition({
            symbol: symbol.toUpperCase(),
            strategyName
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label>Pair / Symbol</Label>
                <Input placeholder="e.g. BTC/USDT" value={symbol} onChange={e => setSymbol(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label>Strategy Name</Label>
                <Input placeholder="e.g. Q4 BTC Accumulation" value={strategyName} onChange={e => setStrategyName(e.target.value)} required />
            </div>
            <div className="pt-4 text-right">
                <Button type="submit" className="w-full">Create Position</Button>
            </div>
        </form>
    )
}
