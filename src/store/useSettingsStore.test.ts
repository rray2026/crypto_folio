import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

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

describe('useSettingsStore', () => {

    beforeEach(() => {
        mockLocalStorage.clear();
        // Reset store state by calling its internal set method with initial values
        useSettingsStore.setState({
            predefinedPairs: [],
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

    it('adds and removes pairs', () => {
        const { addPair, removePair } = useSettingsStore.getState();
        
        addPair('DOGE/USDT');
        expect(useSettingsStore.getState().predefinedPairs).toContain('DOGE/USDT');

        removePair('DOGE/USDT');
        expect(useSettingsStore.getState().predefinedPairs).not.toContain('DOGE/USDT');
    });

    it('toggles pinned pairs', () => {
        const { togglePinPair } = useSettingsStore.getState();
        
        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).toContain('ETH/USDT');

        togglePinPair('ETH/USDT');
        expect(useSettingsStore.getState().pinnedPairs).not.toContain('ETH/USDT');
    });

    it('fetches prices from Binance API', async () => {
        const { fetchPrices } = useSettingsStore.getState();
        
        const mockPrice = "50000.00";
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: "BTCUSDT", price: mockPrice })
        });

        await fetchPrices(['BTC/USDT'], true);

        const prices = useSettingsStore.getState().prices;
        expect(prices['BTC/USDT']).toBeDefined();
        expect(prices['BTC/USDT'].price).toBe(mockPrice);
    });

    it('respects cache TTL for prices', async () => {
        const { fetchPrices } = useSettingsStore.getState();
        
        // Setup initial price in state
        useSettingsStore.setState({
            prices: {
                'BTC/USDT': { price: '48000', timestamp: Date.now() }
            }
        });

        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;

        // Fetch without force - should skip due to cache
        await fetchPrices(['BTC/USDT'], false);
        expect(fetchSpy).not.toHaveBeenCalled();

        // Fetch with force - should trigger fetch
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => ({ symbol: "BTCUSDT", price: "50000" })
        });
        await fetchPrices(['BTC/USDT'], true);
        expect(fetchSpy).toHaveBeenCalled();
    });
});
