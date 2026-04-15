import { useState, useEffect, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useNavigate } from "react-router-dom"
import { StrategyForm } from "@/components/strategies/StrategyForm"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, ArrowLeft, Lightbulb, Archive, ChevronRight } from "lucide-react"

export default function Strategies() {
    const navigate = useNavigate()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [showArchived, setShowArchived] = useState(false)
    const { setMobileHeader } = useMobileHeader()

    const openAdd = useCallback(() => setIsAddDialogOpen(true), [])

    useEffect(() => {
        setMobileHeader({
            title: "Strategies",
            leftAction: (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            ),
            rightActions: (
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Add Strategy"
                >
                    <Plus className="h-5 w-5" />
                </button>
            ),
        })
    }, [setMobileHeader, navigate, openAdd])

    const strategies = useLiveQuery(() => db.strategies.orderBy('createdAt').reverse().toArray())
    const positions = useLiveQuery(() => db.positions.toArray())

    const activeStrategies = strategies?.filter(s => s.status === 'ACTIVE') ?? []
    const archivedStrategies = strategies?.filter(s => s.status === 'ARCHIVED') ?? []

    const getPositionCount = (strategyId: string) =>
        positions?.filter(p => p.strategyId === strategyId).length ?? 0

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="hidden md:flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Strategies</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Define and track your trading strategies.</p>
                    </div>
                </div>
                <Button className="gap-2" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    New Strategy
                </Button>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="w-[95vw] max-w-lg rounded-xl sm:max-w-[425px] p-4 sm:p-6" onOpenAutoFocus={e => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Create Strategy</DialogTitle>
                        <DialogDescription>
                            Define a trading strategy. You can link positions to it later.
                        </DialogDescription>
                    </DialogHeader>
                    <StrategyForm onSuccess={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            {!strategies ? null : strategies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4 shadow-glow shimmer-accent">
                        <Lightbulb className="h-7 w-7 text-primary/70 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">No strategies yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                        Create a strategy to define your trading approach and link positions to measure its performance.
                    </p>
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5 hover:shadow-ambient transition-all duration-300 ease-out group text-left w-full max-w-sm"
                    >
                        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                            <Plus className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Create Your First Strategy</p>
                            <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Name it, describe the rules, and start linking positions.</p>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Active strategies */}
                    <div className="rounded-2xl border border-border/20 overflow-hidden bg-card shadow-ambient impressionist-card">
                        {activeStrategies.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                                No active strategies.
                            </div>
                        ) : (
                            activeStrategies.map((strategy, i) => {
                                const posCount = getPositionCount(strategy.id)
                                return (
                                    <button
                                        key={strategy.id}
                                        onClick={() => navigate(`/strategies/${strategy.id}`)}
                                        className={`w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-all duration-300 ease-out text-left ${
                                            i < activeStrategies.length - 1 ? 'border-b border-border/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                                                <Lightbulb className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{strategy.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {posCount} {posCount === 1 ? 'position' : 'positions'}
                                                    {strategy.description && ` · ${strategy.description.slice(0, 40)}${strategy.description.length > 40 ? '...' : ''}`}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Archived toggle */}
                    {archivedStrategies.length > 0 && (
                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                        >
                            <Archive className="h-3.5 w-3.5" />
                            <span>{showArchived ? 'Hide' : 'Show'} {archivedStrategies.length} archived</span>
                            <ChevronRight className={`h-3 w-3 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                        </button>
                    )}

                    {showArchived && archivedStrategies.length > 0 && (
                        <div className="rounded-2xl border border-border/20 overflow-hidden bg-card opacity-70 shadow-ambient">
                            {archivedStrategies.map((strategy, i) => {
                                const posCount = getPositionCount(strategy.id)
                                return (
                                    <button
                                        key={strategy.id}
                                        onClick={() => navigate(`/strategies/${strategy.id}`)}
                                        className={`w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-all duration-300 ease-out text-left ${
                                            i < archivedStrategies.length - 1 ? 'border-b border-border/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                <Archive className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{strategy.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Archived · {posCount} {posCount === 1 ? 'position' : 'positions'}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
