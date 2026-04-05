import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { ArrowUpRight, TrendingUp, ReceiptText, LineChart, Settings } from "lucide-react"

export default function Dashboard() {
    const navigate = useNavigate()
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => { setMobileHeader({ title: "Dashboard" }) }, [setMobileHeader])
    const positions = useLiveQuery(() => db.positions.toArray())
    const { prices, fetchPrices, pairConfigs, pinnedPairs } = useSettingsStore()

    // Initial price fetch when positions or pinned pairs change
    useEffect(() => {
        if (!positions) return;
        const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
        const symbolsToFetch = Array.from(new Set([...openSymbols, ...(pinnedPairs || [])]));
        if (symbolsToFetch.length > 0) {
            fetchPrices(symbolsToFetch);
        }
    }, [positions, pinnedPairs, fetchPrices]);

    // Periodic refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            if (!positions) return;
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            const symbolsToFetch = Array.from(new Set([...openSymbols, ...(pinnedPairs || [])]));
            if (symbolsToFetch.length > 0) {
                fetchPrices(symbolsToFetch);
            }
        }, 300000);
        return () => clearInterval(interval);
    }, [positions, pinnedPairs, fetchPrices]);

    const handleRefresh = async () => {
        const openSymbols = Array.from(new Set((positions || []).filter(p => p.status === 'OPEN').map(p => p.symbol)));
        const symbolsToFetch = Array.from(new Set([...openSymbols, ...(pinnedPairs || [])]));
        if (symbolsToFetch.length > 0) {
            await fetchPrices(symbolsToFetch, true);
        }
    }

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 min-h-full">
                <div className="hidden md:flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
                            Overview of your portfolio performance.
                        </p>
                    </div>
                </div>

                {(pinnedPairs?.length ?? 0) > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pinnedPairs.map(pair => {
                            const priceData = prices[pair];
                            const sym = getCurrencySymbolForPair(pair, pairConfigs);
                            const priceDisplay = priceData
                                ? `${sym}${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : positions === undefined ? '...' : '—';

                            return (
                                <button
                                    key={pair}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 group cursor-pointer text-left"
                                    onClick={() => navigate(`/assets/${pair.replace('/', '_')}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-primary">
                                                {pair.split('/')[0].slice(0, 3)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground uppercase tracking-wider">{pair}</p>
                                            {priceData && (
                                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                    {format(new Date(priceData.timestamp), "HH:mm:ss")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold font-mono tracking-tight text-foreground lining-nums">
                                            {priceDisplay}
                                        </span>
                                        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                            <TrendingUp className="h-8 w-8 text-primary/60" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Welcome to Folio</h2>
                        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                            A privacy-first portfolio tracker. All your data stays in this browser — nothing is sent to any server.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                            <button
                                onClick={() => navigate('/settings/trading-pairs')}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Settings className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Add Pairs</p>
                                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Pin trading pairs to track prices</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/transactions')}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <ReceiptText className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Record Trades</p>
                                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Log your buy and sell orders</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/positions')}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                            >
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <LineChart className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Create Strategy</p>
                                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Group trades to track P&L</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PullToRefresh>
    )
}
