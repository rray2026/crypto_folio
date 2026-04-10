import { useState } from "react"
import { useFundStore } from "@/store/useFundStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Fund } from "@/lib/types"

interface FundFormProps {
    onSuccess: () => void;
    initialValues?: Fund;
}

export function FundForm({ onSuccess, initialValues }: FundFormProps) {
    const { createFund, updateFund } = useFundStore()

    const [name, setName] = useState(initialValues?.name ?? "")
    const [description, setDescription] = useState(initialValues?.description ?? "")
    const [initialAmount, setInitialAmount] = useState(
        initialValues ? String(initialValues.initialAmount) : ""
    )
    const [initialShares, setInitialShares] = useState(
        initialValues ? String(initialValues.initialShares) : "100"
    )
    const [currency, setCurrency] = useState(initialValues?.currency ?? "USDT")

    const amount = parseFloat(initialAmount) || 0
    const shares = parseFloat(initialShares) || 0
    const previewNAV = shares > 0 ? (amount / shares).toFixed(4) : "—"

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || amount <= 0 || shares <= 0) return

        const data = {
            name: name.trim(),
            description: description.trim() || undefined,
            initialAmount: amount,
            initialShares: shares,
            currency: currency.trim() || "USDT",
            status: initialValues?.status ?? ("ACTIVE" as const),
        }

        if (initialValues) {
            await updateFund(initialValues.id, data)
        } else {
            await createFund(data)
        }
        onSuccess()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Fund Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    placeholder="e.g. Q1 2025 Portfolio"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="rounded-xl border-border/50 h-11 font-medium"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Description
                </Label>
                <Input
                    placeholder="Optional notes about this fund..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="rounded-xl border-border/50 h-11 text-muted-foreground font-medium"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Initial Amount <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 10000"
                        value={initialAmount}
                        onChange={e => setInitialAmount(e.target.value)}
                        className="rounded-xl border-border/50 h-11 font-mono"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Currency
                    </Label>
                    <Input
                        placeholder="USDT"
                        value={currency}
                        onChange={e => setCurrency(e.target.value.toUpperCase())}
                        className="rounded-xl border-border/50 h-11 font-mono uppercase"
                        maxLength={10}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Total Shares <span className="text-destructive">*</span>
                </Label>
                <Input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="100"
                    value={initialShares}
                    onChange={e => setInitialShares(e.target.value)}
                    className="rounded-xl border-border/50 h-11 font-mono"
                    required
                />
            </div>

            {/* NAV preview */}
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Initial NAV per share</span>
                <span className="font-mono text-lg font-bold">
                    {previewNAV} <span className="text-muted-foreground text-xs">{currency || "USDT"}</span>
                </span>
            </div>

            <div className="pt-2">
                <Button
                    type="submit"
                    disabled={!name.trim() || amount <= 0 || shares <= 0}
                    className="w-full h-12 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-[0.98]"
                >
                    {initialValues ? "Save Changes" : "Create Fund"}
                </Button>
            </div>
        </form>
    )
}
