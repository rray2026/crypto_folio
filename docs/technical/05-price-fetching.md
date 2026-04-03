# 价格获取系统

## 1. 概览

价格获取逻辑集中在 `src/store/useSettingsStore.ts`，支持多个交易所和股票市场数据源，带本地缓存机制。

股票市场（A股、美股）通过 Cloudflare Pages Function（`functions/api/stock-price.ts`）代理 Yahoo Finance API，绕过浏览器 CORS 限制。

---

## 2. 数据提供商

### 2.1 支持的提供商

| 数据提供商 | 类型 | API 调用方式 |
|-----------|------|-------------|
| Binance | 现货加密货币 | 直接调用公开 REST API |
| OKX | 现货加密货币 | 直接调用公开 REST API |
| Bybit | 现货加密货币 | 直接调用公开 REST API |
| HTX（火币） | 现货加密货币 | 直接调用公开 REST API |
| Gate.io | 现货加密货币 | 直接调用公开 REST API |
| MEXC | 现货加密货币 | 直接调用公开 REST API |
| Yahoo Finance | 股票（A股/美股） | 通过 `/api/stock-price` 代理 |

### 2.2 各提供商 API 细节

**Binance：**
```
GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
// 交易对格式：移除 "/" 分隔符，大写
// 响应：{ "symbol": "BTCUSDT", "price": "67234.56" }
```

**OKX：**
```
GET https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT
// 交易对格式：将 "/" 替换为 "-"
// 响应：{ "data": [{ "last": "67234.56" }] }
```

**Bybit：**
```
GET https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT
// 交易对格式：移除 "/"，大写
// 响应：{ "result": { "list": [{ "lastPrice": "67234.56" }] } }
```

**HTX（火币）：**
```
GET https://api.huobi.pro/market/detail/merged?symbol=btcusdt
// 交易对格式：移除 "/"，全部小写
// 响应：{ "tick": { "close": 67234.56 } }
```

**Gate.io：**
```
GET https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT
// 交易对格式：将 "/" 替换为 "_"，大写
// 响应：[{ "last": "67234.56" }]
```

**MEXC：**
```
GET https://api.mexc.com/api/v3/ticker/price?symbol=BTCUSDT
// 交易对格式：移除 "/"，大写
// 响应：{ "price": "67234.56" }
```

**Yahoo Finance（通过代理）：**
```
GET /api/stock-price?symbol=AAPL        // 美股
GET /api/stock-price?symbol=600519.SS   // 上交所
GET /api/stock-price?symbol=000858.SZ   // 深交所
// 响应：{ "price": "175.50" }
```

---

## 3. 交易对格式转换

不同交易所对同一交易对有不同的命名格式，系统在调用前进行转换：

```typescript
// 内部统一格式：BTC/USDT（使用 "/" 分隔）
// 各交易所需要的格式：
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

**Yahoo Finance 股票代码转换：**
```typescript
function formatYahooSymbol(symbol: string, exchange?: string): string {
  // 上交所：600519 → 600519.SS
  if (exchange === 'SSE' || symbol.endsWith('.SS')) return symbol;
  // 深交所：000858 → 000858.SZ
  if (exchange === 'SZSE' || symbol.endsWith('.SZ')) return symbol;
  // 美股：AAPL → AAPL（不变）
  return symbol;
}
```

---

## 4. 计价货币推断

根据交易对和交易所推断价格的计价货币：

```typescript
function inferCurrency(symbol: string, exchange?: string): string {
  // A股：人民币
  if (exchange === 'SSE' || exchange === 'SZSE') return 'CNY';

  // 稳定币计价：以 USD 计算
  const stablecoins = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'FDUSD'];
  const quote = symbol.split('/')[1];
  if (stablecoins.includes(quote)) return 'USD';

  // 其他：使用报价货币（如 BTC/ETH → 'ETH'）
  return quote ?? 'USD';
}
```

---

## 5. 缓存机制

```typescript
// 缓存存储在 useSettingsStore 的 prices 字段（localStorage 持久化）
prices: Record<string, {
  price: number;
  timestamp: number;  // 上次成功获取的时间戳
  currency: string;
}>

// TTL：5分钟
const PRICE_CACHE_TTL = 5 * 60 * 1000;

// 判断是否需要重新获取
function isCacheStale(symbol: string): boolean {
  const cached = prices[symbol];
  if (!cached) return true;
  return Date.now() - cached.timestamp > PRICE_CACHE_TTL;
}
```

**缓存策略：**
- 默认：5分钟 TTL，过期才重新请求。
- `force: true`：强制跳过缓存，立即重新获取（用于下拉刷新）。
- 失败时：保留旧缓存值（不清空），仅不更新 `timestamp`（下次仍会重试）。

---

## 6. Cloudflare Pages Function（股票价格代理）

### 文件位置

`functions/api/stock-price.ts`

### 为什么需要代理

Yahoo Finance API 不允许来自浏览器的直接跨域请求（CORS 限制）。Cloudflare Pages Function 作为服务端代理，接收浏览器请求后转发给 Yahoo Finance，返回结果。

### 实现逻辑

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

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功，返回 `{ price: string }` |
| 400 | 缺少 `symbol` 参数 |
| 404 | Yahoo Finance 未找到该股票代码 |
| 502 | 代理请求 Yahoo Finance 失败（网络错误） |

---

## 7. 交易对与数据提供商的配置

### PairConfig 结构

```typescript
interface PairConfig {
  symbol: string;          // 内部交易对，如 "BTC/USDT"
  exchange?: string;       // 交易所名称（UI 显示用）
  dataProvider?: string;   // 实际价格来源，如 "Binance"
}
```

- `exchange` 用于 UI 显示（如"在哪个交易所交易"）。
- `dataProvider` 决定调用哪个 API 获取价格。
- 两者可以不同（如在 OKX 交易，但从 Binance 取价格）。
- A股的 exchange 为 `'SSE'` 或 `'SZSE'`，dataProvider 自动为 `'Yahoo Finance'`。

### 数据提供商的自动路由

```typescript
function resolveDataProvider(config: PairConfig): string {
  if (config.dataProvider) return config.dataProvider;

  // 股票交易所自动使用 Yahoo Finance
  if (['NYSE', 'NASDAQ', 'SSE', 'SZSE'].includes(config.exchange ?? '')) {
    return 'Yahoo Finance';
  }

  // 默认：Binance
  return 'Binance';
}
```

---

## 8. 开发与调试建议

**本地开发时调用股票价格 API：**
- `npm run dev` 不会启动 Cloudflare Pages Function。
- 需要使用 `npx wrangler pages dev dist` 在本地模拟 Cloudflare 环境。
- 或者在 `useSettingsStore` 中临时将 Yahoo Finance 请求改为直接调用（仅限开发环境测试）。

**调试价格获取失败：**
1. 打开浏览器 DevTools → Network，查看请求的 URL 和响应。
2. 检查 `useSettingsStore.prices` 中是否有 `timestamp` 更新（说明获取成功）。
3. 对于 Yahoo Finance，检查 Cloudflare Pages Function 的日志（生产环境）。
