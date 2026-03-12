import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
    predefinedPairs: string[];
    prices: Record<string, { price: string; timestamp: number }>;
    dashboardTimeRange: DashboardTimeRange;
    theme: Theme;
    pinnedPairs: string[];
    setDashboardTimeRange: (range: DashboardTimeRange) => void;
    setTheme: (theme: Theme) => void;
    addPair: (pair: string) => void;
    removePair: (pair: string) => void;
    togglePinPair: (pair: string) => void;
    fetchPrices: (symbols?: string[], force?: boolean, exactSymbolsOnly?: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            predefinedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'], // Defaults
            prices: {},
            dashboardTimeRange: '1Y',
            theme: 'system',
            pinnedPairs: ['BTC/USDT'],
            setDashboardTimeRange: (range) => set({ dashboardTimeRange: range }),
            setTheme: (theme) => set({ theme }),
            addPair: (pair) => set((state) => ({
                predefinedPairs: state.predefinedPairs.includes(pair.toUpperCase())
                    ? state.predefinedPairs
                    : [...state.predefinedPairs, pair.toUpperCase()]
            })),
            removePair: (pair) => set((state) => ({
                predefinedPairs: state.predefinedPairs.filter(p => p !== pair.toUpperCase()),
                pinnedPairs: state.pinnedPairs.filter(p => p !== pair.toUpperCase())
            })),
            togglePinPair: (pair) => set((state) => ({
                pinnedPairs: state.pinnedPairs.includes(pair.toUpperCase()) 
                    ? state.pinnedPairs.filter(p => p !== pair.toUpperCase())
                    : [...state.pinnedPairs, pair.toUpperCase()]
            })),
            fetchPrices: async (symbols?: string[], force: boolean = false, exactSymbolsOnly: boolean = false) => {
                const { predefinedPairs, prices } = get();
                const now = Date.now();
                const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

                const newPrices = { ...prices };
                let hasUpdates = false;

                // Merge requested symbols with predefined pairs to ensure we have pricing for all
                // IF exactSymbolsOnly is true, only fetch the requested symbols.
                const symbolsToFetch = exactSymbolsOnly && symbols
                    ? Array.from(new Set(symbols))
                    : Array.from(new Set([...predefinedPairs, ...(symbols || [])]));

                for (const pair of symbolsToFetch) {
                    const cached = prices[pair];
                    if (!force && cached && (now - cached.timestamp < CACHE_TTL)) {
                        continue; // Skip if cache is valid and not forced
                    }

                    try {
                        // Convert BTC/USDT -> BTCUSDT for Binance API
                        const symbol = pair.replace(/[^A-Z0-9]/g, '');
                        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
                        if (res.ok) {
                            const data = await res.json();
                            newPrices[pair] = {
                                price: data.price,
                                timestamp: now,
                            };
                            hasUpdates = true;
                        }
                    } catch (err) {
                        console.error(`Failed to fetch price for ${pair}`, err);
                    }
                }

                if (hasUpdates) {
                    set({ prices: newPrices });
                }
            }
        }),
        {
            name: 'crypto-folio-settings',
        }
    )
);
