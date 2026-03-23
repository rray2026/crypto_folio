import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useFundStore } from "@/store/useFundStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { getPositionMetrics, getFundMetrics } from "@/lib/metrics"
import { ArrowLeft, Edit, Trash2, X, Layers, Link as LinkIcon, Eye, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { FundForm } from "@/components/funds/FundForm"

export default function FundDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { deleteFund, assignPositionToFund, unassignPosition } = useFundStore()
    const { prices } = useSettingsStore()

    const [isEditOpen, setIsEditOpen] = useState(false)

    const fund = useLiveQuery(() => id ? db.funds.get(id) : undefined, [id])
    const allPositions = useLiveQuery(() => db.positions.toArray())
    const transactions = useLiveQuery(() => db.transactions.toArray())

    if (!fund) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[50vh]">
                <div className="text-muted-foreground text-sm">
                    {fund === null ? "Fund not found." : "Loading…"}
                </div>
            </div>
        )
    }

    const fundPositions = allPositions?.filter(p => p.fundId === id) ?? []
    const unassignedPositions = allPositions?.filter(p => !p.fundId) ?? []

    const getPosMetrics = (pos: any) => {
        const linkedTxIds = new Set(pos.entries.map((e: any) => e.transactionId))
        const linkedTxs = transactions?.filter(tx => linkedTxIds.has(tx.id)) ?? []
        return getPositionMetrics(pos, linkedTxs, prices)
    }

    const allPosMetrics = fundPositions.map(getPosMetrics)
    const fundM = getFundMetrics(fund, allPosMetrics)

    const handleDelete = async () => {
        if (!window.confirm(`Delete fund "${fund.name}"? All positions will be unassigned but not deleted.`)) return
        await deleteFund(fund.id)
        navigate('/funds')
    }

    const handleAssign = async (positionId: string) => {
        await assignPositionToFund(positionId, fund.id)
    }

    const fmtNum = (n: number) =>
        n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const navUp = fundM.navChangePct >= 0

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
            {/* Back nav */}
            <Button
                variant="ghost"
                size="sm"
                className="gap-2 mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/funds')}
            >
                <ArrowLeft className="h-4 w-4" />
                Funds
            </Button>

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                        <h1 className="text-2xl font-bold tracking-tight">{fund.name}</h1>
                    </div>
                    {fund.description && (
                        <p className="text-sm text-muted-foreground">{fund.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Edit */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                                <Edit className="h-3.5 w-3.5" />
                                Edit
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Edit Fund</DialogTitle>
                            </DialogHeader>
                            <FundForm initialValues={fund} onSuccess={() => setIsEditOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* NAV metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Initial Amount</p>
                    <p className="text-xl font-bold font-mono">{fmtNum(fund.initialAmount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fund.currency}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                    <p className="text-xl font-bold font-mono">{fmtNum(fundM.currentValue)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fund.currency}</p>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">NAV / Share</p>
                    <p className="text-xl font-bold font-mono">{fundM.currentNAV.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        Initial: {fundM.initialNAV.toFixed(4)}
                    </p>
                </div>
                <div className="bg-card rounded-xl border border-border/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">NAV Change</p>
                    <p className={`text-xl font-bold font-mono ${navUp ? 'text-green-500' : 'text-destructive'}`}>
                        {navUp ? '+' : ''}{fundM.navChangePct.toFixed(2)}%
                    </p>
                    <p className={`text-[10px] mt-0.5 font-mono ${fundM.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {fundM.totalPnL >= 0 ? '+' : ''}{fmtNum(fundM.totalPnL)} PnL
                    </p>
                </div>
            </div>

            {/* Positions section — two-column layout mirrors PositionDetails */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: assigned positions */}
                <div className="lg:col-span-2">
                    <h2 className="text-base font-semibold mb-3">
                        Linked Positions
                        <span className="ml-2 text-sm text-muted-foreground font-normal">({fundPositions.length})</span>
                    </h2>
                    {fundPositions.length === 0 ? (
                        <div className="border border-dashed border-border/50 rounded-xl p-8 text-center">
                            <p className="text-sm text-muted-foreground">No positions linked yet. Link them from the right panel.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {fundPositions.map((pos, i) => {
                                const m = allPosMetrics[i]
                                const posValue = m.totalInvestment + m.totalPnL
                                const alloc = fundM.currentValue > 0 ? (posValue / fundM.currentValue * 100) : 0
                                return (
                                    <div key={pos.id} className="flex items-center justify-between p-3 rounded-xl border bg-background/40 hover:bg-background/80 transition-colors group">
                                        <div className="flex gap-3 items-center min-w-0">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider shrink-0 ${
                                                pos.status === 'OPEN'
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {pos.status}
                                            </span>
                                            <div className="flex flex-col min-w-0">
                                                <p className="font-medium text-sm truncate">{pos.strategyName || pos.symbol}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                    <span className="font-mono opacity-70">{pos.symbol}</span>
                                                    <span className="opacity-50">•</span>
                                                    <span className={`font-semibold ${m.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                        {m.totalPnL >= 0 ? '+' : ''}{fmtNum(m.totalPnL)}
                                                    </span>
                                                    <span className="opacity-50 hidden sm:inline">•</span>
                                                    <span className="text-muted-foreground hidden sm:inline">{alloc.toFixed(1)}% alloc</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                onClick={() => navigate(`/positions/${pos.id}`)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                onClick={() => unassignPosition(pos.id)}
                                                title="Remove from fund"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Right: available positions panel */}
                <div className="bg-card rounded-xl p-6 border shadow-sm">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Available Positions</h3>
                    <div className="space-y-3">
                        {unassignedPositions.length === 0 ? (
                            <p className="text-muted-foreground text-sm flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                No unassigned positions.
                            </p>
                        ) : (
                            unassignedPositions.map(pos => (
                                <div key={pos.id} className="p-3 border rounded-lg hover:border-primary/50 transition-colors text-sm bg-background/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
                                                pos.status === 'OPEN'
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {pos.status}
                                            </span>
                                            <p className="font-medium truncate text-xs">{pos.strategyName || pos.symbol}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                onClick={() => navigate(`/positions/${pos.id}`)}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => handleAssign(pos.id)}
                                            >
                                                <LinkIcon className="h-3 w-3" /> Link
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="font-mono text-muted-foreground text-[10px]">{pos.symbol}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
