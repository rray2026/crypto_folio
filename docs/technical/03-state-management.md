# 状态管理设计

## 1. 整体架构

CryptoFolio 使用 [Zustand](https://github.com/pmndrs/zustand) v5 管理全局状态，共四个 Store：

| Store | 文件 | 职责 | 持久化 |
|-------|------|------|--------|
| `useTransactionStore` | `src/store/useTransactionStore.ts` | 交易记录 CRUD | IndexedDB（Dexie） |
| `usePositionStore` | `src/store/usePositionStore.ts` | 持仓策略 CRUD | IndexedDB（Dexie） |
| `useFundStore` | `src/store/useFundStore.ts` | 基金管理 | IndexedDB（Dexie） |
| `useSettingsStore` | `src/store/useSettingsStore.ts` | 设置、价格、主题 | localStorage（Zustand persist） |

**设计原则：**
- Store 是**唯一的数据写入路径**，任何数据变更必须通过 Store action，不能直接操作 Dexie。
- Store action 负责维护双向引用的完整性（见数据模型文档）。
- 响应式数据读取使用 `useLiveQuery()`，不在 Store 中缓存全量数据列表。

---

## 2. useTransactionStore

### 2.1 Action 一览

```typescript
interface TransactionStore {
  addTransaction(tx: Omit<Transaction, 'id'>): Promise<string>
  bulkAddTransactions(txs: Omit<Transaction, 'id'>[]): Promise<{
    added: number;
    skipped: number;
  }>
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<void>
  deleteTransaction(id: string): Promise<void>
  bulkDeleteTransactions(ids: string[]): Promise<void>
}
```

### 2.2 关键逻辑

**`addTransaction`：**
1. 生成 UUID 作为 `id`。
2. 确保 `associatedPositionIds` 默认为空数组。
3. 调用 `db.transactions.add(tx)`。

**`bulkAddTransactions`（导入去重）：**
- 去重策略一：`id`（UUID）级别——如果 `id` 已存在则跳过。
- 去重策略二：`orderId` 级别——如果 `orderId` 非空且与现有记录重复则跳过（防止 Binance 订单重复导入）。
- 返回 `{ added, skipped }` 统计结果。
- 实现方式：先从 IndexedDB 取出所有现有 `id` 和 `orderId` 构建 Set，逐条过滤后批量 `db.transactions.bulkAdd()`。

**`deleteTransaction`：**
1. 从 `db.transactions` 删除记录。
2. 取出 `associatedPositionIds` 列表。
3. 批量更新关联持仓：从每个 Position 的 `entries` 中过滤掉该 transactionId。

**`bulkDeleteTransactions`：**
- 循环调用 `deleteTransaction`（保证每条的双向清理逻辑都执行）。

---

## 3. usePositionStore

### 3.1 Action 一览

```typescript
interface PositionStore {
  createPosition(data: Omit<Position, 'id'>): Promise<string>
  updatePosition(id: string, updates: Partial<Position>): Promise<void>
  deletePosition(id: string): Promise<void>
  addTransactionToPosition(
    positionId: string,
    entry: PositionEntry
  ): Promise<void>
  removeTransactionFromPosition(
    positionId: string,
    transactionId: string
  ): Promise<void>
  closePosition(id: string): Promise<void>
  openPosition(id: string): Promise<void>
}
```

### 3.2 关键逻辑

**`createPosition`：**
1. 生成 UUID。
2. 确保 `entries` 默认为空数组，`status` 默认为 `'OPEN'`。
3. `db.positions.add(position)`。

**`addTransactionToPosition`：**
1. 读取当前 Position。
2. 查找 entries 中是否已有该 `transactionId`。
   - 如已存在：更新 `allocatedAmount`。
   - 如不存在：追加新 entry。
3. 更新 Position：`db.positions.put(updated)`。
4. 更新 Transaction：将 `positionId` 加入 `associatedPositionIds`（如尚未包含）。

**`removeTransactionFromPosition`：**
1. 从 Position.entries 中过滤掉该 transactionId。
2. 更新 Position。
3. 从 Transaction.associatedPositionIds 中移除该 positionId。
4. 更新 Transaction。

**`deletePosition`：**
1. 读取当前 Position，取出所有 entries 的 transactionId。
2. `db.positions.delete(id)`。
3. 批量更新关联交易，从其 `associatedPositionIds` 中移除该 positionId。
4. **不删除** Transaction（交易是独立数据原子）。

**`closePosition`：**
```typescript
await db.positions.update(id, {
  status: 'CLOSED',
  endDate: Date.now(),
});
```

**`openPosition`：**
```typescript
await db.positions.update(id, {
  status: 'OPEN',
  endDate: undefined,
});
```

---

## 4. useFundStore

### 4.1 Action 一览

```typescript
interface FundStore {
  createFund(data: Omit<Fund, 'id' | 'createdAt'>): Promise<string>
  updateFund(id: string, updates: Partial<Fund>): Promise<void>
  deleteFund(id: string): Promise<void>
  assignPositionToFund(positionId: string, fundId: string): Promise<void>
  unassignPosition(positionId: string): Promise<void>
}
```

### 4.2 关键逻辑

**`createFund`：**
1. 生成 UUID，设置 `createdAt: Date.now()`。
2. `db.funds.add(fund)`。

**`deleteFund`：**
1. `db.funds.delete(id)`。
2. 查找所有 `fundId === id` 的持仓。
3. 批量将这些持仓的 `fundId` 更新为 `undefined`。

**`assignPositionToFund`：**
```typescript
await db.positions.update(positionId, { fundId });
```

**`unassignPosition`：**
```typescript
await db.positions.update(positionId, { fundId: undefined });
```

---

## 5. useSettingsStore

### 5.1 结构与持久化

这是唯一使用 **Zustand `persist` 中间件**的 Store，数据存储在 `localStorage`（不用 IndexedDB）：

```typescript
const useSettingsStore = create(
  persist(
    (set, get) => ({ ...actions }),
    {
      name: 'crypto-folio-settings', // localStorage key
      version: 4,                    // 与 DB_VERSION 保持同步
      migrate: (state, version) => { /* localStorage 迁移 */ },
    }
  )
);
```

### 5.2 State 结构

```typescript
interface SettingsState {
  // 交易对配置
  predefinedPairs: string[];         // 预设交易对列表（默认含 BTC/USDT 等）
  pairConfigs: PairConfig[];         // 每个交易对的 exchange 和 dataProvider
  pinnedPairs: string[];             // 仪表盘固定显示的交易对

  // 价格缓存
  prices: Record<string, {
    price: number;
    timestamp: number;               // 上次更新时间（用于 TTL 判断）
    currency: string;                // 计价货币
  }>;

  // UI 设置
  dashboardTimeRange: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  theme: 'dark' | 'light' | 'system';
}

interface PairConfig {
  symbol: string;           // 如 "BTC/USDT"
  exchange?: string;        // 如 "Binance"
  dataProvider?: string;    // 如 "Yahoo Finance"
}
```

### 5.3 Action 一览

```typescript
interface SettingsActions {
  // 主题
  setTheme(theme: 'dark' | 'light' | 'system'): void

  // 时间范围
  setDashboardTimeRange(range: DashboardTimeRange): void

  // 交易对管理
  addPair(pair: string, exchange?: string, dataProvider?: string): void
  removePair(pair: string): void
  updatePairExchange(pair: string, exchange: string): void
  updatePairDataProvider(pair: string, dataProvider: string): void
  togglePinPair(pair: string): void  // 固定/取消固定到仪表盘

  // 价格
  fetchPrices(
    symbols?: string[],
    force?: boolean,
    exactSymbolsOnly?: boolean
  ): Promise<void>
}
```

### 5.4 价格获取逻辑

`fetchPrices` 是 Settings Store 中最复杂的 action：

```typescript
async fetchPrices(symbols?, force = false, exactSymbolsOnly = false) {
  const TTL = 5 * 60 * 1000; // 5 分钟缓存
  const now = Date.now();

  // 确定需要获取价格的交易对
  const targetSymbols = symbols
    ?? (exactSymbolsOnly ? [] : get().predefinedPairs);

  // 过滤掉缓存未过期的（非强制刷新时）
  const toFetch = force
    ? targetSymbols
    : targetSymbols.filter(s => {
        const cached = get().prices[s];
        return !cached || now - cached.timestamp > TTL;
      });

  // 并发获取所有价格
  const results = await Promise.allSettled(
    toFetch.map(symbol => fetchPriceFromProvider(symbol, get()))
  );

  // 更新缓存
  const newPrices = { ...get().prices };
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      newPrices[toFetch[i]] = {
        price: result.value.price,
        timestamp: now,
        currency: result.value.currency,
      };
    }
  });
  set({ prices: newPrices });
}
```

**触发时机：**
- Dashboard 页面挂载时（获取所有固定交易对）。
- PositionDetails 页面挂载时（获取该持仓标的的价格）。
- 下拉刷新（PullToRefresh）时使用 `force: true` 绕过缓存。

### 5.5 localStorage 迁移

当 `persist` 的 `version` 字段不匹配时（如用户上次登录用的是老版本 App），`migrate` 函数被调用：

```typescript
migrate: (persistedState, version) => {
  let state = persistedState;
  // 逐版本升级，类似数据库迁移
  if (version < 4) {
    // 执行 MIGRATIONS[2].upgradeLocalStorage(state)
  }
  return state;
}
```

---

## 6. 响应式数据读取

Store 里不存储全量数据列表，组件使用 `useLiveQuery()` 直接订阅 IndexedDB：

```typescript
// 在组件中使用
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const positions = useLiveQuery(
  () => db.positions.where('status').equals('OPEN').toArray(),
  []  // 依赖项
);
```

`useLiveQuery` 的工作原理：
- Dexie 内部追踪查询访问的数据范围。
- 当 IndexedDB 中有匹配的数据变化时，自动重新执行查询并触发组件重渲染。
- 不需要手动订阅/取消订阅。

---

## 7. Store 间协作模式

Store 之间**不相互调用**，协作由 UI 层编排：

```typescript
// 示例：删除持仓并清理关联交易（在组件中）
const { deletePosition } = usePositionStore();
// deletePosition 内部已处理 Transaction 的双向引用清理
await deletePosition(positionId);
```

若需要跨 Store 操作（如创建持仓同时更新多个交易），由 UI 组件依次调用各 Store 的 action，按正确顺序执行。
