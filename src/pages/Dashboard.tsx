import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { PullToRefresh } from "@/components/ui/PullToRefresh"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { ArrowUpRight, TrendingUp, ReceiptText, LineChart, Settings, Layers } from "lucide-react"

function freshnessColor(timestamp: number): string {
    const age = Math.floor((Date.now() - timestamp) / 1000);
    if (age < 60) return 'bg-primary';
    if (age < 300) return 'bg-amber-400';
    return 'bg-muted-foreground/30';
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => { setMobileHeader({ title: "Dashboard" }) }, [setMobileHeader])
    const positions = useLiveQuery(() => db.positions.toArray())
    const { prices, fetchPrices, pairConfigs, pinnedPairs } = useSettingsStore()

    // Tick every 5s so relative timestamps stay fresh
    const [, setTick] = useState(0);
    const tick = useCallback(() => setTick(t => t + 1), []);
    useEffect(() => {
        const id = setInterval(tick, 5000);
        return () => clearInterval(id);
    }, [tick]);

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
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-200 group cursor-pointer text-left"
                                    onClick={() => navigate(`/assets/${pair.replace('/', '_')}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-primary">
                                                {pair.split('/')[0].slice(0, 3)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">{pair}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold font-mono tracking-tight text-foreground lining-nums">
                                            {priceDisplay}
                                        </span>
                                        {priceData && (
                                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-1000 ${freshnessColor(priceData.timestamp)}`} />
                                        )}
                                        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <TrendingUp className="h-7 w-7 text-primary/60" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Welcome to Folio</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
                            A privacy-first portfolio tracker. All your data stays in this browser — nothing is sent to any server.
                        </p>

                        <div className="flex flex-col gap-2.5 w-full max-w-sm">
                            <button
                                onClick={() => navigate('/settings/trading-pairs')}
                                className="flex items-center gap-3.5 p-3.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                                    <Settings className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Add Trading Pairs</p>
                                    <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Configure assets and pin them to your dashboard for real-time price tracking.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/transactions')}
                                className="flex items-center gap-3.5 p-3.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                                    <ReceiptText className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Record Trades</p>
                                    <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Log your buy and sell orders — every transaction is the building block of your portfolio.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/positions')}
                                className="flex items-center gap-3.5 p-3.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                                    <LineChart className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Create Positions</p>
                                    <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Group related trades into positions to track combined P&L, ROI, and breakeven price.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/funds')}
                                className="flex items-center gap-3.5 p-3.5 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
                            >
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                                    <Layers className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Create Fund</p>
                                    <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">Set up a fund with initial capital, assign positions, and track NAV over time.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PullToRefresh>
    )
}
