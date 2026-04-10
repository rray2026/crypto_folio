import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { ArrowLeft, RotateCcw, PlusCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { getPositionMetrics } from "@/lib/metrics"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { mul, div, add, sub } from "@/lib/math"
import type { Transaction, Position } from "@/lib/types"

// --- Types ---

interface SimTrade {
    id: string
    side: "BUY" | "SELL"
    price: number
    qty: number
}

// --- Helpers ---

function formatNum(n: number, minFrac = 2, maxFrac = 6): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac })
}

function pnlColor(v: number): string {
    if (v > 0) return "text-emerald-500 dark:text-emerald-400"
    if (v < 0) return "text-rose-500 dark:text-rose-400"
    return "text-foreground"
}

function getPriceBounds(refPrice: number) {
    if (refPrice <= 0) return { min: 0, max: 1, step: 0.01 }
    const magnitude = Math.pow(10, Math.floor(Math.log10(refPrice)))
    const step = magnitude / 1000
    const min = Math.max(0, refPrice - refPrice * 0.5)
    const max = refPrice + refPrice * 0.5
    return { min: parseFloat(min.toFixed(10)), max: parseFloat(max.toFixed(10)), step: parseFloat(step.toFixed(10)) }
}

function getQtyBounds(holding: number) {
    const absHolding = Math.abs(holding)
    if (absHolding <= 0) return { min: 0, max: 100, step: 1 }
    const magnitude = Math.pow(10, Math.floor(Math.log10(absHolding)))
    const step = magnitude / 100
    const max = absHolding * 3
    return { min: 0, max: parseFloat(max.toFixed(10)), step: parseFloat(step.toFixed(10)) }
}

function vibrate() {
    if (typeof navigator.vibrate === "function") navigator.vibrate(10)
}

// --- Tappable Value Editor ---

function TappableValue({
    value, onCommit, prefix, suffix, className,
    minFrac = 2, maxFrac = 6,
}: {
    value: number; onCommit: (v: number) => void
    prefix?: string; suffix?: string; className?: string
    minFrac?: number; maxFrac?: number
}) {
    const [editing, setEditing] = useState(false)
    const [editText, setEditText] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const startEdit = useCallback(() => {
        setEditText(String(value))
        setEditing(true)
    }, [value])

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [editing])

    const commit = useCallback(() => {
        const parsed = parseFloat(editText)
        if (!isNaN(parsed) && parsed >= 0) {
            onCommit(parsed)
        }
        setEditing(false)
    }, [editText, onCommit])

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="number"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
                className="font-mono text-sm font-bold bg-muted/50 border border-primary/30 rounded px-1.5 py-0.5 w-28 text-right outline-none focus:border-primary"
                step="any"
                min="0"
            />
        )
    }

    return (
        <button
            type="button"
            onClick={startEdit}
            className={`font-mono text-sm font-bold hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-text ${className ?? ""}`}
        >
            {prefix}{formatNum(value, minFrac, maxFrac)}{suffix}
        </button>
    )
}

let simIdCounter = 0

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

    // Auto-recentering anchor for price slider (updates on release)
    const [priceAnchor, setPriceAnchor] = useState<number | null>(null)
    // Auto-expanding max for qty slider
    const [qtyRangeMax, setQtyRangeMax] = useState<number | null>(null)

    // Haptic feedback: track last value to detect threshold crossings
    const lastPriceRef = useRef<number | null>(null)
    const lastQtyRef = useRef<number | null>(null)

    // Smooth recentering transition after release
    const [priceRecentering, setPriceRecentering] = useState(false)
    const [qtyRecentering, setQtyRecentering] = useState(false)

    // Pending committed sim trades (in-memory only)
    const [pendingTrades, setPendingTrades] = useState<SimTrade[]>([])

    useEffect(() => {
        if (position?.status === "OPEN") fetchPrices([position.symbol])
    }, [position?.status, position?.symbol, fetchPrices])

    const linkedTxs = useMemo(() => {
        if (!position || !allTransactions) return []
        const linkedIds = new Set(position.entries.map(e => e.transactionId))
        return allTransactions.filter(tx => linkedIds.has(tx.id))
    }, [position, allTransactions])

    // Metrics with only pending trades (no current draft)
    const pendingMetrics = useMemo(() => {
        if (!position) return null
        if (pendingTrades.length === 0) return getPositionMetrics(position, linkedTxs, prices)

        const extraTxs: Transaction[] = pendingTrades.map(t => ({
            id: t.id, date: simTimestamp, symbol: position.symbol,
            type: t.side, price: t.price, quantity: t.qty,
            amount: mul(t.price, t.qty), fee: 0, associatedPositionIds: [position.id],
        }))
        const extraEntries = pendingTrades.map(t => ({ transactionId: t.id, allocatedAmount: t.qty }))
        const simPos: Position = { ...position, entries: [...position.entries, ...extraEntries] }
        return getPositionMetrics(simPos, [...linkedTxs, ...extraTxs], prices)
    }, [position, linkedTxs, prices, pendingTrades, simTimestamp])

    // Reference price for slider
    const refPrice = useMemo(() => {
        if (pendingMetrics && pendingMetrics.currentPrice > 0) return pendingMetrics.currentPrice
        if (pendingMetrics && pendingMetrics.avgBuyPrice > 0) return pendingMetrics.avgBuyPrice
        return 0
    }, [pendingMetrics])

    const simPrice = simPriceRaw ?? refPrice

    // Step sizes (stable, based on refPrice magnitude)
    const defaultPriceBounds = useMemo(() => getPriceBounds(refPrice), [refPrice])
    const defaultQtyBounds = useMemo(() => getQtyBounds(pendingMetrics?.totalRemaining ?? 0), [pendingMetrics?.totalRemaining])

    // Price slider: range centered on anchor (±50%), recenters on release
    const effPriceAnchor = priceAnchor ?? refPrice
    const priceSliderMin = Math.max(0, effPriceAnchor * 0.5)
    const priceSliderMax = effPriceAnchor * 1.5

    // Qty slider: range from 0 to expandable max
    const effQtyMax = qtyRangeMax ?? defaultQtyBounds.max

    // Price drag with haptic feedback on preset crossings
    const handlePriceChange = useCallback(([v]: number[]) => {
        setSimPrice(v)
        setPriceRecentering(false)
        const prev = lastPriceRef.current
        if (prev !== null && refPrice > 0) {
            for (const pct of [-20, -10, -5, 0, 5, 10, 20]) {
                const t = refPrice * (1 + pct / 100)
                if ((prev < t && v >= t) || (prev > t && v <= t)) { vibrate(); break }
            }
        }
        lastPriceRef.current = v
    }, [refPrice])

    // Price commit: recenter range with smooth transition
    const handlePriceCommit = useCallback(([v]: number[]) => {
        setSimPrice(v)
        setPriceAnchor(v)
        lastPriceRef.current = v
        setPriceRecentering(true)
        setTimeout(() => setPriceRecentering(false), 350)
    }, [])

    // Qty drag with haptic on holding-% crossings
    const handleQtyChange = useCallback(([v]: number[]) => {
        setSimQty(v)
        setQtyRecentering(false)
        const prev = lastQtyRef.current
        const holding = Math.abs(pendingMetrics?.totalRemaining ?? 0)
        if (prev !== null && holding > 0) {
            for (const pct of [10, 25, 50, 75, 100]) {
                const t = holding * pct / 100
                if ((prev < t && v >= t) || (prev > t && v <= t)) { vibrate(); break }
            }
        }
        lastQtyRef.current = v
    }, [pendingMetrics?.totalRemaining])

    // Qty commit: auto-expand with smooth transition if near max
    const handleQtyCommit = useCallback(([v]: number[]) => {
        setSimQty(v)
        lastQtyRef.current = v
        if (v > effQtyMax * 0.8) {
            setQtyRangeMax(v * 2)
            setQtyRecentering(true)
            setTimeout(() => setQtyRecentering(false), 350)
        }
    }, [effQtyMax])

    // Set price from tappable/preset (also recenters anchor)
    const handleSetSimPrice = useCallback((v: number) => {
        setSimPrice(v)
        setPriceAnchor(v)
    }, [])

    // Set qty from tappable/preset (auto-expand if needed)
    const handleSetSimQty = useCallback((v: number) => {
        setSimQty(v)
        if (v > effQtyMax) setQtyRangeMax(v * 1.5)
    }, [effQtyMax])

    // Full metrics: pending trades + current draft
    const simMetrics = useMemo(() => {
        if (!position || !pendingMetrics) return null
        if (simQty <= 0) return pendingMetrics

        const allSimTrades = [...pendingTrades, { id: "__draft__", side: simSide, price: simPrice, qty: simQty }]
        const extraTxs: Transaction[] = allSimTrades.map(t => ({
            id: t.id, date: simTimestamp, symbol: position.symbol,
            type: t.side, price: t.price, quantity: t.qty,
            amount: mul(t.price, t.qty), fee: 0, associatedPositionIds: [position.id],
        }))
        const extraEntries = allSimTrades.map(t => ({ transactionId: t.id, allocatedAmount: t.qty }))
        const simPos: Position = { ...position, entries: [...position.entries, ...extraEntries] }
        const simPrices = { ...prices, [position.symbol]: { price: String(simPrice), timestamp: simTimestamp } }
        return getPositionMetrics(simPos, [...linkedTxs, ...extraTxs], simPrices)
    }, [position, pendingMetrics, linkedTxs, prices, pendingTrades, simSide, simPrice, simQty, simTimestamp])

    // Current metrics (original, no sim)
    const currentMetrics = useMemo(() => {
        if (!position) return null
        return getPositionMetrics(position, linkedTxs, prices)
    }, [position, linkedTxs, prices])

    // Add current draft to pending list
    const addTrade = useCallback(() => {
        if (simQty <= 0) return
        setPendingTrades(prev => [...prev, { id: `__sim_${++simIdCounter}__`, side: simSide, price: simPrice, qty: simQty }])
        setSimQty(0)
    }, [simSide, simPrice, simQty])

    const removeTrade = useCallback((tradeId: string) => {
        setPendingTrades(prev => prev.filter(t => t.id !== tradeId))
    }, [])

    const resetSim = useCallback(() => {
        setSimSide("BUY")
        setSimPrice(null)
        setSimQty(0)
        setPendingTrades([])
        setPriceAnchor(null)
        setQtyRangeMax(null)
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
    const hasAnyChange = pendingTrades.length > 0 || simQty > 0

    const totalFee = linkedTxs.reduce((sum, tx) => {
        const allocated = position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0
        const ratio = tx.quantity > 0 ? allocated / tx.quantity : 0
        return sum + (tx.fee || 0) * ratio
    }, 0)

    const deltaRealizedPnL = hasAnyChange ? sub(simMetrics.realizedPnL, currentMetrics.realizedPnL) : 0
    const deltaUnrealizedPnL = hasAnyChange ? sub(simMetrics.unrealizedPnL, currentMetrics.unrealizedPnL) : 0
    const deltaRoi = hasAnyChange ? sub(simMetrics.roi, currentMetrics.roi) : 0

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

            {/* Metrics Grid */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 sm:gap-y-6 gap-x-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Realized PnL</span>
                                <DeltaBadge delta={deltaRealizedPnL} prefix={currencySymbol} />
                            </div>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(simMetrics.realizedPnL)}`}>
                                {currencySymbol}{simMetrics.realizedPnL > 0 ? "+" : ""}{simMetrics.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Unrealized PnL</span>
                                <DeltaBadge delta={hasAnyChange && simMetrics.totalRemaining !== 0 ? deltaUnrealizedPnL : 0} prefix={currencySymbol} />
                            </div>
                            <span className={`text-base sm:text-xl font-bold font-mono ${simMetrics.totalRemaining !== 0 ? pnlColor(simMetrics.unrealizedPnL) : "text-foreground"}`}>
                                {simMetrics.totalRemaining !== 0 ? `${currencySymbol}${simMetrics.unrealizedPnL > 0 ? "+" : ""}${simMetrics.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Avg Buy</span>
                                <DeltaBadge delta={hasAnyChange ? sub(simMetrics.avgBuyPrice, currentMetrics.avgBuyPrice) : 0} prefix={currencySymbol} />
                            </div>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {simMetrics.avgBuyPrice > 0 ? `${currencySymbol}${simMetrics.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Avg Sell</span>
                                <DeltaBadge delta={hasAnyChange ? sub(simMetrics.avgSellPrice, currentMetrics.avgSellPrice) : 0} prefix={currencySymbol} />
                            </div>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {simMetrics.avgSellPrice > 0 ? `${currencySymbol}${simMetrics.avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Total Fee</span>
                            </div>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {totalFee > 0 ? `${currencySymbol}${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">ROI</span>
                                <DeltaBadge delta={deltaRoi} suffix="%" />
                            </div>
                            <span className={`text-base sm:text-xl font-bold font-mono ${pnlColor(simMetrics.roi)}`}>
                                {simMetrics.roi > 0 ? "+" : ""}{simMetrics.roi.toFixed(2)}%
                            </span>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Holding</span>
                                <DeltaBadge delta={hasAnyChange ? sub(simMetrics.totalRemaining, currentMetrics.totalRemaining) : 0} suffix={` ${baseAsset}`} />
                            </div>
                            <div className="flex items-baseline gap-1 truncate">
                                <span className="text-base sm:text-xl font-bold font-mono">{simMetrics.totalRemaining.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{baseAsset}</span>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider" title="Breakeven price considering realized PnL">Avg Cost</span>
                                <DeltaBadge delta={hasAnyChange && simMetrics.totalRemaining !== 0 ? sub(simMetrics.breakevenPrice, currentMetrics.breakevenPrice) : 0} prefix={currencySymbol} />
                            </div>
                            <span className="text-base sm:text-xl font-bold font-mono">
                                {(simMetrics.breakevenPrice > 0 && simMetrics.totalRemaining !== 0) ? `${currencySymbol}${simMetrics.breakevenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "--"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Virtual Trade Controls */}
            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3.5">
                    <div className="flex p-0.5 bg-muted/30 rounded-lg border border-border/50 h-9">
                        <button
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-1 rounded-md text-xs font-bold transition-all ${
                                simSide === "BUY"
                                    ? "bg-background text-foreground shadow-sm"
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
                                    ? "bg-background text-foreground shadow-sm"
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
                            <div className="flex items-center gap-1.5">
                                <TappableValue
                                    value={simPrice}
                                    onCommit={handleSetSimPrice}
                                    prefix={currencySymbol}
                                />
                                {simPrice !== refPrice && refPrice > 0 && (
                                    <span className={`text-[10px] font-mono font-semibold ${simPrice > refPrice ? "text-emerald-500" : "text-rose-500"}`}>
                                        {simPrice > refPrice ? "+" : ""}{((simPrice - refPrice) / refPrice * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <SliderPrimitive.Root
                            value={[simPrice]}
                            min={priceSliderMin}
                            max={priceSliderMax}
                            step={defaultPriceBounds.step}
                            onValueChange={handlePriceChange}
                            onValueCommit={handlePriceCommit}
                            className={`relative flex w-full touch-none select-none items-center ${
                                priceRecentering ? "[&_span]:transition-[left,right] [&_span]:duration-300 [&_span]:ease-out" : ""
                            }`}
                        >
                            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
                                <SliderPrimitive.Range className="absolute h-full bg-primary" />
                            </SliderPrimitive.Track>
                            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                        </SliderPrimitive.Root>
                        <div className="flex gap-1 flex-wrap">
                            {refPrice > 0 && [-20, -10, -5, 0, 5, 10, 20].map(pct => {
                                const val = mul(refPrice, add(1, div(pct, 100)))
                                const isActive = Math.abs(simPrice - val) < defaultPriceBounds.step * 0.5
                                return (
                                    <button
                                        key={pct}
                                        type="button"
                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                            isActive
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : pct === 0
                                                    ? "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                        }`}
                                        onClick={() => handleSetSimPrice(val)}
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
                                <TappableValue
                                    value={simQty}
                                    onCommit={handleSetSimQty}
                                    minFrac={0}
                                    maxFrac={8}
                                />
                                <span className="text-[10px] text-muted-foreground uppercase">{baseAsset}</span>
                            </div>
                        </div>
                        <SliderPrimitive.Root
                            value={[simQty]}
                            min={0}
                            max={effQtyMax}
                            step={defaultQtyBounds.step}
                            onValueChange={handleQtyChange}
                            onValueCommit={handleQtyCommit}
                            className={`relative flex w-full touch-none select-none items-center ${
                                qtyRecentering ? "[&_span]:transition-[left,right] [&_span]:duration-300 [&_span]:ease-out" : ""
                            }`}
                        >
                            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
                                <SliderPrimitive.Range className="absolute h-full bg-primary" />
                            </SliderPrimitive.Track>
                            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                        </SliderPrimitive.Root>
                        {pendingMetrics && Math.abs(pendingMetrics.totalRemaining) > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {[10, 25, 50, 75, 100].map(pct => {
                                    const val = mul(Math.abs(pendingMetrics.totalRemaining), div(pct, 100))
                                    const isActive = simQty > 0 && Math.abs(simQty - val) < defaultQtyBounds.step * 0.5
                                    return (
                                        <button
                                            key={pct}
                                            type="button"
                                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                                                isActive
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                            }`}
                                            onClick={() => handleSetSimQty(val)}
                                        >
                                            {pct}%
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Add trade button */}
                    {simQty > 0 && (
                        <button
                            type="button"
                            onClick={addTrade}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 text-xs font-medium transition-colors active:scale-[0.99]"
                        >
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span>{simSide} {formatNum(simQty, 0, 8)} {baseAsset} @ {currencySymbol}{formatNum(simPrice)}</span>
                            </div>
                            <span className="font-mono font-bold">
                                {currencySymbol}{formatNum(simTotal)}
                            </span>
                        </button>
                    )}
                </CardContent>
            </Card>

            {/* Pending simulated trades list */}
            {pendingTrades.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-1">
                        Simulated Trades ({pendingTrades.length})
                    </span>
                    <div className="space-y-1">
                        {pendingTrades.map((t, i) => (
                            <div
                                key={t.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-muted/20 text-xs"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-muted-foreground/50 font-mono w-4 text-center shrink-0">#{i + 1}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                        t.side === "BUY"
                                            ? "bg-muted text-emerald-600/70 dark:text-emerald-400/70"
                                            : "bg-muted text-rose-600/70 dark:text-rose-400/70"
                                    }`}>
                                        {t.side}
                                    </span>
                                    <span className="text-muted-foreground truncate">
                                        {formatNum(t.qty, 0, 8)} {baseAsset} @ {currencySymbol}{formatNum(t.price)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono font-bold">
                                        {currencySymbol}{formatNum(mul(t.price, t.qty))}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeTrade(t.id)}
                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// --- DeltaBadge ---

function DeltaBadge({ delta, prefix, suffix }: { delta: number; prefix?: string; suffix?: string }) {
    if (delta === 0) return null
    const isPositive = delta > 0
    const formatted = suffix === "%" ? delta.toFixed(2) : prefix
        ? delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : formatNum(delta)
    return (
        <span className={`inline-flex items-center text-[9px] font-mono font-semibold px-1 py-px rounded ${
            isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        }`}>
            {isPositive ? "+" : ""}{prefix || ""}{formatted}{suffix || ""}
        </span>
    )
}
