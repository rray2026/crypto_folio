import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { useMobileHeader } from "@/contexts/MobileHeaderContext"
import { useSettingsStore, SUPPORTED_EXCHANGES, fetchPriceForExchange } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowLeft, Pin, RefreshCw, Trash2, Plus, Loader2, AlertCircle, ChevronDown } from "lucide-react"

const EXCHANGE_COLORS: Record<string, string> = {
    Binance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    OKX:     "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    Bybit:   "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
}

export default function TradingPairs() {
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => { setMobileHeader({ title: "Trading Pairs" }) }, [setMobileHeader])

    const {
        pairConfigs, pinnedPairs, prices,
        addPair, removePair, updatePairExchange, togglePinPair, fetchPrices,
    } = useSettingsStore()

    const [newPair, setNewPair] = useState("")
    const [newExchange, setNewExchange] = useState<string>("Binance")
    const [addError, setAddError] = useState<string | null>(null)
    const [isValidatingAdd, setIsValidatingAdd] = useState(false)

    const [syncingPairs, setSyncingPairs] = useState<Record<string, boolean>>({})
    const [isSyncingAll, setIsSyncingAll] = useState(false)

    // Per-row exchange validation state
    const [validatingExchange, setValidatingExchange] = useState<Record<string, boolean>>({})
    const [exchangeErrors, setExchangeErrors] = useState<Record<string, string>>({})
    const [openPopover, setOpenPopover] = useState<string | null>(null)

    useEffect(() => {
        fetchPrices()
        const interval = setInterval(fetchPrices, 300000)
        return () => clearInterval(interval)
    }, [fetchPrices])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const pair = newPair.trim().toUpperCase()
        if (!pair) return

        setIsValidatingAdd(true)
        setAddError(null)

        const price = await fetchPriceForExchange(pair, newExchange)
        if (price === null) {
            setAddError(`"${pair}" not found on ${newExchange}. Check the symbol and try again.`)
            setIsValidatingAdd(false)
            return
        }

        addPair(pair, newExchange)
        setNewPair("")
        setIsValidatingAdd(false)
    }

    const handleExchangeChange = async (pair: string, newExch: string) => {
        setOpenPopover(null)
        setValidatingExchange(prev => ({ ...prev, [pair]: true }))
        setExchangeErrors(prev => { const next = { ...prev }; delete next[pair]; return next })

        const price = await fetchPriceForExchange(pair, newExch)
        if (price === null) {
            setExchangeErrors(prev => ({
                ...prev,
                [pair]: `"${pair}" not found on ${newExch}`,
            }))
        } else {
            updatePairExchange(pair, newExch)
        }

        setValidatingExchange(prev => ({ ...prev, [pair]: false }))
    }

    const handleManualSync = async (pair: string) => {
        setSyncingPairs(prev => ({ ...prev, [pair]: true }))
        await fetchPrices([pair], true, true)
        setSyncingPairs(prev => ({ ...prev, [pair]: false }))
    }

    const handleSyncAll = async () => {
        setIsSyncingAll(true)
        await fetchPrices(undefined, true, false)
        setIsSyncingAll(false)
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            {/* Desktop header */}
            <div className="hidden md:flex items-center gap-3">
                <Link to="/settings">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trading Pairs</h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                        Manage pre-defined pairs used as quick-select options across the app.
                    </p>
                </div>
            </div>

            {/* Add form */}
            <div className="bg-card p-6 rounded-xl border shadow-sm">
                <h2 className="text-base font-semibold mb-4">Add New Pair</h2>
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="e.g. ADA/USDT"
                        value={newPair}
                        onChange={(e) => { setNewPair(e.target.value); setAddError(null) }}
                        className="flex-1 max-w-xs font-mono uppercase"
                        disabled={isValidatingAdd}
                    />
                    <Select value={newExchange} onValueChange={(val) => { setNewExchange(val); setAddError(null) }} disabled={isValidatingAdd}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Exchange" />
                        </SelectTrigger>
                        <SelectContent>
                            {SUPPORTED_EXCHANGES.map(ex => (
                                <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="submit" variant="secondary" className="gap-2" disabled={isValidatingAdd}>
                        {isValidatingAdd
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
                            : <><Plus className="h-4 w-4" /> Add</>
                        }
                    </Button>
                </form>
                {addError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {addError}
                    </p>
                )}
            </div>

            {/* Pairs list */}
            <div className="bg-card rounded-xl border shadow-sm">
                <div className="flex items-center justify-between p-6 pb-4">
                    <h2 className="text-base font-semibold">
                        {pairConfigs.length} {pairConfigs.length === 1 ? 'Pair' : 'Pairs'}
                    </h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncAll}
                        disabled={isSyncingAll}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                        Sync All
                    </Button>
                </div>

                {pairConfigs.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">No pairs added yet.</p>
                ) : (
                    <div className="divide-y divide-border/50">
                        {pairConfigs.map(({ pair, exchange }) => {
                            const priceData = prices[pair]
                            const priceDisplay = priceData
                                ? `$${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : '—'
                            const lastSync = priceData
                                ? format(new Date(priceData.timestamp), "HH:mm:ss")
                                : 'Never'
                            const isPinned = pinnedPairs.includes(pair)
                            const exchangeColor = EXCHANGE_COLORS[exchange] ?? "bg-muted/50 text-muted-foreground border-border/50"
                            const isValidating = !!validatingExchange[pair]
                            const rowError = exchangeErrors[pair]

                            return (
                                <div key={pair} className="px-6 py-4 group hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {/* Left: pair name + clickable exchange badge + price */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-sm">{pair}</span>

                                                {/* Exchange badge — click to switch */}
                                                {isValidating ? (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${exchangeColor}`}>
                                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                        {exchange}
                                                    </span>
                                                ) : (
                                                    <Popover
                                                        open={openPopover === pair}
                                                        onOpenChange={(open) => setOpenPopover(open ? pair : null)}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <button
                                                                className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${exchangeColor}`}
                                                                title="Change exchange"
                                                            >
                                                                {exchange}
                                                                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                                            </button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-2" align="start" sideOffset={6}>
                                                            <p className="text-[10px] text-muted-foreground mb-2 px-1">Switch exchange</p>
                                                            <div className="flex flex-col gap-1">
                                                                {SUPPORTED_EXCHANGES.map(ex => {
                                                                    const color = EXCHANGE_COLORS[ex] ?? "bg-muted/50 text-muted-foreground border-border/50"
                                                                    const isCurrent = ex === exchange
                                                                    return (
                                                                        <button
                                                                            key={ex}
                                                                            onClick={() => handleExchangeChange(pair, ex)}
                                                                            disabled={isCurrent}
                                                                            className={`text-left text-xs font-semibold px-3 py-1.5 rounded border transition-opacity ${color} ${isCurrent ? 'opacity-40 cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
                                                                        >
                                                                            {ex}{isCurrent && ' ✓'}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="font-mono">{priceDisplay}</span>
                                                <span className="text-[10px]">sync {lastSync}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => togglePinPair(pair)}
                                                className={`h-8 w-8 transition-colors ${isPinned ? 'text-primary opacity-100' : 'text-muted-foreground hover:text-primary'}`}
                                                title={isPinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
                                            >
                                                <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={syncingPairs[pair]}
                                                onClick={() => handleManualSync(pair)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                title="Sync Price"
                                            >
                                                <RefreshCw className={`h-3.5 w-3.5 ${syncingPairs[pair] ? 'animate-spin' : ''}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePair(pair)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                title="Remove Pair"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Per-row exchange error */}
                                    {rowError && (
                                        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            {rowError}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
