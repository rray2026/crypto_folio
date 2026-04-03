# 测试体系设计

## 1. 测试技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ~4.0 | 测试运行器（兼容 Jest API） |
| jsdom | — | 模拟浏览器 DOM 环境 |
| fake-indexeddb | ~6.2 | 模拟 IndexedDB（内存实现） |
| @testing-library/react | ~16.3 | React 组件测试工具 |

**运行命令：**
```bash
npm test           # 单次运行所有测试
npm run test:watch # 监听变化并自动重跑
```

---

## 2. 测试环境初始化（`src/setupTests.ts`）

```typescript
// fake-indexeddb 自动 polyfill 浏览器全局 IndexedDB API
import 'fake-indexeddb/auto';

// 为 jsdom 环境提供 crypto.randomUUID()（真实浏览器有，jsdom 没有）
import crypto from 'crypto';
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
  },
});
```

**为什么需要 fake-indexeddb：**
jsdom 不实现 IndexedDB API，而 Dexie 依赖 IndexedDB。`fake-indexeddb` 提供完整的内存实现，使 Store 测试可以真实操作数据库，而不需要 Mock。

**为什么需要 crypto polyfill：**
ID 生成使用 `crypto.randomUUID()`，该方法在 jsdom 环境中不可用，需要从 Node.js `crypto` 模块桥接。

---

## 3. 测试文件组织

```
src/
├── lib/
│   ├── math.test.ts         # 数学工具函数测试
│   ├── metrics.test.ts      # 指标计算测试
│   ├── migrations.test.ts   # 数据库迁移测试
│   ├── backup.test.ts       # 备份/恢复测试
│   ├── db.test.ts           # 数据库兼容性检查测试
│   ├── utils.test.ts        # cn() 工具测试
│   ├── functional.test.ts   # 端到端功能场景测试
│   └── user_cases.test.ts   # 用户使用场景测试
└── store/
    ├── useTransactionStore.test.ts
    ├── usePositionStore.test.ts
    ├── useFundStore.test.ts
    └── useSettingsStore.test.ts
```

**测试就近原则：** 测试文件与被测文件放在同一目录，使用 `*.test.ts` 后缀。

---

## 4. 各测试文件职责

### 4.1 `math.test.ts`

验证 `src/lib/math.ts` 中各数学函数的精度：

```typescript
// 浮点精度测试
it('add(0.1, 0.2) === 0.3', () => {
  expect(add(0.1, 0.2)).toBe(0.3);  // 原生 JS 会失败，Decimal.js 通过
});

// 除数为零
it('div(10, 0) returns 0', () => {
  expect(div(10, 0)).toBe(0);
});

// 负数
it('sub handles negative results', () => {
  expect(sub(1, 5)).toBe(-4);
});
```

### 4.2 `metrics.test.ts`

验证 `getPositionMetrics`、`getFundMetrics`、`getPortfolioMetrics` 的计算逻辑：

```typescript
// 典型 LONG 持仓：买入后部分卖出
it('calculates LONG position metrics correctly', () => {
  const position = buildPosition([
    { type: 'BUY', price: 100, quantity: 10, amount: 1000 },
    { type: 'SELL', price: 150, quantity: 5, amount: 750 },
  ]);
  const metrics = getPositionMetrics(position, txs, { 'BTC/USDT': { price: 120 } });

  expect(metrics.avgBuyPrice).toBe(100);
  expect(metrics.realizedPnL).toBe(250);     // (150-100) × 5
  expect(metrics.unrealizedPnL).toBe(100);   // (120-100) × 5
  expect(metrics.totalPnL).toBe(350);
  expect(metrics.roi).toBeCloseTo(35, 2);    // 350/1000 × 100
});

// 边界：无交易的持仓
it('returns zero metrics for empty position', () => {
  const metrics = getPositionMetrics(emptyPosition, [], {});
  expect(metrics.totalPnL).toBe(0);
  expect(metrics.positionType).toBeNull();
});

// 边界：价格不可用
it('unrealizedPnL is 0 when price unavailable', () => {
  const metrics = getPositionMetrics(position, txs, {});
  expect(metrics.unrealizedPnL).toBe(0);
});
```

### 4.3 `migrations.test.ts`

验证每个版本的迁移转换逻辑：

```typescript
// v1 → v2：Position type 字段回填
it('v1→v2: adds type PRIMARY to positions', () => {
  const v1Payload = {
    version: 1,
    positions: [{ id: '1' }],  // 无 type 字段
  };
  const result = MIGRATIONS[0].upgradePayload(v1Payload);
  expect(result.positions[0].type).toBe('PRIMARY');
});

// v3 → v4：dataSource 重命名
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

端到端测试备份/恢复流程：

```typescript
it('exports and reimports data correctly', async () => {
  // 准备数据
  await db.transactions.add(sampleTx);
  await db.positions.add(samplePosition);

  // 导出（获取 payload，跳过文件下载）
  const payload = await buildExportPayload();
  expect(payload.appName).toBe('CryptoFolio');
  expect(payload.transactions).toHaveLength(1);

  // 清空并导入
  await db.transactions.clear();
  await importFromPayload(payload);

  // 验证数据恢复
  const txs = await db.transactions.toArray();
  expect(txs).toHaveLength(1);
  expect(txs[0].id).toBe(sampleTx.id);
});

it('rejects backup from newer app version', async () => {
  const futurePayload = { version: 999, appName: 'CryptoFolio' };
  await expect(importData(toFile(futurePayload))).rejects.toThrow();
});
```

### 4.5 Store 测试（`store/*.test.ts`）

测试 Store action 的完整性，包括双向引用维护：

```typescript
// useTransactionStore.test.ts
describe('deleteTransaction', () => {
  it('removes transactionId from associated position entries', async () => {
    // 创建交易和持仓，建立关联
    const txId = await addTransaction(sampleTx);
    const posId = await createPosition({ entries: [{ transactionId: txId, allocatedAmount: 100 }] });
    await db.transactions.update(txId, { associatedPositionIds: [posId] });

    // 删除交易
    await deleteTransaction(txId);

    // 验证持仓中的引用已被清除
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

### 4.6 `functional.test.ts` 和 `user_cases.test.ts`

复杂的跨模块场景测试，模拟完整用户操作流程：

```typescript
// user_cases.test.ts 示例
it('complete trading cycle: buy → partial sell → metrics', async () => {
  // 1. 创建买入交易
  const buyTxId = await addTransaction({
    symbol: 'BTC/USDT', type: 'BUY',
    price: 50000, quantity: 1, amount: 50000,
  });

  // 2. 创建持仓并关联交易
  const posId = await createPosition({ symbol: 'BTC/USDT', type: 'PRIMARY', status: 'OPEN' });
  await addTransactionToPosition(posId, { transactionId: buyTxId, allocatedAmount: 50000 });

  // 3. 创建卖出交易
  const sellTxId = await addTransaction({
    symbol: 'BTC/USDT', type: 'SELL',
    price: 60000, quantity: 0.5, amount: 30000,
  });
  await addTransactionToPosition(posId, { transactionId: sellTxId, allocatedAmount: 30000 });

  // 4. 验证指标
  const position = await db.positions.get(posId);
  const txs = await db.transactions.bulkGet([buyTxId, sellTxId]);
  const metrics = getPositionMetrics(position!, txs, { 'BTC/USDT': { price: 55000 } });

  expect(metrics.realizedPnL).toBe(5000);   // (60000-50000) × 0.5
  expect(metrics.unrealizedPnL).toBe(2500); // (55000-50000) × 0.5
  expect(metrics.totalPnL).toBe(7500);
});
```

---

## 5. 测试隔离

每个测试文件（或每个测试套件）应在 `beforeEach` 中清空数据库，确保测试独立：

```typescript
beforeEach(async () => {
  await db.transactions.clear();
  await db.positions.clear();
  await db.funds.clear();
});
```

`fake-indexeddb` 的每次测试文件运行默认共享同一个内存实例，因此必须在每个测试前清空。

---

## 6. 添加新测试的指南

### 何时必须添加测试

- 新增计算逻辑（`lib/` 中的函数）→ 对应的 `*.test.ts`
- 新增 Store action（特别是涉及双向引用的） → 验证关联关系的完整性
- 新增数据库迁移 → 迁移前后数据验证

### 测试覆盖的优先级

1. **必须覆盖**：`math.ts` 的精度、`metrics.ts` 的计算公式、双向引用的删除逻辑、备份/迁移
2. **应该覆盖**：Store action 的 happy path 和常见 edge case
3. **选择性覆盖**：UI 组件（复杂度高，维护成本高，仅对核心交互测试）

### 路径别名

测试文件中使用 `@/` 别名（与源码一致）：
```typescript
import { add } from '@/lib/math';
import { db } from '@/lib/db';
```

Vitest 的 `vite.config.ts` 配置了 `@/` 指向 `src/`，测试环境自动生效。
