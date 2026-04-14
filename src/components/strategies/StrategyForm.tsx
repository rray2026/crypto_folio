import { useState, useRef } from "react"
import { useStrategyStore } from "@/store/useStrategyStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Strategy } from "@/lib/types"

function focusNextInput(formRef: React.RefObject<HTMLFormElement | null>, current: EventTarget) {
    if (!formRef.current) return
    const inputs = Array.from(formRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea'))
    const idx = inputs.indexOf(current as HTMLInputElement)
    if (idx >= 0 && idx < inputs.length - 1) {
        inputs[idx + 1].focus()
    }
}

interface StrategyFormProps {
    onSuccess: () => void
    initialValues?: Strategy
}

export function StrategyForm({ onSuccess, initialValues }: StrategyFormProps) {
    const { createStrategy, updateStrategy } = useStrategyStore()
    const formRef = useRef<HTMLFormElement>(null)

    const [name, setName] = useState(initialValues?.name ?? "")
    const [description, setDescription] = useState(initialValues?.description ?? "")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        const data = {
            name: name.trim(),
            description: description.trim() || undefined,
            status: initialValues?.status ?? ("ACTIVE" as const),
        }

        if (initialValues) {
            await updateStrategy(initialValues.id, data)
        } else {
            await createStrategy(data)
        }
        onSuccess()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault()
            focusNextInput(formRef, e.target)
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Strategy Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    placeholder="e.g. Grid Trading, DCA, Breakout"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="rounded-xl border-border/50 h-11 font-medium"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Description
                </Label>
                <textarea
                    placeholder="Describe the strategy rules, entry/exit conditions, risk management..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="flex w-full rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y font-medium text-muted-foreground"
                />
            </div>

            <div className="pt-2">
                <Button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full h-12 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-[0.98]"
                >
                    {initialValues ? "Save Changes" : "Create Strategy"}
                </Button>
            </div>
        </form>
    )
}
