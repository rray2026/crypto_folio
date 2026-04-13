import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MIGRATIONS } from '../lib/migrations';
import { DEFAULT_THEME_COLOR } from '@/lib/themeColors';
import type { ThemeColor } from '@/lib/themeColors';

// Migrate old localStorage key from CryptoFolio era
const OLD_SETTINGS_KEY = 'crypto-folio-settings';
const NEW_SETTINGS_KEY = 'folio-settings';
if (typeof window !== 'undefined' && !localStorage.getItem(NEW_SETTINGS_KEY) && localStorage.getItem(OLD_SETTINGS_KEY)) {
    localStorage.setItem(NEW_SETTINGS_KEY, localStorage.getItem(OLD_SETTINGS_KEY)!);
    localStorage.removeItem(OLD_SETTINGS_KEY);
}

export type DashboardTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type Theme = 'dark' | 'light' | 'system';
export type { ThemeColor } from '@/lib/themeColors';

export interface PairConfig {
    pair: string;
    market: string;       // e.g. 'Crypto', 'US Stocks', 'CN Stocks'
    exchange: string;     // where the user trades
    dataProvider: string; // which data provider to use for price fetching
    currency: string;     // e.g. 'USD', 'CNY', 'ETH'
}

export const SUPPORTED_MARKETS = ['Crypto', 'US Stocks', 'CN Stocks'] as const;
export type Market = typeof SUPPORTED_MARKETS[number];

/** Exchanges available in each market. */
export const MARKET_EXCHANGES: Record<string, string[]> = {
    'Crypto':    ['Binance', 'OKX', 'Bybit', 'HTX', 'Gate.io', 'MEXC'],
    'US Stocks': ['NYSE', 'NASDAQ'],
    'CN Stocks': ['SSE', 'SZSE'],
};

/** Default exchange for each market. */
export const MARKET_DEFAULT_EXCHANGE: Record<string, string> = {
    'Crypto': 'Binance',
    'US Stocks': 'NYSE',
    'CN Stocks': 'SSE',
};

export const SUPPORTED_EXCHANGES = ['Binance', 'OKX', 'Bybit', 'NYSE', 'NASDAQ', 'HTX', 'Gate.io', 'MEXC', 'SSE', 'SZSE'] as const;
export type Exchange = typeof SUPPORTED_EXCHANGES[number];


/** Infer the market for an exchange. */
export function inferMarket(exchange: string): string {
    for (const [market, exchanges] of Object.entries(MARKET_EXCHANGES)) {
        if (exchanges.includes(exchange)) return market;
    }
    return 'Crypto';
}

// Data providers — distinct from exchanges; stock exchanges all route through Yahoo Finance
export const DATA_PROVIDERS = ['Binance', 'OKX', 'Bybit', 'HTX', 'Gate.io', 'MEXC', 'Yahoo Finance'] as const;
export type DataProvider = typeof DATA_PROVIDERS[number];

export const DATA_PROVIDER_GROUPS: Record<string, string[]> = {
    'Crypto':      ['Binance', 'OKX', 'Bybit', 'HTX', 'Gate.io', 'MEXC'],
    'Stock Data':  ['Yahoo Finance'],
};

/** Data providers available for each market. Crypto exchanges cannot fetch stock data and vice versa. */
export const MARKET_DATA_PROVIDERS: Record<string, string[]> = {
    'Crypto':    ['Binance', 'OKX', 'Bybit', 'HTX', 'Gate.io', 'MEXC'],
    'US Stocks': ['Yahoo Finance'],
    'CN Stocks': ['Yahoo Finance'],
};

/** Stock exchanges that route through Yahoo Finance for price data. */
const YAHOO_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'SSE', 'SZSE']);

/**
 * Returns the default data provider for a given trading exchange.
 * Stock exchanges map to Yahoo Finance; crypto exchanges provide their own API.
 */
export function defaultDataProvider(exchange: string): string {
    return YAHOO_EXCHANGES.has(exchange) ? 'Yahoo Finance' : exchange;
}

// Stablecoin quote currencies that are pegged to USD
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD']);

/** Derive the quote currency for a pair on a given exchange. */
export function inferCurrency(pair: string, exchange: string): string {
    if (exchange === 'SSE' || exchange === 'SZSE') return 'CNY';
    if (pair.includes('/')) {
        const quote = pair.split('/')[1];
        if (STABLECOINS.has(quote)) return 'USD';
        return quote; // e.g. BTC/ETH → priced in ETH
    }
    return 'USD'; // stocks and bare symbols default to USD
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    CNY: '¥',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
};

/** Map a currency code (e.g. 'CNY') to its display symbol (e.g. '¥'). */
export function getCurrencySymbol(currency: string): string {
    return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Look up the currency symbol for a pair from the stored pairConfigs. */
export function getCurrencySymbolForPair(pair: string, pairConfigs: PairConfig[]): string {
    const config = pairConfigs.find(p => p.pair === pair);
    return getCurrencySymbol(config?.currency ?? 'USD');
}

/**
 * Fetch the current price for a pair from a given data provider.
 * For Yahoo Finance, pass exchangeHint to determine the correct ticker suffix
 * (e.g. SSE → .SS, SZSE → .SZ).
 */
export async function fetchPriceFromProvider(pair: string, provider: string, exchangeHint?: string): Promise<string | null> {
    try {
        if (provider === 'OKX') {
            const instId = pair.replace('/', '-');
            const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`);
            if (res.ok) {
                const data = await res.json();
                return data?.data?.[0]?.last ?? null;
            }
        } else if (provider === 'Bybit') {
            const symbol = pair.replace(/[^A-Z0-9]/g, '');
            const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                return data?.result?.list?.[0]?.lastPrice ?? null;
            }
        } else if (provider === 'HTX') {
            const symbol = pair.replace('/', '').toLowerCase();
            const res = await fetch(`https://api.huobi.pro/market/detail/merged?symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                return data?.tick?.close != null ? String(data.tick.close) : null;
            }
        } else if (provider === 'Gate.io') {
            const currencyPair = pair.replace('/', '_');
            const res = await fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${currencyPair}`);
            if (res.ok) {
                const data = await res.json();
                return data?.[0]?.last ?? null;
            }
        } else if (provider === 'MEXC') {
            const symbol = pair.replace(/[^A-Z0-9]/g, '');
            const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                return data?.price ?? null;
            }
        } else if (provider === 'Yahoo Finance') {
            // Append exchange-specific suffix for CN stocks; US stocks use the symbol as-is
            const suffix = exchangeHint === 'SSE' ? '.SS' : exchangeHint === 'SZSE' ? '.SZ' : '';
            const symbol = pair.includes('.') ? pair : `${pair}${suffix}`;
            const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`);
            if (res.ok) {
                const data = await res.json();
                return data?.price ?? null;
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
        console.error(`Failed to fetch price for ${pair} from ${provider}`, err);
    }
    return null;
}

interface SettingsState {
    predefinedPairs: string[];
    pairConfigs: PairConfig[];
    enabledMarkets: string[];
    prices: Record<string, { price: string; timestamp: number }>;
    dashboardTimeRange: DashboardTimeRange;
    theme: Theme;
    themeColor: ThemeColor;
    pinnedPairs: string[];
    setDashboardTimeRange: (range: DashboardTimeRange) => void;
    setTheme: (theme: Theme) => void;
    setThemeColor: (color: ThemeColor) => void;
    addPair: (pair: string, exchange?: string, dataProvider?: string) => void;
    removePair: (pair: string) => void;
    updatePairExchange: (pair: string, exchange: string) => void;
    updatePairDataProvider: (pair: string, dataProvider: string) => void;
    toggleMarket: (market: string) => void;
    togglePinPair: (pair: string) => void;
    fetchPrices: (symbols?: string[], force?: boolean, exactSymbolsOnly?: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            predefinedPairs: [],
            pairConfigs: [],
            enabledMarkets: ['Crypto', 'US Stocks', 'CN Stocks'],
            prices: {},
            dashboardTimeRange: '1Y',
            theme: 'system',
            themeColor: DEFAULT_THEME_COLOR,
            pinnedPairs: [],
            setDashboardTimeRange: (range) => set({ dashboardTimeRange: range }),
            setTheme: (theme) => set({ theme }),
            setThemeColor: (color) => set({ themeColor: color }),
            addPair: (pair, exchange = 'Binance', dataProvider) => set((state) => {
                const upper = pair.toUpperCase();
                if (state.predefinedPairs.includes(upper)) return state;
                const currency = inferCurrency(upper, exchange);
                const dp = dataProvider ?? defaultDataProvider(exchange);
                const market = inferMarket(exchange);
                return {
                    predefinedPairs: [...state.predefinedPairs, upper],
                    pairConfigs: [...state.pairConfigs, { pair: upper, market, exchange, dataProvider: dp, currency }],
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
                    p.pair === pair.toUpperCase()
                        ? { ...p, exchange, market: inferMarket(exchange), currency: inferCurrency(pair.toUpperCase(), exchange) }
                        : p
                ),
            })),
            updatePairDataProvider: (pair, dataProvider) => set((state) => ({
                pairConfigs: state.pairConfigs.map(p =>
                    p.pair === pair.toUpperCase()
                        ? { ...p, dataProvider }
                        : p
                ),
            })),
            toggleMarket: (market) => set((state) => ({
                enabledMarkets: state.enabledMarkets.includes(market)
                    ? state.enabledMarkets.filter(m => m !== market)
                    : [...state.enabledMarkets, market],
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

                const configMap = new Map(pairConfigs.map(p => [p.pair, p]));

                for (const pair of symbolsToFetch) {
                    const cached = prices[pair];
                    if (!force && cached && (now - cached.timestamp < CACHE_TTL)) {
                        continue;
                    }

                    const config = configMap.get(pair);
                    const provider = config?.dataProvider ?? defaultDataProvider(config?.exchange ?? 'Binance');
                    const price = await fetchPriceFromProvider(pair, provider, config?.exchange);
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
            name: 'folio-settings',
            version: 5,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>;
                if (version < 1) {
                    const pairs = (state.predefinedPairs as string[] | undefined) ?? ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
                    state.pairConfigs = pairs.map((p: string) => ({ pair: p, exchange: 'Binance', dataProvider: 'Binance', currency: 'USD' }));
                }
                if (version < 2) {
                    // Backfill currency field for existing pairConfigs
                    const configs = (state.pairConfigs as Array<{ pair: string; exchange: string; currency?: string }> | undefined) ?? [];
                    state.pairConfigs = configs.map(c => ({
                        ...c,
                        currency: c.currency ?? inferCurrency(c.pair, c.exchange),
                    }));
                }
                if (version < 3) {
                    // Backfill dataSource field — temporary, will be renamed in v4
                    const configs = (state.pairConfigs as Array<{ pair: string; exchange: string; dataSource?: string; currency: string }> | undefined) ?? [];
                    state.pairConfigs = configs.map(c => ({
                        ...c,
                        dataSource: (c as Record<string, unknown>).dataSource ?? c.exchange,
                    }));
                }
                if (version < 4) {
                    // Delegate to the unified migration registry
                    Object.assign(state, MIGRATIONS[3].upgradeLocalStorage!(state as Record<string, unknown>));
                }
                if (version < 5) {
                    Object.assign(state, MIGRATIONS[4].upgradeLocalStorage!(state as Record<string, unknown>));
                    // Backfill enabledMarkets for users upgrading — all markets enabled by default
                    if (!state.enabledMarkets) {
                        state.enabledMarkets = ['Crypto', 'US Stocks', 'CN Stocks'];
                    }
                }
                return state;
            },
        }
    )
);
