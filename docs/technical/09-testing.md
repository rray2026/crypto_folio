# Testing Architecture

## 1. Testing Stack

| Tool | Version | Purpose |
|---|---|---|
| Vitest | ~4.0 | Test runner (Jest-compatible API) |
| jsdom | — | Simulated browser DOM environment |
| fake-indexeddb | ~6.2 | IndexedDB mock (in-memory implementation) |
| @testing-library/react | ~16.3 | React component testing utilities |

**Commands:**
```bash
npm test           # Single run of all tests
npm run test:watch # Watch mode — re-runs on file changes
```

---

## 2. Test Environment Setup (`src/setupTests.ts`)

```typescript
// fake-indexeddb automatically polyfills the browser global IndexedDB API
import 'fake-indexeddb/auto';

// Provide crypto.randomUUID() for the jsdom environment (present in real browsers, absent in jsdom)
import crypto from 'crypto';
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
  },
});
```

**Why fake-indexeddb:**
jsdom does not implement the IndexedDB API, but Dexie depends on it. `fake-indexeddb` provides a complete in-memory implementation so store tests can exercise real database logic without any mocking.

**Why the crypto polyfill:**
ID generation uses `crypto.randomUUID()`. That method is unavailable in jsdom and must be bridged from Node.js's `crypto` module.

---

## 3. Test File Organization

```
src/
├── lib/
│   ├── math.test.ts         # Math utility function tests
│   ├── metrics.test.ts      # Metrics calculation tests
│   ├── migrations.test.ts   # Database migration tests
│   ├── backup.test.ts       # Backup / restore tests
│   ├── db.test.ts           # Database compatibility check tests
│   ├── utils.test.ts        # cn() utility tests
│   ├── functional.test.ts   # End-to-end functional scenario tests
│   └── user_cases.test.ts   # User use-case scenario tests
└── store/
    ├── useTransactionStore.test.ts
    ├── usePositionStore.test.ts
    ├── useFundStore.test.ts
    └── useSettingsStore.test.ts
```

**Co-location principle:** Test files live in the same directory as the module they test, using the `*.test.ts` suffix.

---

## 4. Test File Responsibilities

### 4.1 `math.test.ts`

Verifies precision of each function in `src/lib/math.ts`:

```typescript
// Floating-point precision
it('add(0.1, 0.2) === 0.3', () => {
  expect(add(0.1, 0.2)).toBe(0.3);  // Fails with native JS; passes with Decimal.js
});

// Division by zero
it('div(10, 0) returns 0', () => {
  expect(div(10, 0)).toBe(0);
});

// Negative results
it('sub handles negative results', () => {
  expect(sub(1, 5)).toBe(-4);
});
```

### 4.2 `metrics.test.ts`

Verifies the calculation logic of `getPositionMetrics`, `getFundMetrics`, and `getPortfolioMetrics`:

```typescript
// Typical LONG position: buy then partially sell
it('calculates LONG position metrics correctly', () => {
  const position = buildPosition([
    { type: 'BUY', price: 100, quantity: 10, amount: 1000 },
    { type: 'SELL', price: 150, quantity: 5, amount: 750 },
  ]);
  const metrics = getPositionMetrics(position, txs, { 'BTC/USDT': { price: 120 } });

  expect(metrics.avgBuyPrice).toBe(100);
  expect(metrics.realizedPnL).toBe(250);     // (150 - 100) × 5
  expect(metrics.unrealizedPnL).toBe(100);   // (120 - 100) × 5
  expect(metrics.totalPnL).toBe(350);
  expect(metrics.roi).toBeCloseTo(35, 2);    // 350 / 1000 × 100
});

// Edge case: position with no transactions
it('returns zero metrics for empty position', () => {
  const metrics = getPositionMetrics(emptyPosition, [], {});
  expect(metrics.totalPnL).toBe(0);
  expect(metrics.positionType).toBeNull();
});

// Edge case: price unavailable
it('unrealizedPnL is 0 when price unavailable', () => {
  const metrics = getPositionMetrics(position, txs, {});
  expect(metrics.unrealizedPnL).toBe(0);
});
```

### 4.3 `migrations.test.ts`

Verifies the transformation logic for each migration version:

```typescript
// v1 → v2: back-fill Position type field
it('v1→v2: adds type PRIMARY to positions', () => {
  const v1Payload = {
    version: 1,
    positions: [{ id: '1' }],  // no type field
  };
  const result = MIGRATIONS[0].upgradePayload(v1Payload);
  expect(result.positions[0].type).toBe('PRIMARY');
});

// v3 → v4: rename dataSource
it('v3→v4: renames dataSource to dataProvider', () => {
  const v3Payload = {
    version: 3,
    settings: { pairConfigs: [{ symbol: 'BTC/USDT', dataSource: 'Binance' }] },
  };
  const result = MIGRATIONS[2].upgradePayload(v3Payload);
  expect(result.settings.pairConfigs[0].dataProvider).toBe('Binance');
  expect(result.settings.pairConfigs[0].dataSource).toBeUndefined();
});
```

### 4.4 `backup.test.ts`

End-to-end tests for the backup and restore flow:

```typescript
it('exports and reimports data correctly', async () => {
  // Prepare data
  await db.transactions.add(sampleTx);
  await db.positions.add(samplePosition);

  // Export (obtain the payload, skip the actual file download)
  const payload = await buildExportPayload();
  expect(payload.appName).toBe('CryptoFolio');
  expect(payload.transactions).toHaveLength(1);

  // Clear and import
  await db.transactions.clear();
  await importFromPayload(payload);

  // Verify data was restored
  const txs = await db.transactions.toArray();
  expect(txs).toHaveLength(1);
  expect(txs[0].id).toBe(sampleTx.id);
});

it('rejects backup from newer app version', async () => {
  const futurePayload = { version: 999, appName: 'CryptoFolio' };
  await expect(importData(toFile(futurePayload))).rejects.toThrow();
});
```

### 4.5 Store tests (`store/*.test.ts`)

Tests for store action correctness, including bidirectional reference maintenance:

```typescript
// useTransactionStore.test.ts
describe('deleteTransaction', () => {
  it('removes transactionId from associated position entries', async () => {
    // Create transaction and position, establish the link
    const txId = await addTransaction(sampleTx);
    const posId = await createPosition({ entries: [{ transactionId: txId, allocatedAmount: 100 }] });
    await db.transactions.update(txId, { associatedPositionIds: [posId] });

    // Delete the transaction
    await deleteTransaction(txId);

    // Verify the reference was removed from the position
    const position = await db.positions.get(posId);
    expect(position?.entries).toHaveLength(0);
  });
});

// useFundStore.test.ts
describe('deleteFund', () => {
  it('clears fundId from all linked positions', async () => {
    const fundId = await createFund(sampleFund);
    const posId = await createPosition({ fundId });

    await deleteFund(fundId);

    const position = await db.positions.get(posId);
    expect(position?.fundId).toBeUndefined();
  });
});
```

### 4.6 `functional.test.ts` and `user_cases.test.ts`

Complex cross-module scenario tests that simulate complete user workflows:

```typescript
// user_cases.test.ts example
it('complete trading cycle: buy → partial sell → metrics', async () => {
  // 1. Create a buy transaction
  const buyTxId = await addTransaction({
    symbol: 'BTC/USDT', type: 'BUY',
    price: 50000, quantity: 1, amount: 50000,
  });

  // 2. Create a position and link the transaction
  const posId = await createPosition({ symbol: 'BTC/USDT', type: 'PRIMARY', status: 'OPEN' });
  await addTransactionToPosition(posId, { transactionId: buyTxId, allocatedAmount: 50000 });

  // 3. Create a sell transaction
  const sellTxId = await addTransaction({
    symbol: 'BTC/USDT', type: 'SELL',
    price: 60000, quantity: 0.5, amount: 30000,
  });
  await addTransactionToPosition(posId, { transactionId: sellTxId, allocatedAmount: 30000 });

  // 4. Verify metrics
  const position = await db.positions.get(posId);
  const txs = await db.transactions.bulkGet([buyTxId, sellTxId]);
  const metrics = getPositionMetrics(position!, txs, { 'BTC/USDT': { price: 55000 } });

  expect(metrics.realizedPnL).toBe(5000);   // (60000 - 50000) × 0.5
  expect(metrics.unrealizedPnL).toBe(2500); // (55000 - 50000) × 0.5
  expect(metrics.totalPnL).toBe(7500);
});
```

---

## 5. Test Isolation

Each test file (or suite) should clear the database in `beforeEach` to guarantee independence:

```typescript
beforeEach(async () => {
  await db.transactions.clear();
  await db.positions.clear();
  await db.funds.clear();
});
```

`fake-indexeddb` shares a single in-memory instance across all tests in a file by default, so the database must be cleared before each test.

---

## 6. Guidelines for Writing New Tests

### When tests are required

- New computation logic (functions in `lib/`) → corresponding `*.test.ts`
- New store actions, especially those involving bidirectional references → verify referential integrity
- New database migration → validate data before and after the migration

### Test coverage priorities

1. **Must cover**: `math.ts` precision, `metrics.ts` formulas, bidirectional reference delete logic, backup and migration
2. **Should cover**: Store action happy paths and common edge cases
3. **Optional**: UI components (high complexity and maintenance cost; cover only critical interactions)

### Path alias

Test files use the `@/` alias (same as source code):
```typescript
import { add } from '@/lib/math';
import { db } from '@/lib/db';
```

The `@/` alias pointing to `src/` is configured in `vite.config.ts` and is automatically available in the test environment.
