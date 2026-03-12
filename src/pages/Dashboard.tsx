import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore } from "@/store/useSettingsStore"
import { useState } from "react"

export default function Dashboard() {
    const positions = useLiveQuery(() => db.positions.toArray())
    const { prices, fetchPrices } = useSettingsStore()

    // Fetch prices for all OPEN symbols and PINNED pairs periodically (every 5 mins)
    useState(() => {
        const interval = setInterval(() => {
            if (!positions) return;
            const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
            const symbolsToFetch = Array.from(new Set([...openSymbols, ...(useSettingsStore.getState().pinnedPairs || [])]));
            if (symbolsToFetch.length > 0) {
                fetchPrices(symbolsToFetch);
            }
        }, 300000);
        return () => clearInterval(interval);
    });

    if (positions) {
        // Non-blocking fetch on render if not cached
        const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
        const pinnedPairs = useSettingsStore.getState().pinnedPairs || [];
        const symbolsToFetch = Array.from(new Set([...openSymbols, ...pinnedPairs]));
        if (symbolsToFetch.length > 0) {
            fetchPrices(symbolsToFetch);
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Overview of your crypto portfolio performance.</p>
                </div>
            </div>

            {useSettingsStore.getState().pinnedPairs?.length > 0 && (
                <div className="w-full relative">
                    <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
                        <div className="flex gap-4 px-1 w-max">
                            {useSettingsStore.getState().pinnedPairs.map(pair => {
                                const priceData = prices[pair];
                                const priceDisplay = priceData ? `$${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '...';
                                
                                return (
                                    <div key={pair} className="flex flex-col min-w-[140px] md:min-w-[160px] p-4 rounded-xl bg-card border shadow-sm hover:border-primary/50 transition-all group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider group-hover:text-primary transition-colors">{pair}</span>
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        </div>
                                        <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                                            {priceDisplay}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
