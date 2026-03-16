import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SymbolSelector } from "../transactions/SymbolSelector"
import { DateTimePicker } from "../ui/DateTimePicker"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function PositionForm({ onSuccess }: { onSuccess: () => void }) {
    const createPosition = usePositionStore(state => state.createPosition)
    const [symbol, setSymbol] = useState("")
    const [strategyName, setStrategyName] = useState("")
    const [notes, setNotes] = useState("")
    const [type, setType] = useState<'PRIMARY' | 'SHADOW'>('PRIMARY')
    const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!symbol) return

        await createPosition({
            symbol: symbol.toUpperCase(),
            strategyName: strategyName || undefined,
            type,
            notes: notes || undefined,
            startDate: new Date(startDate).getTime()
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Strategy Name</Label>
                <Input 
                    placeholder="e.g. Q4 BTC Accumulation" 
                    value={strategyName} 
                    onChange={e => setStrategyName(e.target.value)}
                    className="rounded-xl border-border/50 h-11 font-medium"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Start Date & Time</Label>
                <DateTimePicker value={startDate} onChange={setStartDate} />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Position Nature</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-border/50 font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/40 shadow-2xl">
                        <SelectItem value="PRIMARY" className="font-medium">🎯 Strategic (Primary)</SelectItem>
                        <SelectItem value="SHADOW" className="font-medium">👀 Analysis (Shadow)</SelectItem>
                    </SelectContent>
                </Select>
                <div className="px-1 pt-1">
                    <p className="text-[10px] leading-relaxed text-muted-foreground italic">
                        {type === 'PRIMARY' 
                            ? "Real asset tracking. Counted towards global portfolio metrics." 
                            : "Sandbox mode. Educational group not counted in total profit."}
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Strategy Journal (Notes)</Label>
                <Input 
                    placeholder="Initial thoughts, triggers, rules..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    className="rounded-xl border-border/50 h-11 text-muted-foreground font-medium"
                />
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                    Create New Position
                </Button>
            </div>
        </form>
    )
}
