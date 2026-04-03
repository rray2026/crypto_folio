# Price Fetching System

## 1. Overview

Price fetching logic is centralized in `src/store/useSettingsStore.ts`. It supports multiple exchange and stock market data sources with a local cache.

Stock markets (A-shares, US stocks) route through a Cloudflare Pages Function (`functions/api/stock-price.ts`) that proxies the Yahoo Finance API to work around browser CORS restrictions.

---

## 2. Data Providers

### 2.1 Supported providers

| Provider | Type | API access |
|---|---|---|
| Binance | Spot crypto | Direct public REST API |
| OKX | Spot crypto | Direct public REST API |
| Bybit | Spot crypto | Direct public REST API |
| HTX (Huobi) | Spot crypto | Direct public REST API |
| Gate.io | Spot crypto | Direct public REST API |
| MEXC | Spot crypto | Direct public REST API |
| Yahoo Finance | Stocks (A-shares / US) | Via `/api/stock-price` proxy |

### 2.2 Provider API details

**Binance:**
```
GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
// Symbol format: remove "/" separator, uppercase
// Response: { "symbol": "BTCUSDT", "price": "67234.56" }
```

**OKX:**
```
GET https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT
// Symbol format: replace "/" with "-"
// Response: { "data": [{ "last": "67234.56" }] }
```

**Bybit:**
```
GET https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT
// Symbol format: remove "/", uppercase
// Response: { "result": { "list": [{ "lastPrice": "67234.56" }] } }
```

**HTX (Huobi):**
```
GET https://api.huobi.pro/market/detail/merged?symbol=btcusdt
// Symbol format: remove "/", all lowercase
// Response: { "tick": { "close": 67234.56 } }
```

**Gate.io:**
```
GET https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT
// Symbol format: replace "/" with "_", uppercase
// Response: [{ "last": "67234.56" }]
```

**MEXC:**
```
GET https://api.mexc.com/api/v3/ticker/price?symbol=BTCUSDT
// Symbol format: remove "/", uppercase
// Response: { "price": "67234.56" }
```

**Yahoo Finance (via proxy):**
```
GET /api/stock-price?symbol=AAPL        // US stocks
GET /api/stock-price?symbol=600519.SS   // Shanghai Stock Exchange
GET /api/stock-price?symbol=000858.SZ   // Shenzhen Stock Exchange
// Response: { "price": "175.50" }
```

---

## 3. Symbol Format Conversion

Different exchanges use different naming conventions for the same asset. The system transforms symbols before calling each provider:

```typescript
// Internal canonical format: BTC/USDT (using "/" separator)
// Per-provider required formats:
function formatSymbolForProvider(symbol: string, provider: string): string {
  switch (provider) {
    case 'Binance':
    case 'Bybit':
    case 'MEXC':
      return symbol.replace('/', '').toUpperCase();    // BTCUSDT
    case 'OKX':
      return symbol.replace('/', '-').toUpperCase();   // BTC-USDT
    case 'HTX':
      return symbol.replace('/', '').toLowerCase();    // btcusdt
    case 'Gate.io':
      return symbol.replace('/', '_').toUpperCase();   // BTC_USDT
    case 'Yahoo Finance':
      return formatYahooSymbol(symbol);                // 600519.SS
  }
}
```

**Yahoo Finance stock code conversion:**
```typescript
function formatYahooSymbol(symbol: string, exchange?: string): string {
  // Shanghai: 600519 → 600519.SS
  if (exchange === 'SSE' || symbol.endsWith('.SS')) return symbol;
  // Shenzhen: 000858 → 000858.SZ
  if (exchange === 'SZSE' || symbol.endsWith('.SZ')) return symbol;
  // US stocks: AAPL → AAPL (unchanged)
  return symbol;
}
```

---

## 4. Quote Currency Inference

The quote currency is inferred from the trading pair and exchange:

```typescript
function inferCurrency(symbol: string, exchange?: string): string {
  // A-share markets: Chinese yuan
  if (exchange === 'SSE' || exchange === 'SZSE') return 'CNY';

  // Stablecoin-quoted pairs: treat as USD
  const stablecoins = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'FDUSD'];
  const quote = symbol.split('/')[1];
  if (stablecoins.includes(quote)) return 'USD';

  // Otherwise: use the quote currency (e.g. BTC/ETH → 'ETH')
  return quote ?? 'USD';
}
```

---

## 5. Cache Mechanism

```typescript
// Cache is stored in useSettingsStore's prices field (persisted to localStorage)
prices: Record<string, {
  price: number;
  timestamp: number;  // Timestamp of the last successful fetch
  currency: string;
}>

// TTL: 5 minutes
const PRICE_CACHE_TTL = 5 * 60 * 1000;

// Whether a cached price should be re-fetched
function isCacheStale(symbol: string): boolean {
  const cached = prices[symbol];
  if (!cached) return true;
  return Date.now() - cached.timestamp > PRICE_CACHE_TTL;
}
```

**Cache strategy:**
- Default: 5-minute TTL; only re-fetches when expired.
- `force: true`: bypasses the cache and re-fetches immediately (used by pull-to-refresh).
- On failure: the old cached value is retained (not cleared); only `timestamp` is not updated, so the next request will retry.

---

## 6. Cloudflare Pages Function (Stock Price Proxy)

### File location

`functions/api/stock-price.ts`

### Why a proxy is needed

The Yahoo Finance API does not allow direct cross-origin requests from browsers (CORS restriction). The Cloudflare Pages Function acts as a server-side proxy: it receives the browser request, forwards it to Yahoo Finance, and returns the result.

### Implementation

```typescript
// GET /api/stock-price?symbol=AAPL
export async function onRequestGet(context: EventContext<...>) {
  const symbol = new URL(context.request.url).searchParams.get('symbol');

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Yahoo Finance v8 API
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const resp = await fetch(yahooUrl);
    const data = await resp.json();

    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!price) {
      return new Response(JSON.stringify({ error: 'symbol not found' }), {
        status: 404
      });
    }

    return new Response(JSON.stringify({ price: String(price) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'fetch failed' }), {
      status: 502
    });
  }
}
```

### HTTP status codes

| Status | Meaning |
|---|---|
| 200 | Success; returns `{ price: string }` |
| 400 | Missing `symbol` query parameter |
| 404 | Yahoo Finance did not find the ticker |
| 502 | Proxy request to Yahoo Finance failed (network error) |

---

## 7. Pair and Data Provider Configuration

### PairConfig structure

```typescript
interface PairConfig {
  symbol: string;          // Internal pair, e.g. "BTC/USDT"
  exchange?: string;       // Exchange name (for display purposes)
  dataProvider?: string;   // Actual price source, e.g. "Binance"
}
```

- `exchange` is used for UI display (e.g. "which exchange does the user trade on").
- `dataProvider` determines which API is called to fetch the price.
- The two can differ (e.g. trade on OKX but fetch prices from Binance).
- A-share exchanges have `exchange: 'SSE'` or `'SZSE'`, and `dataProvider` automatically resolves to `'Yahoo Finance'`.

### Automatic data provider routing

```typescript
function resolveDataProvider(config: PairConfig): string {
  if (config.dataProvider) return config.dataProvider;

  // Stock exchanges automatically use Yahoo Finance
  if (['NYSE', 'NASDAQ', 'SSE', 'SZSE'].includes(config.exchange ?? '')) {
    return 'Yahoo Finance';
  }

  // Default: Binance
  return 'Binance';
}
```

---

## 8. Development and Debugging Notes

**Testing stock price API locally:**
- `npm run dev` does not start the Cloudflare Pages Function.
- Use `npx wrangler pages dev dist` to simulate the Cloudflare environment locally.
- Alternatively, temporarily point the Yahoo Finance request directly at the Yahoo API in the store (development testing only).

**Debugging price fetch failures:**
1. Open browser DevTools → Network and inspect the request URL and response.
2. Check whether `useSettingsStore.prices[symbol].timestamp` is being updated (indicates a successful fetch).
3. For Yahoo Finance, check Cloudflare Pages Function logs in the production dashboard.
