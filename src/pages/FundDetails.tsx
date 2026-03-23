import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useFundStore } from "@/store/useFundStore"
import { useSettingsStore } from "@/store/useSettingsStore"
import { getPositionMetrics, getFundMetrics } from "@/lib/metrics"
import { ArrowLeft, Edit, Trash2, Plus, X, Layers, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
import { FundForm } from "@/components/funds/FundForm"

export default function FundDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { deleteFund, assignPositionToFund, unassignPosition } = useFundStore()
    const { prices } = useSettingsStore()

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isAddPositionOpen, setIsAddPositionOpen] = useState(false)

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
        setIsAddPositionOpen(false)
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
                                <DialogDescription>Update fund settings.</DialogDescription>
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

            {/* Positions section */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">
                    Positions
                    <span className="ml-2 text-sm text-muted-foreground font-normal">({fundPositions.length})</span>
                </h2>
                {unassignedPositions.length > 0 && (
                    <Dialog open={isAddPositionOpen} onOpenChange={setIsAddPositionOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                                <Plus className="h-3.5 w-3.5" />
                                Add Position
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add Position to Fund</DialogTitle>
                                <DialogDescription>
                                    Select an unassigned position to include in this fund.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 max-h-80 overflow-y-auto py-2">
                                {unassignedPositions.map(pos => (
                                    <button
                                        key={pos.id}
                                        onClick={() => handleAssign(pos.id)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/40 transition-colors text-left"
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{pos.strategyName || pos.symbol}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{pos.symbol}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            pos.status === 'OPEN'
                                            ? 'bg-blue-500/10 text-blue-500'
                                            : 'bg-muted text-muted-foreground'
                                        }`}>
                                            {pos.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {fundPositions.length === 0 ? (
                <div className="border border-dashed border-border/50 rounded-xl p-8 text-center">
                    <p className="text-sm text-muted-foreground">No positions assigned yet.</p>
                    {unassignedPositions.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-2 rounded-xl"
                            onClick={() => setIsAddPositionOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Position
                        </Button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/30">
                                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">PnL</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Allocation</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {fundPositions.map((pos, i) => {
                                const m = allPosMetrics[i]
                                const posValue = m.totalInvestment + m.totalPnL
                                const alloc = fundM.currentValue > 0 ? (posValue / fundM.currentValue * 100) : 0
                                return (
                                    <tr key={pos.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link to={`/positions/${pos.id}`} className="hover:underline">
                                                <p className="font-medium line-clamp-1">{pos.strategyName || pos.symbol}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{pos.symbol}</p>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                pos.status === 'OPEN'
                                                ? 'bg-blue-500/10 text-blue-500'
                                                : 'bg-muted text-muted-foreground'
                                            }`}>
                                                {pos.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {m.totalPnL >= 0
                                                    ? <TrendingUp className="h-3 w-3 text-green-500" />
                                                    : <TrendingDown className="h-3 w-3 text-destructive" />
                                                }
                                                <span className={`font-mono font-medium ${m.totalPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                    {m.totalPnL >= 0 ? '+' : ''}{fmtNum(m.totalPnL)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right hidden md:table-cell">
                                            <span className="text-muted-foreground font-mono text-xs">
                                                {alloc.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => unassignPosition(pos.id)}
                                                title="Remove from fund"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
