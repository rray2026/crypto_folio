import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { Plus, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
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
                <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create Fund
                </Button>
            </div>
            {/* Shared dialog (triggered from MobileHeader on mobile, button above on desktop) */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-md">
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
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-card rounded-xl border border-border/40 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Funds</p>
                        <p className="text-2xl font-bold font-mono">{funds.length}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border/40 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Combined AUM</p>
                        <p className="text-2xl font-bold font-mono">
                            {totalAUM.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            )}

            {/* Fund grid */}
            {!funds ? null : funds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Layers className="h-7 w-7 text-primary/60" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">No funds yet</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                        Create a fund to group positions under a shared initial capital and track NAV over time.
                    </p>
                    <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Create Your First Fund
                    </Button>
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
