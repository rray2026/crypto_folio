import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type Theme = 'dark' | 'light' | 'system';

export interface PairConfig {
    pair: string;
    exchange: string;
}

export const SUPPORTED_EXCHANGES = ['Binance', 'OKX', 'Bybit'] as const;
export type Exchange = typeof SUPPORTED_EXCHANGES[number];

async function fetchPriceForExchange(pair: string, exchange: string): Promise<string | null> {
    try {
        if (exchange === 'OKX') {
            const instId = pair.replace('/', '-');
            const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`);
            if (res.ok) {
                const data = await res.json();
                return data?.data?.[0]?.last ?? null;
            }
        } else if (exchange === 'Bybit') {
            const symbol = pair.replace(/[^A-Z0-9]/g, '');
            const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                return data?.result?.list?.[0]?.lastPrice ?? null;
            }
        } else {
            // Binance (default)
            const symbol = pair.replace(/[^A-Z0-9]/g, '');
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                return data?.price ?? null;
            }
        }
    } catch (err) {
        console.error(`Failed to fetch price for ${pair} from ${exchange}`, err);
    }
    return null;
}

interface SettingsState {
    predefinedPairs: string[];
    pairConfigs: PairConfig[];
    prices: Record<string, { price: string; timestamp: number }>;
    dashboardTimeRange: DashboardTimeRange;
    theme: Theme;
    pinnedPairs: string[];
    setDashboardTimeRange: (range: DashboardTimeRange) => void;
    setTheme: (theme: Theme) => void;
    addPair: (pair: string, exchange?: string) => void;
    removePair: (pair: string) => void;
    updatePairExchange: (pair: string, exchange: string) => void;
    togglePinPair: (pair: string) => void;
    fetchPrices: (symbols?: string[], force?: boolean, exactSymbolsOnly?: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            predefinedPairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance' },
                { pair: 'ETH/USDT', exchange: 'Binance' },
                { pair: 'SOL/USDT', exchange: 'Binance' },
            ],
            prices: {},
            dashboardTimeRange: '1Y',
            theme: 'system',
            pinnedPairs: ['BTC/USDT'],
            setDashboardTimeRange: (range) => set({ dashboardTimeRange: range }),
            setTheme: (theme) => set({ theme }),
            addPair: (pair, exchange = 'Binance') => set((state) => {
                const upper = pair.toUpperCase();
                if (state.predefinedPairs.includes(upper)) return state;
                return {
                    predefinedPairs: [...state.predefinedPairs, upper],
                    pairConfigs: [...state.pairConfigs, { pair: upper, exchange }],
                };
            }),
            removePair: (pair) => set((state) => {
                const upper = pair.toUpperCase();
                return {
                    predefinedPairs: state.predefinedPairs.filter(p => p !== upper),
                    pairConfigs: state.pairConfigs.filter(p => p.pair !== upper),
                    pinnedPairs: state.pinnedPairs.filter(p => p !== upper),
                };
            }),
            updatePairExchange: (pair, exchange) => set((state) => ({
                pairConfigs: state.pairConfigs.map(p =>
                    p.pair === pair.toUpperCase() ? { ...p, exchange } : p
                ),
            })),
            togglePinPair: (pair) => set((state) => ({
                pinnedPairs: state.pinnedPairs.includes(pair.toUpperCase())
                    ? state.pinnedPairs.filter(p => p !== pair.toUpperCase())
                    : [...state.pinnedPairs, pair.toUpperCase()]
            })),
            fetchPrices: async (symbols?: string[], force: boolean = false, exactSymbolsOnly: boolean = false) => {
                const { predefinedPairs, pairConfigs, prices } = get();
                const now = Date.now();
                const CACHE_TTL = 5 * 60 * 1000;

                const newPrices = { ...prices };
                let hasUpdates = false;

                const symbolsToFetch = exactSymbolsOnly && symbols
                    ? Array.from(new Set(symbols))
                    : Array.from(new Set([...predefinedPairs, ...(symbols || [])]));

                const exchangeMap = new Map(pairConfigs.map(p => [p.pair, p.exchange]));

                for (const pair of symbolsToFetch) {
                    const cached = prices[pair];
                    if (!force && cached && (now - cached.timestamp < CACHE_TTL)) {
                        continue;
                    }

                    const exchange = exchangeMap.get(pair) ?? 'Binance';
                    const price = await fetchPriceForExchange(pair, exchange);
                    if (price !== null) {
                        newPrices[pair] = { price, timestamp: now };
                        hasUpdates = true;
                    }
                }

                if (hasUpdates) {
                    set({ prices: newPrices });
                }
            }
        }),
        {
            name: 'crypto-folio-settings',
            version: 1,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>;
                if (version < 1) {
                    const pairs = (state.predefinedPairs as string[] | undefined) ?? ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
                    state.pairConfigs = pairs.map((p: string) => ({ pair: p, exchange: 'Binance' }));
                }
                return state;
            },
        }
    )
);
