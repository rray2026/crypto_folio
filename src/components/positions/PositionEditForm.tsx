import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import { DateTimePicker } from "../ui/DateTimePicker"
import type { Position } from "@/lib/types"

export function PositionEditForm({ position, onSuccess }: { position: Position, onSuccess: () => void }) {
    const updatePosition = usePositionStore(state => state.updatePosition)
    const [type, setType] = useState<'PRIMARY' | 'SHADOW'>(position.type)
    const [strategyName, setStrategyName] = useState(position.strategyName || "")
    const [notes, setNotes] = useState(position.notes || "")
    const [startDate, setStartDate] = useState(() => {
        if (!position.startDate) return new Date().toISOString().slice(0, 16);
        return new Date(position.startDate).toISOString().slice(0, 16);
    })
    const [endDate, setEndDate] = useState(() => {
        if (!position.endDate) return "";
        return new Date(position.endDate).toISOString().slice(0, 16);
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        await updatePosition(position.id, {
            type,
            strategyName: strategyName || undefined,
            notes: notes || undefined,
            startDate: startDate ? new Date(startDate).getTime() : undefined,
            endDate: endDate ? new Date(endDate).getTime() : undefined,
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Asset Symbol</Label>
                    <span className="text-[9px] flex items-center gap-1 text-muted-foreground/50">
                        <Lock className="h-2.5 w-2.5" /> Immutable
                    </span>
                </div>
                <Input
                    value={position.symbol}
                    className="rounded-xl bg-muted/20 border-border/30 h-11 text-base font-bold tracking-tight opacity-70"
                    disabled={true}
                />
            </div>

            <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Strategy Type</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-xl border border-border/50">
                    <button
                        type="button"
                        onClick={() => setType('PRIMARY')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                            type === 'PRIMARY' 
                            ? 'bg-background text-primary shadow-sm ring-1 ring-border/50' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        PRIMARY (REAL)
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('SHADOW')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                            type === 'SHADOW' 
                            ? 'bg-background text-amber-600 shadow-sm ring-1 ring-border/50' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        SHADOW (OBSERV.)
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Strategy Name</Label>
                <Input 
                    placeholder="e.g. Q4 BTC Accumulation" 
                    value={strategyName} 
                    onChange={e => setStrategyName(e.target.value)} 
                    className="rounded-xl border-border/50 h-11 font-medium"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Start Date</Label>
                <DateTimePicker value={startDate} onChange={setStartDate} />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">End Date (Optional)</Label>
                <DateTimePicker value={endDate || new Date().toISOString().slice(0, 16)} onChange={setEndDate} />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Strategy Journal (Notes)</Label>
                <Input 
                    placeholder="Reflections, rules, triggers..." 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className="rounded-xl border-border/50 h-11 font-medium"
                />
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                    Save Strategy Changes
                </Button>
            </div>
        </form>
    )
}
