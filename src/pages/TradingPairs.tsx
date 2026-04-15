import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import {
    useSettingsStore,
    SUPPORTED_MARKETS, MARKET_EXCHANGES, MARKET_DEFAULT_EXCHANGE, MARKET_DATA_PROVIDERS,
    DATA_PROVIDER_GROUPS, cryptoProvidersForExchange,
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

const MUTED_BADGE = "bg-muted/40 text-muted-foreground border-border/50"

interface SourceDialogProps {
    open: boolean
    pair: string
    market: string
    currentExchange: string
    currentProvider: string
    onSelectExchange: (value: string) => void
    onSelectProvider: (value: string) => void
    onClose: () => void
}

function SourceDialog({ open, pair, market, currentExchange, currentProvider, onSelectExchange, onSelectProvider, onClose }: SourceDialogProps) {
    const exchanges = MARKET_EXCHANGES[market] ?? []
    const providers = market === 'Crypto'
        ? cryptoProvidersForExchange(currentExchange)
        : (MARKET_DATA_PROVIDERS[market] ?? Object.values(DATA_PROVIDER_GROUPS).flat())

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        Data Source
                        <span className="ml-2 font-mono text-sm text-muted-foreground">{pair}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-1">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                            Data Provider
                        </p>
                        <div className="grid gap-2">
                            {providers.map((item) => {
                                const isCurrent = item === currentProvider
                                return (
                                    <button
                                        key={item}
                                        onClick={() => onSelectProvider(item)}
                                        disabled={isCurrent}
                                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all ${
                                            isCurrent
                                                ? 'border-primary/30 bg-primary/5 cursor-default'
                                                : 'border-border/50 hover:border-border hover:bg-muted/30 cursor-pointer'
                                        }`}
                                    >
                                        <span className={`font-semibold text-sm ${isCurrent ? 'text-primary' : ''}`}>{item}</span>
                                        {isCurrent && <Check className="h-4 w-4 text-primary" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                            Exchange
                        </p>
                        <div className="grid gap-2">
                            {exchanges.map((item) => {
                                const isCurrent = item === currentExchange
                                return (
                                    <button
                                        key={item}
                                        onClick={() => onSelectExchange(item)}
                                        disabled={isCurrent}
                                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-left transition-all ${
                                            isCurrent
                                                ? 'border-primary/30 bg-primary/5 cursor-default'
                                                : 'border-border/50 hover:border-border hover:bg-muted/30 cursor-pointer'
                                        }`}
                                    >
                                        <span className={`font-semibold text-sm ${isCurrent ? 'text-primary' : ''}`}>{item}</span>
                                        {isCurrent && <Check className="h-4 w-4 text-primary" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
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
    const availableDataProviders = newMarket === 'Crypto'
        ? cryptoProvidersForExchange(newExchange)
        : (MARKET_DATA_PROVIDERS[newMarket] ?? [])
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
        newMarket === 'CN Stocks' ? (newExchange === 'SZSE' ? 'e.g. 000001' : 'e.g. 601818') :
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

                    {/* Data source + Exchange row */}
                    <div className="grid grid-cols-2 gap-3">
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

const MARKET_STYLE = { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' }

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

    const [validatingSource, setValidatingSource] = useState<Record<string, boolean>>({})
    const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({})
    const [dialogPair, setDialogPair] = useState<string | null>(null)

    useEffect(() => {
        fetchPrices()
        const interval = setInterval(fetchPrices, 300000)
        return () => clearInterval(interval)
    }, [fetchPrices])

    const handleProviderSelect = async (pair: string, provider: string) => {
        setValidatingSource(prev => ({ ...prev, [pair]: true }))
        setSourceErrors(prev => { const next = { ...prev }; delete next[pair]; return next })

        const config = pairConfigs.find(p => p.pair === pair)
        const price = await fetchPriceFromProvider(pair, provider, config?.exchange)
        if (price === null) {
            setSourceErrors(prev => ({
                ...prev,
                [pair]: `"${pair}" not found on ${provider}`,
            }))
        } else {
            updatePairDataProvider(pair, provider)
        }

        setValidatingSource(prev => ({ ...prev, [pair]: false }))
    }

    const handleExchangeSelect = async (pair: string, newExch: string) => {
        setValidatingSource(prev => ({ ...prev, [pair]: true }))
        setSourceErrors(prev => { const next = { ...prev }; delete next[pair]; return next })

        const config = pairConfigs.find(p => p.pair === pair)
        const newDefault = defaultDataProvider(newExch)
        const allowedProviders = config?.market === 'Crypto' ? cryptoProvidersForExchange(newExch) : null
        const needsProviderSwitch = allowedProviders && !allowedProviders.includes(config?.dataProvider ?? '')
        const priceProvider = needsProviderSwitch ? newDefault : (config?.dataProvider ?? newDefault)

        const price = await fetchPriceFromProvider(pair, priceProvider, newExch)
        if (price === null) {
            setSourceErrors(prev => ({
                ...prev,
                [pair]: `"${pair}" not found on ${newExch}`,
            }))
        } else {
            updatePairExchange(pair, newExch)
            if (priceProvider !== config?.dataProvider) {
                updatePairDataProvider(pair, priceProvider)
            }
        }

        setValidatingSource(prev => ({ ...prev, [pair]: false }))
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
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto flex flex-col gap-6">
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
            <div className="bg-card rounded-2xl border border-border/20 shadow-ambient impressionist-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/15">
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
                                {/* Market info — clickable to filter */}
                                <button
                                    onClick={() => isEnabled && setActiveMarket(isActive ? null : m)}
                                    disabled={!isEnabled}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold">{m}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {count} {count === 1 ? 'pair' : 'pairs'}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${MARKET_STYLE.bg} ${MARKET_STYLE.text}`}>
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
            <div className="bg-card rounded-2xl border border-border/20 shadow-ambient impressionist-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/15">
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
                    <div className="flex flex-col items-center justify-center py-8 md:py-12 px-6 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4 shadow-glow shimmer-accent">
                            <Activity className="h-7 w-7 text-primary/70 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">No trading pairs yet</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                            Add a trading pair to start tracking real-time prices across exchanges.
                        </p>
                        <button
                            onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/5 hover:shadow-ambient transition-all duration-300 ease-out group text-left w-full max-w-sm"
                        >
                            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                                <Plus className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Add Your First Pair</p>
                                <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Choose a market, data source, and symbol to start tracking prices.</p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {filteredConfigs.map(({ pair, market, dataProvider, currency }) => {
                            const priceData = prices[pair]
                            const priceDisplay = priceData
                                ? `${getCurrencySymbol(currency)}${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : '—'
                            const lastSync = priceData
                                ? format(new Date(priceData.timestamp), "HH:mm:ss")
                                : null
                            const isPinned = pinnedPairs.includes(pair)
                            const isValidating = !!validatingSource[pair]
                            const sourceError = sourceErrors[pair]

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

                                                {/* Meta row: market, source, currency */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${MUTED_BADGE}`}>
                                                        {market}
                                                    </span>

                                                    <span className="text-[10px] text-border">&middot;</span>

                                                    {isValidating ? (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${MUTED_BADGE}`}>
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                            {dataProvider}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDialogPair(pair)}
                                                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${MUTED_BADGE}`}
                                                            title="Change data source"
                                                        >
                                                            {dataProvider}
                                                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                                        </button>
                                                    )}

                                                    <span className="text-[10px] text-border">&middot;</span>

                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${MUTED_BADGE}`}>
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
                                                {sourceError && (
                                                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                                                        {sourceError}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions: pin + sync always visible; delete desktop-only */}
                                            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                                                <button
                                                    onClick={() => togglePinPair(pair)}
                                                    className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${isPinned ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                                                    title={isPinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
                                                >
                                                    <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                                                </button>
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

            {/* Source dialog — exchange + data provider in one */}
            {dialogConfig && (
                <SourceDialog
                    open={dialogPair !== null}
                    pair={dialogConfig.pair}
                    market={dialogConfig.market}
                    currentExchange={dialogConfig.exchange}
                    currentProvider={dialogConfig.dataProvider}
                    onSelectExchange={(ex) => handleExchangeSelect(dialogConfig.pair, ex)}
                    onSelectProvider={(dp) => handleProviderSelect(dialogConfig.pair, dp)}
                    onClose={() => setDialogPair(null)}
                />
            )}
        </div>
    )
}
