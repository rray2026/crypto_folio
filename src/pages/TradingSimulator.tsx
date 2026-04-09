import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RotateCcw, Minus, Plus } from "lucide-react"
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

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5 md:space-y-6 min-h-full">
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

            {/* Position Info Bar */}
            <div className="flex items-center gap-3 text-sm">
                <span className="font-mono font-bold text-muted-foreground">{position.symbol}</span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    currentMetrics.positionType === "LONG"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40"
                }`}>
                    {currentMetrics.positionType === "LONG" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {currentMetrics.positionType}
                </span>
                {currentMetrics.currentPrice > 0 && (
                    <span className="ml-auto font-mono text-primary font-medium">
                        {currencySymbol}{formatNum(currentMetrics.currentPrice)}
                    </span>
                )}
            </div>

            {/* Virtual Trade Controls */}
            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Side Toggle */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Direction</span>
                        <div className="flex p-1 bg-muted/30 rounded-xl border border-border/50 h-11">
                            <button
                                type="button"
                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                                    simSide === "BUY"
                                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                                        : "text-muted-foreground/60"
                                }`}
                                onClick={() => setSimSide("BUY")}
                            >
                                <ArrowDownRight className="h-3.5 w-3.5" />
                                BUY
                            </button>
                            <button
                                type="button"
                                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                                    simSide === "SELL"
                                        ? "bg-background text-red-600 dark:text-red-400 shadow-sm"
                                        : "text-muted-foreground/60"
                                }`}
                                onClick={() => setSimSide("SELL")}
                            >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                SELL
                            </button>
                        </div>
                    </div>

                    {/* Price Slider */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Price</span>
                            <span className="font-mono text-sm font-bold">
                                {currencySymbol}{formatNum(simPrice)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="shrink-0 h-8 w-8 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimPrice(prev => Math.max(priceBounds.min, sub(prev ?? refPrice, priceBounds.step)))}
                            >
                                <Minus className="h-3.5 w-3.5" />
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
                                className="shrink-0 h-8 w-8 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimPrice(prev => Math.min(priceBounds.max, add(prev ?? refPrice, priceBounds.step)))}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {/* Price presets */}
                        <div className="flex gap-1.5 flex-wrap">
                            {refPrice > 0 && (
                                <>
                                    {[-20, -10, -5, 0, 5, 10, 20].map(pct => {
                                        const val = mul(refPrice, add(1, div(pct, 100)))
                                        const isActive = Math.abs(simPrice - val) < priceBounds.step * 0.5
                                        return (
                                            <button
                                                key={pct}
                                                type="button"
                                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
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
                                </>
                            )}
                        </div>
                    </div>

                    {/* Quantity Slider */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Quantity</span>
                            <div className="flex items-baseline gap-1">
                                <span className="font-mono text-sm font-bold">{formatNum(simQty, 0, 8)}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{baseAsset}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="shrink-0 h-8 w-8 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimQty(prev => Math.max(0, sub(prev, qtyBounds.step)))}
                            >
                                <Minus className="h-3.5 w-3.5" />
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
                                className="shrink-0 h-8 w-8 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
                                onClick={() => setSimQty(prev => Math.min(qtyBounds.max, add(prev, qtyBounds.step)))}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {/* Quantity presets based on current holding */}
                        {Math.abs(currentMetrics.totalRemaining) > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                                {[10, 25, 50, 75, 100].map(pct => {
                                    const val = mul(Math.abs(currentMetrics.totalRemaining), div(pct, 100))
                                    const isActive = simQty > 0 && Math.abs(simQty - val) < qtyBounds.step * 0.5
                                    return (
                                        <button
                                            key={pct}
                                            type="button"
                                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
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
                    {simQty > 0 && (
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${
                            simSide === "BUY"
                                ? "bg-emerald-500/5 border-emerald-200/30 dark:border-emerald-800/30"
                                : "bg-red-500/5 border-red-200/30 dark:border-red-800/30"
                        }`}>
                            <span className="text-xs text-muted-foreground">
                                {simSide} {formatNum(simQty, 0, 8)} {baseAsset} @ {currencySymbol}{formatNum(simPrice)}
                            </span>
                            <span className={`font-mono text-sm font-bold ${simSide === "BUY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {currencySymbol}{formatNum(simTotal)}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Metrics Comparison */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-0 divide-y divide-border/40">
                        <MetricRow
                            label="Holdings"
                            before={`${formatNum(currentMetrics.totalRemaining, 0, 8)} ${baseAsset}`}
                            after={`${formatNum(simMetrics.totalRemaining, 0, 8)} ${baseAsset}`}
                            changed={simQty > 0}
                        />
                        <MetricRow
                            label="Avg Buy"
                            before={currentMetrics.avgBuyPrice > 0 ? `${currencySymbol}${formatNum(currentMetrics.avgBuyPrice)}` : "--"}
                            after={simMetrics.avgBuyPrice > 0 ? `${currencySymbol}${formatNum(simMetrics.avgBuyPrice)}` : "--"}
                            changed={simQty > 0 && currentMetrics.avgBuyPrice !== simMetrics.avgBuyPrice}
                        />
                        <MetricRow
                            label="Avg Sell"
                            before={currentMetrics.avgSellPrice > 0 ? `${currencySymbol}${formatNum(currentMetrics.avgSellPrice)}` : "--"}
                            after={simMetrics.avgSellPrice > 0 ? `${currencySymbol}${formatNum(simMetrics.avgSellPrice)}` : "--"}
                            changed={simQty > 0 && currentMetrics.avgSellPrice !== simMetrics.avgSellPrice}
                        />
                        <MetricRow
                            label="Breakeven"
                            before={currentMetrics.breakevenPrice > 0 && currentMetrics.totalRemaining !== 0 ? `${currencySymbol}${formatNum(currentMetrics.breakevenPrice)}` : "--"}
                            after={simMetrics.breakevenPrice > 0 && simMetrics.totalRemaining !== 0 ? `${currencySymbol}${formatNum(simMetrics.breakevenPrice)}` : "--"}
                            changed={simQty > 0 && currentMetrics.breakevenPrice !== simMetrics.breakevenPrice}
                        />
                        <MetricRow
                            label="Realized PnL"
                            before={`${currencySymbol}${currentMetrics.realizedPnL > 0 ? "+" : ""}${formatNum(currentMetrics.realizedPnL)}`}
                            after={`${currencySymbol}${simMetrics.realizedPnL > 0 ? "+" : ""}${formatNum(simMetrics.realizedPnL)}`}
                            beforeColor={pnlColor(currentMetrics.realizedPnL)}
                            afterColor={pnlColor(simMetrics.realizedPnL)}
                            changed={simQty > 0 && currentMetrics.realizedPnL !== simMetrics.realizedPnL}
                            delta={simQty > 0 ? sub(simMetrics.realizedPnL, currentMetrics.realizedPnL) : 0}
                            currencySymbol={currencySymbol}
                        />
                        <MetricRow
                            label="Unrealized PnL"
                            before={currentMetrics.totalRemaining !== 0 ? `${currencySymbol}${currentMetrics.unrealizedPnL > 0 ? "+" : ""}${formatNum(currentMetrics.unrealizedPnL)}` : "--"}
                            after={simMetrics.totalRemaining !== 0 ? `${currencySymbol}${simMetrics.unrealizedPnL > 0 ? "+" : ""}${formatNum(simMetrics.unrealizedPnL)}` : "--"}
                            beforeColor={currentMetrics.totalRemaining !== 0 ? pnlColor(currentMetrics.unrealizedPnL) : undefined}
                            afterColor={simMetrics.totalRemaining !== 0 ? pnlColor(simMetrics.unrealizedPnL) : undefined}
                            changed={simQty > 0}
                            delta={simQty > 0 && simMetrics.totalRemaining !== 0 ? sub(simMetrics.unrealizedPnL, currentMetrics.unrealizedPnL) : 0}
                            currencySymbol={currencySymbol}
                        />
                        <MetricRow
                            label="Total PnL"
                            before={`${currencySymbol}${currentMetrics.totalPnL > 0 ? "+" : ""}${formatNum(currentMetrics.totalPnL)}`}
                            after={`${currencySymbol}${simMetrics.totalPnL > 0 ? "+" : ""}${formatNum(simMetrics.totalPnL)}`}
                            beforeColor={pnlColor(currentMetrics.totalPnL)}
                            afterColor={pnlColor(simMetrics.totalPnL)}
                            changed={simQty > 0 && currentMetrics.totalPnL !== simMetrics.totalPnL}
                            delta={simQty > 0 ? sub(simMetrics.totalPnL, currentMetrics.totalPnL) : 0}
                            currencySymbol={currencySymbol}
                        />
                        <MetricRow
                            label="ROI"
                            before={`${currentMetrics.roi > 0 ? "+" : ""}${currentMetrics.roi.toFixed(2)}%`}
                            after={`${simMetrics.roi > 0 ? "+" : ""}${simMetrics.roi.toFixed(2)}%`}
                            beforeColor={pnlColor(currentMetrics.roi)}
                            afterColor={pnlColor(simMetrics.roi)}
                            changed={simQty > 0 && currentMetrics.roi !== simMetrics.roi}
                            delta={simQty > 0 ? sub(simMetrics.roi, currentMetrics.roi) : 0}
                            deltaUnit="%"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// --- MetricRow ---

function MetricRow({
    label,
    before,
    after,
    beforeColor,
    afterColor,
    changed,
    delta,
    currencySymbol,
    deltaUnit,
}: {
    label: string
    before: string
    after: string
    beforeColor?: string
    afterColor?: string
    changed: boolean
    delta?: number
    currencySymbol?: string
    deltaUnit?: string
}) {
    return (
        <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider shrink-0 w-24 sm:w-28">{label}</span>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 justify-end flex-1">
                {/* Before value */}
                <span className={`font-mono text-xs sm:text-sm ${changed ? "text-muted-foreground/50 line-through" : (beforeColor || "font-bold")}`}>
                    {before}
                </span>
                {/* Arrow + After value */}
                {changed && (
                    <>
                        <span className="text-muted-foreground/40 text-xs">→</span>
                        <span className={`font-mono text-xs sm:text-sm font-bold ${afterColor || ""}`}>
                            {after}
                        </span>
                    </>
                )}
                {/* Delta badge */}
                {changed && delta !== undefined && delta !== 0 && (
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                        delta > 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}>
                        {delta > 0 ? "+" : ""}{deltaUnit ? delta.toFixed(2) : `${currencySymbol || ""}${formatNum(delta)}`}{deltaUnit || ""}
                    </span>
                )}
            </div>
        </div>
    )
}
