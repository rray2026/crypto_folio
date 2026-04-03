# State Management Design

## 1. Overview

CryptoFolio uses [Zustand](https://github.com/pmndrs/zustand) v5 for global state management, organized into four stores:

| Store | File | Responsibility | Persistence |
|---|---|---|---|
| `useTransactionStore` | `src/store/useTransactionStore.ts` | Transaction CRUD | IndexedDB (Dexie) |
| `usePositionStore` | `src/store/usePositionStore.ts` | Position CRUD | IndexedDB (Dexie) |
| `useFundStore` | `src/store/useFundStore.ts` | Fund management | IndexedDB (Dexie) |
| `useSettingsStore` | `src/store/useSettingsStore.ts` | Settings, prices, theme | localStorage (Zustand persist) |

**Design principles:**
- Stores are the **only write path** for all data changes. No component should write to Dexie directly — all mutations go through store actions.
- Store actions are responsible for maintaining bidirectional reference integrity (see the data model document).
- Reactive data reads use `useLiveQuery()` — stores do not cache full data lists.

---

## 2. useTransactionStore

### 2.1 Actions

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

### 2.2 Key logic

**`addTransaction`:**
1. Generate a UUID as `id`.
2. Ensure `associatedPositionIds` defaults to an empty array.
3. Call `db.transactions.add(tx)`.

**`bulkAddTransactions` (import deduplication):**
- Dedup strategy 1: `id` (UUID) level — skip if `id` already exists.
- Dedup strategy 2: `orderId` level — skip if `orderId` is non-null and matches an existing record (prevents re-importing the same Binance order).
- Returns `{ added, skipped }` statistics.
- Implementation: fetch all existing `id` and `orderId` values into a Set, filter each incoming record, then batch insert via `db.transactions.bulkAdd()`.

**`deleteTransaction`:**
1. Delete the record from `db.transactions`.
2. Retrieve its `associatedPositionIds` list.
3. Update all linked positions: filter the deleted `transactionId` out of each Position's `entries`.

**`bulkDeleteTransactions`:**
- Calls `deleteTransaction` in a loop (ensuring the bidirectional cleanup logic runs for every record).

---

## 3. usePositionStore

### 3.1 Actions

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

### 3.2 Key logic

**`createPosition`:**
1. Generate a UUID.
2. Ensure `entries` defaults to `[]` and `status` defaults to `'OPEN'`.
3. Call `db.positions.add(position)`.

**`addTransactionToPosition`:**
1. Read the current Position.
2. Check if `transactionId` already exists in `entries`.
   - If yes: update `allocatedAmount`.
   - If no: append a new entry.
3. Update the Position: `db.positions.put(updated)`.
4. Update the Transaction: add `positionId` to `associatedPositionIds` if not already present.

**`removeTransactionFromPosition`:**
1. Filter the `transactionId` out of `Position.entries`.
2. Update the Position.
3. Remove `positionId` from `Transaction.associatedPositionIds`.
4. Update the Transaction.

**`deletePosition`:**
1. Read the current Position; extract all `transactionId` values from its entries.
2. Call `db.positions.delete(id)`.
3. Update each linked transaction: remove `positionId` from its `associatedPositionIds`.
4. **Do not delete** the Transactions (they are independent data atoms).

**`closePosition`:**
```typescript
await db.positions.update(id, {
  status: 'CLOSED',
  endDate: Date.now(),
});
```

**`openPosition`:**
```typescript
await db.positions.update(id, {
  status: 'OPEN',
  endDate: undefined,
});
```

---

## 4. useFundStore

### 4.1 Actions

```typescript
interface FundStore {
  createFund(data: Omit<Fund, 'id' | 'createdAt'>): Promise<string>
  updateFund(id: string, updates: Partial<Fund>): Promise<void>
  deleteFund(id: string): Promise<void>
  assignPositionToFund(positionId: string, fundId: string): Promise<void>
  unassignPosition(positionId: string): Promise<void>
}
```

### 4.2 Key logic

**`createFund`:**
1. Generate a UUID and set `createdAt: Date.now()`.
2. Call `db.funds.add(fund)`.

**`deleteFund`:**
1. Call `db.funds.delete(id)`.
2. Find all positions where `fundId === id`.
3. Batch-update those positions to set `fundId = undefined`.

**`assignPositionToFund`:**
```typescript
await db.positions.update(positionId, { fundId });
```

**`unassignPosition`:**
```typescript
await db.positions.update(positionId, { fundId: undefined });
```

---

## 5. useSettingsStore

### 5.1 Structure and persistence

This is the only store using **Zustand's `persist` middleware**, storing data in `localStorage` (not IndexedDB):

```typescript
const useSettingsStore = create(
  persist(
    (set, get) => ({ ...actions }),
    {
      name: 'crypto-folio-settings', // localStorage key
      version: 4,                    // in sync with DB_VERSION
      migrate: (state, version) => { /* localStorage migration */ },
    }
  )
);
```

### 5.2 State structure

```typescript
interface SettingsState {
  // Trading pair configuration
  predefinedPairs: string[];         // Suggested trading pair list (defaults include BTC/USDT, etc.)
  pairConfigs: PairConfig[];         // Exchange and dataProvider mapping per pair
  pinnedPairs: string[];             // Pairs pinned to the dashboard ticker

  // Price cache
  prices: Record<string, {
    price: number;
    timestamp: number;               // Last fetch time (for TTL comparison)
    currency: string;                // Quote currency
  }>;

  // UI settings
  dashboardTimeRange: '1M' | '3M' | '6M' | '1Y' | 'ALL';
  theme: 'dark' | 'light' | 'system';
}

interface PairConfig {
  symbol: string;           // e.g. "BTC/USDT"
  exchange?: string;        // e.g. "Binance"
  dataProvider?: string;    // e.g. "Yahoo Finance"
}
```

### 5.3 Actions

```typescript
interface SettingsActions {
  // Theme
  setTheme(theme: 'dark' | 'light' | 'system'): void

  // Time range
  setDashboardTimeRange(range: DashboardTimeRange): void

  // Pair management
  addPair(pair: string, exchange?: string, dataProvider?: string): void
  removePair(pair: string): void
  updatePairExchange(pair: string, exchange: string): void
  updatePairDataProvider(pair: string, dataProvider: string): void
  togglePinPair(pair: string): void  // Pin/unpin from the dashboard

  // Prices
  fetchPrices(
    symbols?: string[],
    force?: boolean,
    exactSymbolsOnly?: boolean
  ): Promise<void>
}
```

### 5.4 Price fetching logic

`fetchPrices` is the most complex action in the Settings Store:

```typescript
async fetchPrices(symbols?, force = false, exactSymbolsOnly = false) {
  const TTL = 5 * 60 * 1000; // 5-minute cache
  const now = Date.now();

  // Determine which pairs need a price fetch
  const targetSymbols = symbols
    ?? (exactSymbolsOnly ? [] : get().predefinedPairs);

  // Filter out pairs whose cache has not yet expired (unless force refresh)
  const toFetch = force
    ? targetSymbols
    : targetSymbols.filter(s => {
        const cached = get().prices[s];
        return !cached || now - cached.timestamp > TTL;
      });

  // Fetch all prices concurrently
  const results = await Promise.allSettled(
    toFetch.map(symbol => fetchPriceFromProvider(symbol, get()))
  );

  // Update the cache
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

**Trigger points:**
- Dashboard page mount (fetches all pinned pairs).
- PositionDetails page mount (fetches the price for that position's symbol).
- Pull-to-refresh uses `force: true` to bypass the cache.

### 5.5 localStorage migration

When the `persist` `version` field does not match (e.g. the user last used an older app version), the `migrate` function is called:

```typescript
migrate: (persistedState, version) => {
  let state = persistedState;
  // Upgrade step by step, analogous to the database migration system
  if (version < 4) {
    // Run MIGRATIONS[2].upgradeLocalStorage(state)
  }
  return state;
}
```

---

## 6. Reactive Data Reads

Stores do not hold full data lists. Components subscribe to IndexedDB directly using `useLiveQuery()`:

```typescript
// In a component
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const positions = useLiveQuery(
  () => db.positions.where('status').equals('OPEN').toArray(),
  []  // dependencies
);
```

How `useLiveQuery` works:
- Dexie internally tracks which data ranges the query accessed.
- When a matching data change occurs in IndexedDB, the query is automatically re-executed and the component re-renders.
- No manual subscribe/unsubscribe is needed.

---

## 7. Cross-Store Coordination Pattern

Stores **do not call each other**. Cross-store coordination is orchestrated by the UI layer:

```typescript
// Example: delete a position and clean up its linked transactions (in a component)
const { deletePosition } = usePositionStore();
// deletePosition internally handles the bidirectional reference cleanup on Transactions
await deletePosition(positionId);
```

When operations span multiple stores (e.g. creating a position while updating multiple transactions), the UI component calls each store's action in the correct sequence.
