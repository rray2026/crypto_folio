import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, fetchPriceForExchange } from './useSettingsStore';

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

    it('adds pair with default Binance exchange and keeps both arrays in sync', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('DOGE/USDT');
        const state = useSettingsStore.getState();
        expect(state.predefinedPairs).toContain('DOGE/USDT');
        expect(state.pairConfigs).toContainEqual({ pair: 'DOGE/USDT', exchange: 'Binance' });
    });

    it('adds pair with explicit exchange', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('AAPL', 'NASDAQ');
        const state = useSettingsStore.getState();
        expect(state.predefinedPairs).toContain('AAPL');
        expect(state.pairConfigs).toContainEqual({ pair: 'AAPL', exchange: 'NASDAQ' });
    });

    it('adds pair with NYSE exchange', () => {
        const { addPair } = useSettingsStore.getState();
        addPair('JPM', 'NYSE');
        const state = useSettingsStore.getState();
        expect(state.pairConfigs).toContainEqual({ pair: 'JPM', exchange: 'NYSE' });
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

    it('toggles pinned pairs', () => {
        const { togglePinPair } = useSettingsStore.getState();
        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).toContain('ETH/USDT');
        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).not.toContain('ETH/USDT');
    });

    it('fetchPrices uses exchange from pairConfigs for Binance pair', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['BTC/USDT'],
            pairConfigs: [{ pair: 'BTC/USDT', exchange: 'Binance' }],
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

    it('fetchPrices uses proxy for NYSE pair', async () => {
        useSettingsStore.setState({
            predefinedPairs: ['AAPL'],
            pairConfigs: [{ pair: 'AAPL', exchange: 'NYSE' }],
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
            pairConfigs: [{ pair: 'TSLA', exchange: 'NASDAQ' }],
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
            pairConfigs: [{ pair: 'AAPL', exchange: 'NASDAQ' }],
        });
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('CORS error'));
        await useSettingsStore.getState().fetchPrices(['AAPL'], true, true);
        expect(useSettingsStore.getState().prices['AAPL']).toBeUndefined();
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
