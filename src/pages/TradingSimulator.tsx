import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { ArrowLeft, RotateCcw, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { useState, useEffect, useMemo, useCallback } from "react"
import { getPositionMetrics } from "@/lib/metrics"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { mul, div, add, sub } from "@/lib/math"
import type { Transaction, Position } from "@/lib/types"

// --- Helpers ---

function formatNum(n: number, minFrac = 2, maxFrac = 6): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac })
}

function pnlColor(v: number): string {
    if (v > 0) return "text-emerald-500 dark:text-emerald-400"
    if (v < 0) return "text-red-500 dark:text-red-400"
    return "text-foreground"
}

/** Determine smart slider bounds for price around a reference price */
function getPriceBounds(refPrice: number) {
    if (refPrice <= 0) return { min: 0, max: 1, step: 0.01 }
    const magnitude = Math.pow(10, Math.floor(Math.log10(refPrice)))
    const step = magnitude / 1000 // 0.1% granularity
    const min = Math.max(0, refPrice - refPrice * 0.5) // -50%
    const max = refPrice + refPrice * 0.5 // +50%
    return { min: parseFloat(min.toFixed(10)), max: parseFloat(max.toFixed(10)), step: parseFloat(step.toFixed(10)) }
}

/** Determine smart slider bounds for quantity */
function getQtyBounds(holding: number) {
    const absHolding = Math.abs(holding)
    if (absHolding <= 0) {
        return { min: 0, max: 100, step: 1 }
    }
    const magnitude = Math.pow(10, Math.floor(Math.log10(absHolding)))
    const step = magnitude / 100
    const max = absHolding * 3
    return { min: 0, max: parseFloat(max.toFixed(10)), step: parseFloat(step.toFixed(10)) }
}

// --- Component ---

export default function TradingSimulator() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { prices, fetchPrices, pairConfigs } = useSettingsStore()
    const { setMobileHeader } = useMobileHeader()

    const position = useLiveQuery(() => id ? db.positions.get(id) : undefined, [id])
    const allTransactions = useLiveQuery(() => db.transactions.toArray())

    // Sim state
    const [simSide, setSimSide] = useState<"BUY" | "SELL">("BUY")
    const [simPriceRaw, setSimPrice] = useState<number | null>(null)
    const [simQty, setSimQty] = useState(0)
    const [simTimestamp] = useState(() => Date.now())

    // Fetch prices
    useEffect(() => {
        if (position?.status === "OPEN") fetchPrices([position.symbol])
    }, [position?.status, position?.symbol, fetchPrices])

    // Linked transactions
    const linkedTxs = useMemo(() => {
        if (!position || !allTransactions) return []
        const linkedIds = new Set(position.entries.map(e => e.transactionId))
        return allTransactions.filter(tx => linkedIds.has(tx.id))
    }, [position, allTransactions])

    // Current metrics (before sim)
    const currentMetrics = useMemo(() => {
        if (!position) return null
        return getPositionMetrics(position, linkedTxs, prices)
    }, [position, linkedTxs, prices])

    // Reference price for slider
    const refPrice = useMemo(() => {
        if (currentMetrics && currentMetrics.currentPrice > 0) return currentMetrics.currentPrice
        if (currentMetrics && currentMetrics.avgBuyPrice > 0) return currentMetrics.avgBuyPrice
        return 0
    }, [currentMetrics])

    // Effective sim price: use user-set value or fall back to reference price
    const simPrice = simPriceRaw ?? refPrice

    const priceBounds = useMemo(() => getPriceBounds(refPrice), [refPrice])
    const qtyBounds = useMemo(() => getQtyBounds(currentMetrics?.totalRemaining ?? 0), [currentMetrics?.totalRemaining])

    // Simulated metrics (after virtual trade)
    const simMetrics = useMemo(() => {
        if (!position || !currentMetrics) return null
        if (simQty <= 0) return currentMetrics // no trade = same

        // Create a virtual transaction
        const virtualTx: Transaction = {
            id: "__sim__",
            date: simTimestamp,
            symbol: position.symbol,
            type: simSide,
            price: simPrice,
            quantity: simQty,
            amount: mul(simPrice, simQty),
            fee: 0,
            associatedPositionIds: [position.id],
        }

        // Create a virtual position with the extra entry
        const simPosition: Position = {
            ...position,
            entries: [...position.entries, { transactionId: "__sim__", allocatedAmount: simQty }],
        }

        // Calculate with simulated trade injected, using simPrice as "current price"
        const simPrices = {
            ...prices,
            [position.symbol]: { price: String(simPrice), timestamp: simTimestamp },
        }

        return getPositionMetrics(simPosition, [...linkedTxs, virtualTx], simPrices)
    }, [position, currentMetrics, linkedTxs, prices, simSide, simPrice, simQty, simTimestamp])

    // Reset sim
    const resetSim = useCallback(() => {
        setSimSide("BUY")
        setSimPrice(null)
        setSimQty(0)
    }, [])

    // Mobile header
    useEffect(() => {
        setMobileHeader({
            title: "Simulator",
            leftAction: (
                <button
                    onClick={() => navigate(`/positions/${id}`)}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
            ),
            rightActions: (
                <button
                    onClick={resetSim}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Reset"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            ),
        })
    }, [setMobileHeader, navigate, id, resetSim])

    const currencySymbol = position ? getCurrencySymbolForPair(position.symbol, pairConfigs) : "$"
    const baseAsset = position?.symbol.split("/")[0] ?? ""

    if (position === undefined) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    if (position === null) return <div className="p-8 text-center text-foreground">Position not found.</div>
    if (!currentMetrics || !simMetrics) return <div className="p-8 text-center text-muted-foreground">Loading metrics...</div>

    const simTotal = mul(simPrice, simQty)
    const hasSimTrade = simQty > 0

    // Pre-compute deltas for display
    const deltaRealizedPnL = hasSimTrade ? sub(simMetrics.realizedPnL, currentMetrics.realizedPnL) : 0
    const deltaUnrealizedPnL = hasSimTrade ? sub(simMetrics.unrealizedPnL, currentMetrics.unrealizedPnL) : 0
    const deltaRoi = hasSimTrade ? sub(simMetrics.roi, currentMetrics.roi) : 0

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4 min-h-full">
            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/positions/${id}`)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Trade Simulator</h1>
                        <p className="text-sm text-muted-foreground font-mono">{position.strategyName || position.symbol}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={resetSim}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </Button>
            </div>

            {/* Metrics Grid — same layout as PositionDetails */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                        {/* Realized PnL */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Realized PnL</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(simMetrics.realizedPnL)}`}>
                                {currencySymbol}{simMetrics.realizedPnL > 0 ? "+" : ""}{simMetrics.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <DeltaBadge delta={deltaRealizedPnL} prefix={currencySymbol} />
                        </div>

                        {/* Unrealized PnL */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Unrealized PnL</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${simMetrics.totalRemaining !== 0 ? pnlColor(simMetrics.unrealizedPnL) : "text-foreground"}`}>
                                {simMetrics.totalRemaining !== 0 ? `${currencySymbol}${simMetrics.unrealizedPnL > 0 ? "+" : ""}${simMetrics.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                            </span>
                            <DeltaBadge delta={hasSimTrade && simMetrics.totalRemaining !== 0 ? deltaUnrealizedPnL : 0} prefix={currencySymbol} />
                        </div>

                        {/* Avg Buy Price */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Buy</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {simMetrics.avgBuyPrice > 0 ? `${currencySymbol}${simMetrics.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                            <DeltaBadge delta={hasSimTrade ? sub(simMetrics.avgBuyPrice, currentMetrics.avgBuyPrice) : 0} prefix={currencySymbol} />
                        </div>

                        {/* Avg Sell Price */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Sell</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {simMetrics.avgSellPrice > 0 ? `${currencySymbol}${simMetrics.avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                            <DeltaBadge delta={hasSimTrade ? sub(simMetrics.avgSellPrice, currentMetrics.avgSellPrice) : 0} prefix={currencySymbol} />
                        </div>

                        {/* ROI */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">ROI</span>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(simMetrics.roi)}`}>
                                {simMetrics.roi > 0 ? "+" : ""}{simMetrics.roi.toFixed(2)}%
                            </span>
                            <DeltaBadge delta={deltaRoi} suffix="%" />
                        </div>

                        {/* Holding */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1">Holding</span>
                            <div className="flex items-baseline gap-1 truncate">
                                <span className="text-base sm:text-xl font-bold font-mono">{simMetrics.totalRemaining.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{baseAsset}</span>
                            </div>
                            <DeltaBadge delta={hasSimTrade ? sub(simMetrics.totalRemaining, currentMetrics.totalRemaining) : 0} suffix={` ${baseAsset}`} />
                        </div>

                        {/* Avg Cost (Breakeven) */}
                        <div className="flex flex-col">
                            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-1" title="Breakeven price considering realized PnL">Avg Cost</span>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {(simMetrics.breakevenPrice > 0 && simMetrics.totalRemaining !== 0) ? `${currencySymbol}${simMetrics.breakevenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                            <DeltaBadge delta={hasSimTrade && simMetrics.totalRemaining !== 0 ? sub(simMetrics.breakevenPrice, currentMetrics.breakevenPrice) : 0} prefix={currencySymbol} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Virtual Trade Controls — compact */}
            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3.5">
                    {/* Direction toggle — no label, self-evident */}
                    <div className="flex p-0.5 bg-muted/30 rounded-lg border border-border/50 h-9">
                        <button
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-1 rounded-md text-xs font-bold transition-all ${
                                simSide === "BUY"
                                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                                    : "text-muted-foreground/60"
                            }`}
                            onClick={() => setSimSide("BUY")}
                        >
                            BUY
                        </button>
                        <button
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-1 rounded-md text-xs font-bold transition-all ${
                                simSide === "SELL"
                                    ? "bg-background text-red-600 dark:text-red-400 shadow-sm"
                                    : "text-muted-foreground/60"
                            }`}
                            onClick={() => setSimSide("SELL")}
                        >
                            SELL
                        </button>
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Price</span>
                            <span className="font-mono text-sm font-bold">
                                {currencySymbol}{formatNum(simPrice)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                className="shrink-0 h-7 w-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimPrice(prev => Math.max(priceBounds.min, sub(prev ?? refPrice, priceBounds.step)))}
                            >
                                <Minus className="h-3 w-3" />
                            </button>
                            <Slider
                                value={[simPrice]}
                                min={priceBounds.min}
                                max={priceBounds.max}
                                step={priceBounds.step}
                                onValueChange={([v]) => setSimPrice(v)}
                                className="flex-1"
                            />
                            <button
                                type="button"
                                className="shrink-0 h-7 w-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimPrice(prev => Math.min(priceBounds.max, add(prev ?? refPrice, priceBounds.step)))}
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {refPrice > 0 && [-20, -10, -5, 0, 5, 10, 20].map(pct => {
                                const val = mul(refPrice, add(1, div(pct, 100)))
                                const isActive = Math.abs(simPrice - val) < priceBounds.step * 0.5
                                return (
                                    <button
                                        key={pct}
                                        type="button"
                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                            isActive
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : pct === 0
                                                    ? "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                                    : pct > 0
                                                        ? "bg-emerald-500/5 border-emerald-200/30 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                                        : "bg-red-500/5 border-red-200/30 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                                        }`}
                                        onClick={() => setSimPrice(val)}
                                    >
                                        {pct > 0 ? "+" : ""}{pct}%
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Quantity</span>
                            <div className="flex items-baseline gap-1">
                                <span className="font-mono text-sm font-bold">{formatNum(simQty, 0, 8)}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{baseAsset}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                className="shrink-0 h-7 w-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimQty(prev => Math.max(0, sub(prev, qtyBounds.step)))}
                            >
                                <Minus className="h-3 w-3" />
                            </button>
                            <Slider
                                value={[simQty]}
                                min={qtyBounds.min}
                                max={qtyBounds.max}
                                step={qtyBounds.step}
                                onValueChange={([v]) => setSimQty(v)}
                                className="flex-1"
                            />
                            <button
                                type="button"
                                className="shrink-0 h-7 w-7 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimQty(prev => Math.min(qtyBounds.max, add(prev, qtyBounds.step)))}
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                        {Math.abs(currentMetrics.totalRemaining) > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {[10, 25, 50, 75, 100].map(pct => {
                                    const val = mul(Math.abs(currentMetrics.totalRemaining), div(pct, 100))
                                    const isActive = simQty > 0 && Math.abs(simQty - val) < qtyBounds.step * 0.5
                                    return (
                                        <button
                                            key={pct}
                                            type="button"
                                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                                isActive
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                            }`}
                                            onClick={() => setSimQty(val)}
                                        >
                                            {pct}%
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Trade summary */}
                    {hasSimTrade && (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                            simSide === "BUY"
                                ? "bg-emerald-500/5 border-emerald-200/30 dark:border-emerald-800/30"
                                : "bg-red-500/5 border-red-200/30 dark:border-red-800/30"
                        }`}>
                            <span className="text-muted-foreground">
                                {simSide} {formatNum(simQty, 0, 8)} {baseAsset} @ {currencySymbol}{formatNum(simPrice)}
                            </span>
                            <span className={`font-mono font-bold ${simSide === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {currencySymbol}{formatNum(simTotal)}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// --- DeltaBadge: compact inline badge showing +/- change ---

function DeltaBadge({ delta, prefix, suffix }: { delta: number; prefix?: string; suffix?: string }) {
    if (delta === 0) return null
    const isPositive = delta > 0
    return (
        <span className={`mt-1 inline-flex items-center self-start text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
            isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
        }`}>
            {isPositive ? "+" : ""}{prefix || ""}{suffix === "%" ? delta.toFixed(2) : formatNum(delta)}{suffix || ""}
        </span>
    )
}
