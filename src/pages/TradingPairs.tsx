import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { useMobileHeader } from "@/contexts/MobileHeaderContext"
import { useSettingsStore, SUPPORTED_EXCHANGES, EXCHANGE_GROUPS, fetchPriceForExchange, getCurrencySymbol } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Pin, RefreshCw, Trash2, Plus, Loader2, AlertCircle, Check, ChevronDown } from "lucide-react"

const EXCHANGE_STYLES: Record<string, { badge: string; card: string; dot: string }> = {
    Binance: {
        badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
        card:  "border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5",
        dot:   "bg-yellow-500",
    },
    OKX: {
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        card:  "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5",
        dot:   "bg-blue-500",
    },
    Bybit: {
        badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
        card:  "border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5",
        dot:   "bg-orange-500",
    },
    NYSE: {
        badge: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
        card:  "border-green-500/30 hover:border-green-500/60 hover:bg-green-500/5",
        dot:   "bg-green-500",
    },
    NASDAQ: {
        badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        card:  "border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5",
        dot:   "bg-purple-500",
    },
    HTX: {
        badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        card:  "border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5",
        dot:   "bg-cyan-500",
    },
    "Gate.io": {
        badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
        card:  "border-teal-500/30 hover:border-teal-500/60 hover:bg-teal-500/5",
        dot:   "bg-teal-500",
    },
    MEXC: {
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        card:  "border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/5",
        dot:   "bg-rose-500",
    },
    SSE: {
        badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        card:  "border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5",
        dot:   "bg-red-500",
    },
    SZSE: {
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        card:  "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
        dot:   "bg-amber-500",
    },
}

const DEFAULT_STYLE = {
    badge: "bg-muted/50 text-muted-foreground border-border/50",
    card:  "border-border/50 hover:border-border hover:bg-muted/30",
    dot:   "bg-muted-foreground",
}

interface ExchangeDialogProps {
    open: boolean
    pair: string
    currentExchange: string
    onSelect: (exchange: string) => void
    onClose: () => void
}

function ExchangeDialog({ open, pair, currentExchange, onSelect, onClose }: ExchangeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        Switch exchange
                        <span className="ml-2 font-mono text-sm text-muted-foreground">{pair}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">
                    {Object.entries(EXCHANGE_GROUPS).map(([groupName, exchanges]) => (
                        <div key={groupName}>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                                {groupName}
                            </p>
                            <div className="grid gap-2">
                                {exchanges.map((ex) => {
                                    const style = EXCHANGE_STYLES[ex] ?? DEFAULT_STYLE
                                    const isCurrent = ex === currentExchange
                                    return (
                                        <button
                                            key={ex}
                                            onClick={() => onSelect(ex)}
                                            disabled={isCurrent}
                                            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all ${style.card} ${isCurrent ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} />
                                                <span className="font-semibold text-sm">{ex}</span>
                                            </div>
                                            {isCurrent && <Check className="h-4 w-4 text-muted-foreground" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
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

    const [validatingExchange, setValidatingExchange] = useState<Record<string, boolean>>({})
    const [exchangeErrors, setExchangeErrors] = useState<Record<string, string>>({})
    // pair key whose exchange dialog is open, or null
    const [dialogPair, setDialogPair] = useState<string | null>(null)

    useEffect(() => {
        fetchPrices()
        const interval = setInterval(fetchPrices, 300000)
        return () => clearInterval(interval)
    }, [fetchPrices])

    const normalizePairForExchange = (raw: string, exchange: string): string => {
        const upper = raw.trim().toUpperCase()
        if (exchange === 'SSE' && !upper.includes('.')) return `${upper}.SS`
        if (exchange === 'SZSE' && !upper.includes('.')) return `${upper}.SZ`
        return upper
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const pair = normalizePairForExchange(newPair, newExchange)
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

    const handleExchangeSelect = async (pair: string, newExch: string) => {
        setDialogPair(null)
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

    const dialogConfig = dialogPair ? pairConfigs.find(p => p.pair === dialogPair) : null

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
                        placeholder={
                            newExchange === 'SSE'  ? 'e.g. 601818 → 601818.SS' :
                            newExchange === 'SZSE' ? 'e.g. 000001 → 000001.SZ' :
                            'e.g. BTC/USDT or AAPL'
                        }
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
                                ? `${getCurrencySymbol(exchange)}${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : '—'
                            const lastSync = priceData
                                ? format(new Date(priceData.timestamp), "HH:mm:ss")
                                : 'Never'
                            const isPinned = pinnedPairs.includes(pair)
                            const style = EXCHANGE_STYLES[exchange] ?? DEFAULT_STYLE
                            const isValidating = !!validatingExchange[pair]
                            const rowError = exchangeErrors[pair]

                            return (
                                <div key={pair} className="px-6 py-4 group hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-sm">{pair}</span>

                                                {/* Exchange badge — click to open dialog */}
                                                {isValidating ? (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style.badge}`}>
                                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                        {exchange}
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => setDialogPair(pair)}
                                                        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-75 transition-opacity active:scale-95 ${style.badge}`}
                                                        title="Change exchange"
                                                    >
                                                        {exchange}
                                                        <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                                    </button>
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

            {/* Exchange selection dialog */}
            {dialogConfig && (
                <ExchangeDialog
                    open={dialogPair !== null}
                    pair={dialogConfig.pair}
                    currentExchange={dialogConfig.exchange}
                    onSelect={(ex) => handleExchangeSelect(dialogConfig.pair, ex)}
                    onClose={() => setDialogPair(null)}
                />
            )}
        </div>
    )
}
