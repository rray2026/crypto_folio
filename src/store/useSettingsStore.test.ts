import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, fetchPriceForExchange, inferCurrency, getCurrencySymbol, getCurrencySymbolForPair } from './useSettingsStore';

// Mock localStorage for Zustand persist
const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

// ---------------------------------------------------------------------------
// fetchPriceForExchange
// ---------------------------------------------------------------------------
describe('fetchPriceForExchange', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('Binance: calls correct URL and parses .price', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: 'BTCUSDT', price: '50000.00' }),
        });
        const price = await fetchPriceForExchange('BTC/USDT', 'Binance');
        expect(price).toBe('50000.00');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
        );
    });

    it('Binance: strips slash from pair symbol', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '2000.00' }),
        });
        await fetchPriceForExchange('ETH/USDT', 'Binance');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'
        );
    });

    it('OKX: calls correct URL with instId format (BTC-USDT)', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ last: '2000.00' }] }),
        });
        const price = await fetchPriceForExchange('ETH/USDT', 'OKX');
        expect(price).toBe('2000.00');
        expect(fetch).toHaveBeenCalledWith(
            'https://www.okx.com/api/v5/market/ticker?instId=ETH-USDT'
        );
    });

    it('OKX: returns null when data array is empty', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [] }),
        });
        const price = await fetchPriceForExchange('ETH/USDT', 'OKX');
        expect(price).toBeNull();
    });

    it('Bybit: calls correct URL and parses lastPrice', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: { list: [{ lastPrice: '150.50' }] } }),
        });
        const price = await fetchPriceForExchange('SOL/USDT', 'Bybit');
        expect(price).toBe('150.50');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.bybit.com/v5/market/tickers?category=spot&symbol=SOLUSDT'
        );
    });

    it('Bybit: returns null when result list is empty', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: { list: [] } }),
        });
        const price = await fetchPriceForExchange('SOL/USDT', 'Bybit');
        expect(price).toBeNull();
    });

    it('HTX: calls correct URL with lowercase symbol and parses tick.close', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok', tick: { close: 50000 } }),
        });
        const price = await fetchPriceForExchange('BTC/USDT', 'HTX');
        expect(price).toBe('50000');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.huobi.pro/market/detail/merged?symbol=btcusdt'
        );
    });

    it('HTX: returns null when tick.close is missing', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok', tick: {} }),
        });
        const price = await fetchPriceForExchange('BTC/USDT', 'HTX');
        expect(price).toBeNull();
    });

    it('Gate.io: calls correct URL with underscore separator and parses last', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ([{ currency_pair: 'BTC_USDT', last: '50000.00' }]),
        });
        const price = await fetchPriceForExchange('BTC/USDT', 'Gate.io');
        expect(price).toBe('50000.00');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT'
        );
    });

    it('Gate.io: returns null when response array is empty', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ([]),
        });
        const price = await fetchPriceForExchange('BTC/USDT', 'Gate.io');
        expect(price).toBeNull();
    });

    it('MEXC: calls correct URL and parses price', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: 'ETHUSDT', price: '2000.00' }),
        });
        const price = await fetchPriceForExchange('ETH/USDT', 'MEXC');
        expect(price).toBe('2000.00');
        expect(fetch).toHaveBeenCalledWith(
            'https://api.mexc.com/api/v3/ticker/price?symbol=ETHUSDT'
        );
    });

    it('SSE: appends .SS suffix and calls proxy', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '12.34' }),
        });
        const price = await fetchPriceForExchange('600036', 'SSE');
        expect(price).toBe('12.34');
        expect(fetch).toHaveBeenCalledWith('/api/stock-price?symbol=600036.SS');
    });

    it('SSE: does not double-append suffix when already present', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '12.34' }),
        });
        await fetchPriceForExchange('600036.SS', 'SSE');
        expect(fetch).toHaveBeenCalledWith('/api/stock-price?symbol=600036.SS');
    });

    it('SZSE: appends .SZ suffix and calls proxy', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '56.78' }),
        });
        const price = await fetchPriceForExchange('000001', 'SZSE');
        expect(price).toBe('56.78');
        expect(fetch).toHaveBeenCalledWith('/api/stock-price?symbol=000001.SZ');
    });

    it('NYSE: calls proxy endpoint /api/stock-price with symbol', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '175.23' }),
        });
        const price = await fetchPriceForExchange('AAPL', 'NYSE');
        expect(price).toBe('175.23');
        expect(fetch).toHaveBeenCalledWith('/api/stock-price?symbol=AAPL');
    });

    it('NASDAQ: calls proxy endpoint /api/stock-price with symbol', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '420.69' }),
        });
        const price = await fetchPriceForExchange('TSLA', 'NASDAQ');
        expect(price).toBe('420.69');
        expect(fetch).toHaveBeenCalledWith('/api/stock-price?symbol=TSLA');
    });

    it('NYSE/NASDAQ: returns null when proxy returns no price field', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ error: 'Symbol not found' }),
        });
        const price = await fetchPriceForExchange('INVALID', 'NASDAQ');
        expect(price).toBeNull();
    });

    it('NYSE/NASDAQ: returns null when proxy returns non-ok status', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'Yahoo Finance returned 404' }),
        });
        const price = await fetchPriceForExchange('AAPL', 'NYSE');
        expect(price).toBeNull();
    });

    it('returns null when exchange API returns non-ok status', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
        expect(await fetchPriceForExchange('BTC/USDT', 'Binance')).toBeNull();
        expect(await fetchPriceForExchange('ETH/USDT', 'OKX')).toBeNull();
        expect(await fetchPriceForExchange('SOL/USDT', 'Bybit')).toBeNull();
        expect(await fetchPriceForExchange('AAPL', 'NYSE')).toBeNull();
        expect(await fetchPriceForExchange('TSLA', 'NASDAQ')).toBeNull();
    });

    it('returns null on network error (fetch throws)', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
        expect(await fetchPriceForExchange('BTC/USDT', 'Binance')).toBeNull();
        expect(await fetchPriceForExchange('AAPL', 'NYSE')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// inferCurrency
// ---------------------------------------------------------------------------
describe('inferCurrency', () => {
    it('returns CNY for SSE', () => {
        expect(inferCurrency('600036', 'SSE')).toBe('CNY');
    });

    it('returns CNY for SZSE', () => {
        expect(inferCurrency('000001', 'SZSE')).toBe('CNY');
    });

    it('returns USD for stablecoin-quoted crypto pairs (USDT)', () => {
        expect(inferCurrency('BTC/USDT', 'Binance')).toBe('USD');
    });

    it('returns USD for USDC-quoted pairs', () => {
        expect(inferCurrency('ETH/USDC', 'Binance')).toBe('USD');
    });

    it('returns the quote currency for non-stablecoin crypto pairs', () => {
        expect(inferCurrency('BTC/ETH', 'Binance')).toBe('ETH');
    });

    it('returns USD for bare stock symbols (NYSE/NASDAQ)', () => {
        expect(inferCurrency('AAPL', 'NYSE')).toBe('USD');
        expect(inferCurrency('TSLA', 'NASDAQ')).toBe('USD');
    });
});

// ---------------------------------------------------------------------------
// getCurrencySymbol / getCurrencySymbolForPair
// ---------------------------------------------------------------------------
describe('getCurrencySymbol', () => {
    it('maps USD to $', () => expect(getCurrencySymbol('USD')).toBe('$'));
    it('maps CNY to ¥', () => expect(getCurrencySymbol('CNY')).toBe('¥'));
    it('maps EUR to €', () => expect(getCurrencySymbol('EUR')).toBe('€'));
    it('falls back to the currency code for unknown currencies', () => {
        expect(getCurrencySymbol('BNB')).toBe('BNB');
    });
});

describe('getCurrencySymbolForPair', () => {
    it('returns ¥ for a CNY pair', () => {
        const configs = [{ pair: '600036', exchange: 'SSE', dataSource: 'SSE', currency: 'CNY' }];
        expect(getCurrencySymbolForPair('600036', configs)).toBe('¥');
    });

    it('returns $ for a USD pair', () => {
        const configs = [{ pair: 'BTC/USDT', exchange: 'Binance', dataSource: 'Binance', currency: 'USD' }];
        expect(getCurrencySymbolForPair('BTC/USDT', configs)).toBe('$');
    });

    it('defaults to $ when pair is not in configs', () => {
        expect(getCurrencySymbolForPair('UNKNOWN', [])).toBe('$');
    });
});

// ---------------------------------------------------------------------------
// useSettingsStore
// ---------------------------------------------------------------------------
describe('useSettingsStore', () => {

    beforeEach(() => {
        mockLocalStorage.clear();
        useSettingsStore.setState({
            predefinedPairs: [],
            pairConfigs: [],
            prices: {},
            dashboardTimeRange: '1Y',
            theme: 'system',
            pinnedPairs: []
        });
        vi.restoreAllMocks();
    });

    it('updates dashboard time range', () => {
        const { setDashboardTimeRange } = useSettingsStore.getState();
        setDashboardTimeRange('3M');
        expect(useSettingsStore.getState().dashboardTimeRange).toBe('3M');
    });

    it('toggles theme', () => {
        const { setTheme } = useSettingsStore.getState();
        setTheme('dark');
        expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('adds pair with default Binance exchange and infers USD currency', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('DOGE/USDT');
        const state = useSettingsStore.getState();
        expect(state.predefinedPairs).toContain('DOGE/USDT');
        expect(state.pairConfigs).toContainEqual({ pair: 'DOGE/USDT', exchange: 'Binance', dataSource: 'Binance', currency: 'USD' });
    });

    it('adds pair with explicit exchange and infers USD currency for stocks', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('AAPL', 'NASDAQ');
        const state = useSettingsStore.getState();
        expect(state.predefinedPairs).toContain('AAPL');
        expect(state.pairConfigs).toContainEqual({ pair: 'AAPL', exchange: 'NASDAQ', dataSource: 'NASDAQ', currency: 'USD' });
    });

    it('adds SSE pair and infers CNY currency', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('600036', 'SSE');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs).toContainEqual({ pair: '600036', exchange: 'SSE', dataSource: 'SSE', currency: 'CNY' });
    });

    it('adds pair with NYSE exchange and infers USD currency', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('JPM', 'NYSE');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs).toContainEqual({ pair: 'JPM', exchange: 'NYSE', dataSource: 'NYSE', currency: 'USD' });
    });

    it('adds pair with explicit dataSource different from exchange', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('BTC/USDT', 'HTX', 'Binance');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs).toContainEqual({ pair: 'BTC/USDT', exchange: 'HTX', dataSource: 'Binance', currency: 'USD' });
    });

    it('does not add duplicate pair', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('BTC/USDT');
        addPair('BTC/USDT');
        expect(useSettingsStore.getState().predefinedPairs).toHaveLength(1);
        expect(useSettingsStore.getState().pairConfigs).toHaveLength(1);
    });

    it('removes pair from both predefinedPairs and pairConfigs', () => {
        const { addPair, removePair } = useSettingsStore.getState();
        addPair('DOGE/USDT');
        removePair('DOGE/USDT');
        const state = useSettingsStore.getState();
        expect(state.predefinedPairs).not.toContain('DOGE/USDT');
        expect(state.pairConfigs.find(p => p.pair === 'DOGE/USDT')).toBeUndefined();
    });

    it('updatePairExchange changes only the exchange of the target pair', () => {
        const { addPair, updatePairExchange } = useSettingsStore.getState();
        addPair('AAPL', 'NYSE');
        addPair('TSLA', 'NASDAQ');
        updatePairExchange('AAPL', 'NASDAQ');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs.find(p => p.pair === 'AAPL')?.exchange).toBe('NASDAQ');
        expect(state.pairConfigs.find(p => p.pair === 'TSLA')?.exchange).toBe('NASDAQ');
    });

    it('updatePairExchange re-infers currency when exchange changes', () => {
        const { addPair, updatePairExchange } = useSettingsStore.getState();
        addPair('600036', 'NYSE');   // wrong exchange, currency = USD
        updatePairExchange('600036', 'SSE');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs.find(p => p.pair === '600036')?.currency).toBe('CNY');
    });

    it('toggles pinned pairs', () => {
        const { togglePinPair } = useSettingsStore.getState();
        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).toContain('ETH/USDT');
        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).not.toContain('ETH/USDT');
    });

    it('fetchPrices uses dataSource from pairConfigs for Binance pair', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['BTC/USDT'],
            pairConfigs: [{ pair: 'BTC/USDT', exchange: 'Binance', dataSource: 'Binance', currency: 'USD' }],
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '50000.00' }),
        });
        await useSettingsStore.getState().fetchPrices(['BTC/USDT'], true, true);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('api.binance.com')
        );
        expect(useSettingsStore.getState().prices['BTC/USDT']?.price).toBe('50000.00');
    });

    it('fetchPrices uses dataSource (not exchange) to fetch prices', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['BTC/USDT'],
            pairConfigs: [{ pair: 'BTC/USDT', exchange: 'HTX', dataSource: 'Binance', currency: 'USD' }],
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '50000.00' }),
        });
        await useSettingsStore.getState().fetchPrices(['BTC/USDT'], true, true);
        // Should hit Binance (dataSource), not HTX (exchange)
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('api.binance.com')
        );
    });

    it('fetchPrices uses proxy for NYSE pair', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['AAPL'],
            pairConfigs: [{ pair: 'AAPL', exchange: 'NYSE', dataSource: 'NYSE', currency: 'USD' }],
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '175.23' }),
        });
        await useSettingsStore.getState().fetchPrices(['AAPL'], true, true);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/stock-price?symbol=AAPL')
        );
        expect(useSettingsStore.getState().prices['AAPL']?.price).toBe('175.23');
    });

    it('fetchPrices uses proxy for NASDAQ pair', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['TSLA'],
            pairConfigs: [{ pair: 'TSLA', exchange: 'NASDAQ', dataSource: 'NASDAQ', currency: 'USD' }],
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ price: '250' }),
        });
        await useSettingsStore.getState().fetchPrices(['TSLA'], true, true);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/stock-price?symbol=TSLA')
        );
        expect(useSettingsStore.getState().prices['TSLA']?.price).toBe('250');
    });

    it('fetchPrices does not update store when price fetch fails', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['AAPL'],
            pairConfigs: [{ pair: 'AAPL', exchange: 'NASDAQ', dataSource: 'NASDAQ', currency: 'USD' }],
        });
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('CORS error'));
        await useSettingsStore.getState().fetchPrices(['AAPL'], true, true);
        expect(useSettingsStore.getState().prices['AAPL']).toBeUndefined();
    });

    it('updatePairDataSource changes only the dataSource of the target pair', () => {
        const { addPair, updatePairDataSource } = useSettingsStore.getState();
        addPair('BTC/USDT', 'HTX');
        updatePairDataSource('BTC/USDT', 'Binance');
        const state = useSettingsStore.getState();
        const config = state.pairConfigs.find(p => p.pair === 'BTC/USDT');
        expect(config?.exchange).toBe('HTX');
        expect(config?.dataSource).toBe('Binance');
    });

    it('respects cache TTL for prices', async () => {
        useSettingsStore.setState({
            prices: { 'BTC/USDT': { price: '48000', timestamp: Date.now() } },
        });
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;
        await useSettingsStore.getState().fetchPrices(['BTC/USDT'], false);
        expect(fetchSpy).not.toHaveBeenCalled();

        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ price: '50000' }),
        });
        await useSettingsStore.getState().fetchPrices(['BTC/USDT'], true);
        expect(fetchSpy).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Persistence migration
// ---------------------------------------------------------------------------
describe('persistence migration', () => {
    it('v1→v2: backfills currency from exchange and pair', () => {
        // Simulate v1 state without currency field
        const v1State = {
            predefinedPairs: ['BTC/USDT', '600036'],
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance' },
                { pair: '600036', exchange: 'SSE' },
            ],
        };
        // Apply migration manually
        useSettingsStore.setState({
            predefinedPairs: v1State.predefinedPairs,
            pairConfigs: v1State.pairConfigs.map((c: any) => ({
                ...c,
                currency: c.currency ?? inferCurrency(c.pair, c.exchange),
            })),
        });
        const state = useSettingsStore.getState();
        expect(state.pairConfigs.find(p => p.pair === 'BTC/USDT')?.currency).toBe('USD');
        expect(state.pairConfigs.find(p => p.pair === '600036')?.currency).toBe('CNY');
    });

    it('v2→v3: backfills dataSource from exchange', () => {
        // Simulate v2 state without dataSource field
        const v2State = {
            predefinedPairs: ['BTC/USDT', 'AAPL'],
            pairConfigs: [
                { pair: 'BTC/USDT', exchange: 'Binance', currency: 'USD' },
                { pair: 'AAPL', exchange: 'NYSE', currency: 'USD' },
            ],
        };
        useSettingsStore.setState({
            predefinedPairs: v2State.predefinedPairs,
            pairConfigs: v2State.pairConfigs.map((c: any) => ({
                ...c,
                dataSource: c.dataSource ?? c.exchange,
            })),
        });
        const state = useSettingsStore.getState();
        expect(state.pairConfigs.find(p => p.pair === 'BTC/USDT')?.dataSource).toBe('Binance');
        expect(state.pairConfigs.find(p => p.pair === 'AAPL')?.dataSource).toBe('NYSE');
    });
});
