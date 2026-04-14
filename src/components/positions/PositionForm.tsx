import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SymbolSelector } from "../transactions/SymbolSelector"

export function PositionForm({ onSuccess }: { onSuccess: () => void }) {
    const createPosition = usePositionStore(state => state.createPosition)
    const [symbol, setSymbol] = useState("")
    const [strategyName, setStrategyName] = useState("")
    const [notes, setNotes] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!symbol) return

        await createPosition({
            symbol: symbol.toUpperCase(),
            strategyName: strategyName || undefined,
            notes: notes || undefined,
            startDate: Date.now()
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Asset Symbol</Label>
                <SymbolSelector value={symbol} onChange={setSymbol} />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Position Name</Label>
                <Input
                    placeholder="e.g. Q4 Swing Trade"
                    value={strategyName}
                    onChange={e => setStrategyName(e.target.value)}
                    className="rounded-xl border-border/50 h-11 font-medium"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Journal (Notes)</Label>
                <Input
                    placeholder="Initial thoughts, triggers, rules..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="rounded-xl border-border/50 h-11 text-muted-foreground font-medium"
                />
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-[0.98]">
                    Create Empty Position
                </Button>
            </div>
        </form>
    )
}
