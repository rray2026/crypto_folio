import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { Plus, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { label } from "@/lib/styles"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FundCard } from "@/components/funds/FundCard"
import { FundForm } from "@/components/funds/FundForm"
import { getPositionMetrics, getFundMetrics } from "@/lib/metrics"
import { useSettingsStore } from "@/store/useSettingsStore"

export default function Funds() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const { setMobileHeader } = useMobileHeader()
    const openAdd = useCallback(() => setIsAddDialogOpen(true), [])
    useEffect(() => {
        setMobileHeader({
            title: "Funds",
            rightActions: (
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Create Fund"
                >
                    <Plus className="h-5 w-5" />
                </button>
            ),
        })
    }, [setMobileHeader, openAdd])
    const { prices } = useSettingsStore()

    const funds = useLiveQuery(() => db.funds.orderBy('createdAt').reverse().toArray())
    const positions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    const getPositionCount = (fundId: string) =>
        positions?.filter(p => p.fundId === fundId).length ?? 0

    const getFundCardMetrics = (fundId: string) => {
        const fundPositions = positions?.filter(p => p.fundId === fundId) ?? []
        const posMetrics = fundPositions.map(pos => {
            const linkedTxIds = new Set(pos.entries.map(e => e.transactionId))
            const linkedTxs = transactions?.filter(tx => linkedTxIds.has(tx.id)) ?? []
            return getPositionMetrics(pos, linkedTxs, prices)
        })
        return posMetrics
    }

    const totalAUM = funds?.reduce((sum, fund) => {
        const posMetrics = getFundCardMetrics(fund.id)
        const fundM = getFundMetrics(fund, posMetrics)
        return sum + fundM.currentValue
    }, 0) ?? 0

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="hidden sm:flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Funds</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        NAV-based portfolio groups with initial capital tracking
                    </p>
                </div>
                <Button className="gap-2 rounded-xl shadow-lg" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create Fund
                </Button>
            </div>
            {/* Shared dialog (triggered from MobileHeader on mobile, button above on desktop) */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-md" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Create New Fund</DialogTitle>
                        <DialogDescription>
                            Set up a fund with initial capital. Positions you assign to it will contribute to its NAV.
                        </DialogDescription>
                    </DialogHeader>
                    <FundForm onSuccess={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            {/* Summary bar */}
            {funds && funds.length > 0 && (
                <Card className="overflow-hidden border-border/50 shadow-sm mb-6">
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-2 gap-x-4">
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Total Funds</span>
                                <span className="text-xl sm:text-2xl font-bold font-mono">{funds.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`${label} sm:text-xs mb-1`}>Combined AUM</span>
                                <span className="text-xl sm:text-2xl font-bold font-mono">
                                    {totalAUM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fund grid */}
            {!funds ? null : funds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Layers className="h-7 w-7 text-primary/60" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">No funds yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                        Create a fund to group positions under a shared initial capital and track NAV over time.
                    </p>
                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="flex items-center gap-3.5 p-3.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left w-full max-w-sm"
                    >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                            <Plus className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Create Your First Fund</p>
                            <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Set initial capital, currency, and shares to start tracking NAV.</p>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {funds.map(fund => {
                        const posMetrics = getFundCardMetrics(fund.id)
                        const m = getFundMetrics(fund, posMetrics)
                        return (
                            <FundCard
                                key={fund.id}
                                fund={fund}
                                positionCount={getPositionCount(fund.id)}
                                metrics={m}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}
