import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import { useMobileHeader } from "@/hooks/useMobileHeader"

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
                        <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Overview of your crypto portfolio performance.</p>
                    </div>
                </div>

                {(pinnedPairs?.length ?? 0) > 0 && (
                    <div className="flex flex-col gap-3">
                        {pinnedPairs.map(pair => {
                            const priceData = prices[pair];
                            const sym = getCurrencySymbolForPair(pair, pairConfigs);
                            // Show '...' only while the DB is still loading (positions undefined).
                            // Once positions is defined, the fetch effect has been dispatched;
                            // if the price is still missing at that point it's unavailable → '—'.
                            const priceDisplay = priceData
                                ? `${sym}${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                : positions === undefined ? '...' : '—';
                            
                            return (
                                <div
                                    key={pair}
                                    className="flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm hover:border-primary/50 transition-all group cursor-pointer"
                                    onClick={() => navigate(`/assets/${pair.replace('/', '_')}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                        <div>
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">{pair}</span>
                                            {priceData && (
                                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                                    synced {format(new Date(priceData.timestamp), "HH:mm:ss")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold font-mono tracking-tight text-foreground lining-nums">
                                        {priceDisplay}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </PullToRefresh>
    )
}
