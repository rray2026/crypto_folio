import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { ArrowUpRight } from "lucide-react"

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
                            Overview of your crypto portfolio performance.
                        </p>
                    </div>
                </div>

                {(pinnedPairs?.length ?? 0) > 0 && (
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
                )}
            </div>
        </PullToRefresh>
    )
}
