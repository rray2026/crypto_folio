import { useState } from "react"
import { usePositionStore } from "@/store/usePositionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Position } from "@/lib/types"

export function PositionEditForm({ position, onSuccess }: { position: Position, onSuccess: () => void }) {
    const updatePosition = usePositionStore(state => state.updatePosition)
    const [strategyName, setStrategyName] = useState(position.strategyName || "")
    const [notes, setNotes] = useState(position.notes || "")
    const [startDate, setStartDate] = useState(() => {
        if (!position.startDate) return "";
        return new Date(position.startDate).toISOString().slice(0, 16);
    })
    const [endDate, setEndDate] = useState(() => {
        if (!position.endDate) return "";
        return new Date(position.endDate).toISOString().slice(0, 16);
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        await updatePosition(position.id, {
            strategyName: strategyName || undefined,
            notes: notes || undefined,
            startDate: startDate ? new Date(startDate).getTime() : undefined,
            endDate: endDate ? new Date(endDate).getTime() : undefined,
        })
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label>Strategy Name / Label (Optional)</Label>
                <Input placeholder="e.g. Q4 BTC Accumulation" value={strategyName} onChange={e => setStrategyName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input placeholder="Strategy reflections, rules..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="pt-4 text-right">
                <Button type="submit" className="w-full">Save Changes</Button>
            </div>
        </form>
    )
}
