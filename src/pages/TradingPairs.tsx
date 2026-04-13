import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import {
    useSettingsStore,
    SUPPORTED_MARKETS, MARKET_EXCHANGES, MARKET_DEFAULT_EXCHANGE, MARKET_DATA_PROVIDERS,
    DATA_PROVIDER_GROUPS,
    fetchPriceFromProvider, defaultDataProvider, getCurrencySymbol, inferCurrency,
} from "@/store/useSettingsStore"
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
    DialogDescription,
} from "@/components/ui/dialog"
import { SwipeActions } from "@/components/shared/SwipeActions"
import { ArrowLeft, Pin, RefreshCw, Trash2, Plus, Loader2, Check, ChevronDown, Activity } from "lucide-react"

const ENTITY_STYLES: Record<string, { badge: string; card: string; dot: string }> = {
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
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        card:  "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
        dot:   "bg-emerald-500",
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
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        card:  "border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/5",
        dot:   "bg-rose-500",
    },
    SZSE: {
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        card:  "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
        dot:   "bg-amber-500",
    },
    "Yahoo Finance": {
        badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
        card:  "border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5",
        dot:   "bg-violet-500",
    },
}

const DEFAULT_STYLE = {
    badge: "bg-muted/50 text-muted-foreground border-border/50",
    card:  "border-border/50 hover:border-border hover:bg-muted/30",
    dot:   "bg-muted-foreground",
}

interface SelectionDialogProps {
    open: boolean
    pair: string
    current: string
    title: string
    groups: Record<string, string[]>
    onSelect: (value: string) => void
    onClose: () => void
}

function SelectionDialog({ open, pair, current, title, groups, onSelect, onClose }: SelectionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        {title}
                        <span className="ml-2 font-mono text-sm text-muted-foreground">{pair}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-1">
                    {Object.entries(groups).map(([groupName, items]) => (
                        <div key={groupName}>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                                {groupName}
                            </p>
                            <div className="grid gap-2">
                                {items.map((item) => {
                                    const style = ENTITY_STYLES[item] ?? DEFAULT_STYLE
                                    const isCurrent = item === current
                                    return (
                                        <button
                                            key={item}
                                            onClick={() => onSelect(item)}
                                            disabled={isCurrent}
                                            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all ${style.card} ${isCurrent ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} />
                                                <span className="font-semibold text-sm">{item}</span>
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

interface AddPairModalProps {
    open: boolean
    onClose: () => void
}

function AddPairModal({ open, onClose }: AddPairModalProps) {
    const { addPair, enabledMarkets } = useSettingsStore()

    const [newPair, setNewPair] = useState("")
    const [newMarket, setNewMarket] = useState<string>(() => enabledMarkets[0] ?? 'Crypto')
    const [newExchange, setNewExchange] = useState<string>(() => MARKET_DEFAULT_EXCHANGE[enabledMarkets[0] ?? 'Crypto'] ?? 'Binance')
    const [newDataProvider, setNewDataProvider] = useState<string>(() => defaultDataProvider(MARKET_DEFAULT_EXCHANGE[enabledMarkets[0] ?? 'Crypto'] ?? 'Binance'))
    const [addError, setAddError] = useState<string | null>(null)
    const [isValidating, setIsValidating] = useState(false)

    const availableExchanges = MARKET_EXCHANGES[newMarket] ?? []
    const availableDataProviders = MARKET_DATA_PROVIDERS[newMarket] ?? []
    const inferredCurrency = inferCurrency(newPair.trim().toUpperCase(), newExchange)

    const handleClose = () => {
        const defMarket = enabledMarkets[0] ?? 'Crypto'
        const defExch = MARKET_DEFAULT_EXCHANGE[defMarket] ?? 'Binance'
        setNewPair("")
        setNewMarket(defMarket)
        setNewExchange(defExch)
        setNewDataProvider(defaultDataProvider(defExch))
        setAddError(null)
        onClose()
    }

    const handleMarketChange = (market: string) => {
        setNewMarket(market)
        const defExch = MARKET_DEFAULT_EXCHANGE[market] ?? (MARKET_EXCHANGES[market]?.[0] ?? 'Binance')
        setNewExchange(defExch)
        setNewDataProvider(defaultDataProvider(defExch))
        setAddError(null)
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const pair = newPair.trim().toUpperCase()
        if (!pair) return

        setIsValidating(true)
        setAddError(null)

        const price = await fetchPriceFromProvider(pair, newDataProvider, newExchange)
        if (price === null) {
            setAddError(`"${pair}" not found on ${newDataProvider}. Check the symbol and try again.`)
            setIsValidating(false)
            return
        }

        addPair(pair, newExchange, newDataProvider)
        setIsValidating(false)
        handleClose()
    }

    const placeholder =
        newExchange === 'SSE'  ? 'e.g. 601818' :
        newExchange === 'SZSE' ? 'e.g. 000001' :
        newMarket === 'US Stocks' ? 'e.g. AAPL' :
        'e.g. BTC/USDT'

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Add Trading Pair</DialogTitle>
                    <DialogDescription>
                        Select a market and exchange, enter a symbol. The pair will be validated before saving.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAdd} className="space-y-4 pt-1">
                    {/* Market selector — only show enabled markets */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Market</label>
                        <div className="flex gap-2">
                            {SUPPORTED_MARKETS.filter(m => enabledMarkets.includes(m)).map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => handleMarketChange(m)}
                                    disabled={isValidating}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        newMarket === m
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Exchange + Data source row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Exchange
                            </label>
                            <Select
                                value={newExchange}
                                onValueChange={(val) => {
                                    setNewExchange(val)
                                    setNewDataProvider(defaultDataProvider(val))
                                    setAddError(null)
                                }}
                                disabled={isValidating}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Exchange" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableExchanges.map(ex => (
                                        <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Data Source
                            </label>
                            <Select
                                value={newDataProvider}
                                onValueChange={(val) => { setNewDataProvider(val); setAddError(null) }}
                                disabled={isValidating}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Data provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDataProviders.map(dp => (
                                        <SelectItem key={dp} value={dp}>{dp}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Symbol input */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Symbol</label>
                        <Input
                            placeholder={placeholder}
                            value={newPair}
                            onChange={(e) => { setNewPair(e.target.value); setAddError(null) }}
                            className="font-mono uppercase"
                            disabled={isValidating}
                        />
                    </div>

                    {/* Inferred currency */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border/50">
                        <span className="text-sm text-muted-foreground">Quote Currency</span>
                        <span className="ml-auto font-mono font-semibold text-sm">{inferredCurrency}</span>
                    </div>

                    {addError && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                            {addError}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={isValidating}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1 gap-2" disabled={isValidating || !newPair.trim()}>
                            {isValidating
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
                                : <><Plus className="h-4 w-4" /> Add</>
                            }
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

const MARKET_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    'Crypto':    { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
    'US Stocks': { bg: 'bg-emerald-500/10',  text: 'text-emerald-600 dark:text-emerald-400',   border: 'border-emerald-500/20',  dot: 'bg-emerald-500' },
    'CN Stocks': { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400',       border: 'border-rose-500/20',    dot: 'bg-rose-500' },
}

export default function TradingPairs() {
    const { setMobileHeader } = useMobileHeader()
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [activeMarket, setActiveMarket] = useState<string | null>(null)

    useEffect(() => {
        setMobileHeader({
            title: "Trading Pairs",
            leftAction: (
                <Link to="/settings">
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
            ),
            rightActions: (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setAddModalOpen(true)}>
                    <Plus className="h-4 w-4" />
                </Button>
            ),
        })
    }, [setMobileHeader])

    const {
        pairConfigs, enabledMarkets, pinnedPairs, prices,
        removePair, updatePairExchange, updatePairDataProvider, toggleMarket, togglePinPair, fetchPrices,
    } = useSettingsStore()

    const filteredConfigs = activeMarket
        ? pairConfigs.filter(c => c.market === activeMarket)
        : pairConfigs

    const marketCounts = SUPPORTED_MARKETS.reduce<Record<string, number>>((acc, m) => {
        acc[m] = pairConfigs.filter(c => c.market === m).length
        return acc
    }, {})

    const [syncingPairs, setSyncingPairs] = useState<Record<string, boolean>>({})
    const [isSyncingAll, setIsSyncingAll] = useState(false)

    const [validatingExchange, setValidatingExchange] = useState<Record<string, boolean>>({})
    const [exchangeErrors, setExchangeErrors] = useState<Record<string, string>>({})
    const [validatingProvider, setValidatingProvider] = useState<Record<string, boolean>>({})
    const [providerErrors, setProviderErrors] = useState<Record<string, string>>({})
    const [dialogPair, setDialogPair] = useState<string | null>(null)
    const [dialogProviderPair, setDialogProviderPair] = useState<string | null>(null)

    useEffect(() => {
        fetchPrices()
        const interval = setInterval(fetchPrices, 300000)
        return () => clearInterval(interval)
    }, [fetchPrices])

    const handleProviderSelect = async (pair: string, provider: string) => {
        setDialogProviderPair(null)
        setValidatingProvider(prev => ({ ...prev, [pair]: true }))
        setProviderErrors(prev => { const next = { ...prev }; delete next[pair]; return next })

        const config = pairConfigs.find(p => p.pair === pair)
        const price = await fetchPriceFromProvider(pair, provider, config?.exchange)
        if (price === null) {
            setProviderErrors(prev => ({
                ...prev,
                [pair]: `"${pair}" not found on ${provider}`,
            }))
        } else {
            updatePairDataProvider(pair, provider)
        }

        setValidatingProvider(prev => ({ ...prev, [pair]: false }))
    }

    const handleExchangeSelect = async (pair: string, newExch: string) => {
        setDialogPair(null)
        setValidatingExchange(prev => ({ ...prev, [pair]: true }))
        setExchangeErrors(prev => { const next = { ...prev }; delete next[pair]; return next })

        const config = pairConfigs.find(p => p.pair === pair)
        const oldDefault = defaultDataProvider(config?.exchange ?? '')
        const newDefault = defaultDataProvider(newExch)
        const shouldSyncProvider = config?.dataProvider === oldDefault

        const priceProvider = shouldSyncProvider ? newDefault : (config?.dataProvider ?? newDefault)
        const price = await fetchPriceFromProvider(pair, priceProvider, newExch)
        if (price === null) {
            setExchangeErrors(prev => ({
                ...prev,
                [pair]: `"${pair}" not found on ${newExch}`,
            }))
        } else {
            updatePairExchange(pair, newExch)
            if (shouldSyncProvider && config?.dataProvider !== newDefault) {
                updatePairDataProvider(pair, newDefault)
            }
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
    const dialogProviderConfig = dialogProviderPair ? pairConfigs.find(p => p.pair === dialogProviderPair) : null

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3">
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
                <Button onClick={() => setAddModalOpen(true)} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" />
                    Add Pair
                </Button>
            </div>

            {/* Market management */}
            <div className="bg-card rounded-xl border shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <h2 className="text-sm font-semibold text-muted-foreground">Markets</h2>
                    {activeMarket && (
                        <button
                            onClick={() => setActiveMarket(null)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Show All
                        </button>
                    )}
                </div>
                <div className="divide-y divide-border/40">
                    {SUPPORTED_MARKETS.map(m => {
                        const style = MARKET_STYLES[m] ?? { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/50', dot: 'bg-muted-foreground' }
                        const isActive = activeMarket === m
                        const isEnabled = enabledMarkets.includes(m)
                        const count = marketCounts[m] ?? 0
                        return (
                            <div
                                key={m}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                    isEnabled ? 'hover:bg-muted/20' : 'opacity-50'
                                } ${isActive ? 'bg-muted/30' : ''}`}
                            >
                                {/* Color dot + market info — clickable to filter */}
                                <button
                                    onClick={() => isEnabled && setActiveMarket(isActive ? null : m)}
                                    disabled={!isEnabled}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                >
                                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${isEnabled ? style.dot : 'bg-muted-foreground/20'}`} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold">{m}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {count} {count === 1 ? 'pair' : 'pairs'}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                                            Filtered
                                        </span>
                                    )}
                                </button>
                                {/* Toggle switch */}
                                <button
                                    role="switch"
                                    aria-checked={isEnabled}
                                    onClick={() => toggleMarket(m)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                        isEnabled ? 'bg-primary' : 'bg-input'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
                                            isEnabled ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Pairs list */}
            <div className="bg-card rounded-xl border shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <span className="text-sm font-semibold text-muted-foreground">
                        {filteredConfigs.length} {filteredConfigs.length === 1 ? 'Pair' : 'Pairs'}
                        {activeMarket && <span className="ml-1">in {activeMarket}</span>}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncAll}
                            disabled={isSyncingAll}
                            className="gap-1.5 h-8 text-xs"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                            Sync All
                        </Button>
                                            </div>
                </div>

                {filteredConfigs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Activity className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">No trading pairs yet</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                            Add a trading pair to start tracking real-time prices across exchanges.
                        </p>
                        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setAddModalOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add Your First Pair
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {filteredConfigs.map(({ pair, market, exchange, dataProvider, currency }) => {
                            const priceData = prices[pair]
                            const priceDisplay = priceData
                                ? `${getCurrencySymbol(currency)}${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : '—'
                            const lastSync = priceData
                                ? format(new Date(priceData.timestamp), "HH:mm:ss")
                                : null
                            const isPinned = pinnedPairs.includes(pair)
                            const exStyle = ENTITY_STYLES[exchange] ?? DEFAULT_STYLE
                            const dpStyle = ENTITY_STYLES[dataProvider] ?? DEFAULT_STYLE
                            const isValidatingExch = !!validatingExchange[pair]
                            const isValidatingProv = !!validatingProvider[pair]
                            const rowError = exchangeErrors[pair]
                            const provError = providerErrors[pair]
                            const providerIsDefault = dataProvider === defaultDataProvider(exchange)

                            return (
                                <SwipeActions
                                    key={pair}
                                    className=""
                                    actions={[
                                        {
                                            icon: <Trash2 className="h-4 w-4" />,
                                            bg: 'bg-rose-500',
                                            onAction: () => removePair(pair),
                                        },
                                    ]}
                                >
                                    <div className="px-4 py-3.5 group hover:bg-muted/20 transition-colors">
                                        <div className="flex items-start gap-3">
                                            {/* Main content */}
                                            <div className="flex-1 min-w-0 space-y-2">
                                                {/* Top row: pair name + price */}
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="font-mono font-bold text-base leading-none">{pair}</span>
                                                    <span className="font-mono text-sm font-semibold tabular-nums shrink-0">
                                                        {priceDisplay}
                                                    </span>
                                                </div>

                                                {/* Meta row: market, exchange, data source, currency */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {(() => {
                                                        const mStyle = MARKET_STYLES[market] ?? { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/50', dot: 'bg-muted-foreground' }
                                                        return (
                                                            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${mStyle.bg} ${mStyle.text} ${mStyle.border}`}>
                                                                {market}
                                                            </span>
                                                        )
                                                    })()}

                                                    <span className="text-[10px] text-border">&middot;</span>

                                                    {isValidatingExch ? (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${exStyle.badge}`}>
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                            {exchange}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDialogPair(pair)}
                                                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${exStyle.badge}`}
                                                            title="Change exchange"
                                                        >
                                                            {exchange}
                                                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                                        </button>
                                                    )}

                                                    <span className="text-[10px] text-border">·</span>

                                                    {isValidatingProv ? (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${dpStyle.badge} opacity-60`}>
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                            {dataProvider}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDialogProviderPair(pair)}
                                                            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${dpStyle.badge} ${providerIsDefault ? 'opacity-50' : 'font-semibold'}`}
                                                            title="Change data source"
                                                        >
                                                            {dataProvider}
                                                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                                        </button>
                                                    )}

                                                    <span className="text-[10px] text-border">·</span>

                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border bg-muted/40 text-muted-foreground border-border/50">
                                                        {currency}
                                                    </span>
                                                </div>

                                                {/* Sync time */}
                                                {lastSync && (
                                                    <p className="text-[10px] text-muted-foreground/50">
                                                        synced {lastSync}
                                                    </p>
                                                )}

                                                {/* Errors */}
                                                {rowError && (
                                                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                                                        {rowError}
                                                    </p>
                                                )}
                                                {provError && (
                                                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                                                        {provError}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions: pin + sync always visible; delete desktop-only */}
                                            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => togglePinPair(pair)}
                                                    className={`h-7 w-7 transition-colors ${isPinned ? 'text-primary opacity-100' : 'text-muted-foreground hover:text-primary'}`}
                                                    title={isPinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
                                                >
                                                    <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={syncingPairs[pair]}
                                                    onClick={() => handleManualSync(pair)}
                                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                    title="Sync price"
                                                >
                                                    <RefreshCw className={`h-3 w-3 ${syncingPairs[pair] ? 'animate-spin' : ''}`} />
                                                </Button>
                                                {/* Delete: desktop hover-only, mobile uses swipe */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removePair(pair)}
                                                    className="hidden md:flex h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                                    title="Remove pair"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </SwipeActions>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Add pair modal */}
            <AddPairModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

            {/* Trading exchange dialog — scoped to the pair's market */}
            {dialogConfig && (
                <SelectionDialog
                    open={dialogPair !== null}
                    pair={dialogConfig.pair}
                    current={dialogConfig.exchange}
                    title="Change Exchange"
                    groups={{ [dialogConfig.market]: MARKET_EXCHANGES[dialogConfig.market] ?? [] }}
                    onSelect={(ex) => handleExchangeSelect(dialogConfig.pair, ex)}
                    onClose={() => setDialogPair(null)}
                />
            )}

            {/* Data provider dialog — scoped to the pair's market */}
            {dialogProviderConfig && (() => {
                const marketProviders = MARKET_DATA_PROVIDERS[dialogProviderConfig.market]
                const groups = marketProviders
                    ? { [dialogProviderConfig.market]: marketProviders }
                    : DATA_PROVIDER_GROUPS
                return (
                    <SelectionDialog
                        open={dialogProviderPair !== null}
                        pair={dialogProviderConfig.pair}
                        current={dialogProviderConfig.dataProvider}
                        title="Change Data Source"
                        groups={groups}
                        onSelect={(dp) => handleProviderSelect(dialogProviderConfig.pair, dp)}
                        onClose={() => setDialogProviderPair(null)}
                    />
                )
            })()}
        </div>
    )
}
