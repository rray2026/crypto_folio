# 数据库设计与迁移系统

## 1. 数据库概览

- **引擎**：IndexedDB（浏览器原生）
- **封装库**：[Dexie.js](https://dexie.org/) v4
- **数据库名**：`CryptoFolioDB`
- **当前版本**：4
- **源文件**：`src/lib/db.ts`、`src/lib/migrations.ts`

所有数据完全存储在用户浏览器本地，无任何服务器端持久化。

---

## 2. 数据库 Schema（当前 v4）

```typescript
// src/lib/db.ts
const db = new Dexie('CryptoFolioDB');

db.version(1).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status',
});

db.version(2).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status',
}).upgrade(tx => migrations[0].upgradeIdb(tx));

db.version(3).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status, fundId',  // 新增 fundId 索引
  funds: 'id, status, createdAt',           // 新增 funds 表
}).upgrade(tx => migrations[1].upgradeIdb(tx));

db.version(4).stores({
  transactions: 'id, date, symbol, type',
  positions: 'id, symbol, status, fundId',
  funds: 'id, status, createdAt',
}).upgrade(tx => migrations[2].upgradeIdb(tx));
```

**索引说明：**

| 表 | 索引字段 | 用途 |
|----|---------|------|
| transactions | `id` | 主键，UUID 查找 |
| transactions | `date` | 按时间范围筛选 |
| transactions | `symbol` | 按交易对筛选 |
| transactions | `type` | 按买卖方向筛选 |
| positions | `id` | 主键 |
| positions | `symbol` | 按标的查询 |
| positions | `status` | 过滤 OPEN/CLOSED |
| positions | `fundId` | 查找基金下所有持仓 |
| funds | `id` | 主键 |
| funds | `status` | 过滤 ACTIVE/CLOSED |
| funds | `createdAt` | 按创建时间排序 |

> **注**：Dexie 的 `stores()` 参数仅定义**索引**，不是全部字段。对象的所有字段都会存储，只有在这里声明的字段才可用于 `where()` 查询。

---

## 3. 版本兼容性检查

```typescript
// src/lib/db.ts
export function getDbCompatibilityStatus(
  storedVersion: number
): 'ok' | 'needs-upgrade' | 'incompatible'
```

**返回值含义：**
- `'ok'`：数据库版本与应用版本匹配，或数据库尚不存在（首次使用）。
- `'needs-upgrade'`：数据库版本低于当前应用版本，Dexie 首次访问时会自动触发 upgrade 回调。
- `'incompatible'`：数据库版本**高于**当前应用版本，说明用户用了更新的 App 版本曾写入过数据，当前版本的代码无法安全读取，需要提示用户更新 App。

此检查在应用启动时（`App.tsx`）执行，如遇 `'incompatible'` 会展示警告 UI，阻止正常操作。

---

## 4. 迁移系统设计

### 4.1 设计原则

1. **不可变**：已发布的迁移版本永远不修改，只添加新版本。
2. **双轨迁移**：每次迁移既要处理 **活跃数据库**（IndexedDB 升级），也要处理 **备份文件**（JSON 转换），两者完全独立。
3. **顺序执行**：从旧版到新版逐步应用，不跳跃。

### 4.2 Migration 对象结构

```typescript
// src/lib/migrations.ts
interface Migration {
  description: string;           // 人类可读的变更描述
  upgradePayload: (             // 备份文件的 JSON 转换函数
    payload: BackupPayload
  ) => BackupPayload;
  upgradeIdb: (                 // 活跃 IndexedDB 的升级函数
    tx: Dexie.Transaction
  ) => Promise<void>;
  upgradeLocalStorage?: (       // 可选：localStorage 中 Zustand 持久化状态的转换
    state: unknown
  ) => unknown;
}

export const MIGRATIONS: Migration[] = [
  /* index 0: v1 → v2 */
  /* index 1: v2 → v3 */
  /* index 2: v3 → v4 */
];
```

### 4.3 各版本迁移内容

#### v1 → v2（MIGRATIONS[0]）

**变更：**
- Position 新增 `type` 字段：所有现有持仓默认填充 `'PRIMARY'`。
- Transaction 新增 `orderId` 字段：所有现有交易默认填充 `undefined`（已存在的无法反推）。

**IndexedDB 升级逻辑：**
```typescript
// 遍历所有 positions，为缺少 type 字段的记录添加默认值
const positions = await tx.table('positions').toArray();
await Promise.all(
  positions.map(p =>
    !p.type
      ? tx.table('positions').update(p.id, { type: 'PRIMARY' })
      : Promise.resolve()
  )
);
```

**备份文件转换：**
```typescript
// payload.positions 中每条记录加 type: 'PRIMARY'（如果没有的话）
payload.positions = payload.positions.map(p => ({
  ...p,
  type: p.type ?? 'PRIMARY',
}));
```

---

#### v2 → v3（MIGRATIONS[1]）

**变更：**
- 新增 `funds` 表（IndexedDB 中 Dexie 会自动创建，upgrade 函数不需要额外操作）。
- Position 新增可选 `fundId` 字段：无需回填，默认 `undefined`。

**IndexedDB 升级逻辑：** 无需数据变换（Dexie 会处理表创建）。

**备份文件转换：**
```typescript
// 确保 backup payload 包含空的 funds 数组
payload.funds = payload.funds ?? [];
```

---

#### v3 → v4（MIGRATIONS[2]）

**变更：**
- Settings 中 `pairConfigs[].dataSource` 字段重命名为 `dataProvider`。
- 将旧的 exchange 值（`'NYSE'`、`'NASDAQ'`、`'SSE'`、`'SZSE'`）映射为 `dataProvider: 'Yahoo Finance'`。

**IndexedDB 升级逻辑：** 无 IndexedDB 变更（settings 存储在 localStorage）。

**备份文件转换：**
```typescript
payload.settings?.pairConfigs?.forEach(config => {
  if (config.dataSource) {
    config.dataProvider = config.dataSource;
    delete config.dataSource;
  }
  // 股票交易所映射
  if (['NYSE', 'NASDAQ', 'SSE', 'SZSE'].includes(config.exchange)) {
    config.dataProvider = 'Yahoo Finance';
  }
});
```

**localStorage 升级逻辑：**
```typescript
// 对 Zustand persist 存储的状态同样执行字段重命名
state.pairConfigs = state.pairConfigs?.map(c => ({
  ...c,
  dataProvider: c.dataSource ?? c.dataProvider,
  dataSource: undefined,
}));
```

---

### 4.4 备份迁移入口

```typescript
// src/lib/migrations.ts
export function migratePayload(
  payload: BackupPayload,
  fromVersion: number,
  toVersion: number
): BackupPayload {
  let current = { ...payload };
  for (let v = fromVersion; v < toVersion; v++) {
    current = MIGRATIONS[v - 1].upgradePayload(current);
    current.version = v + 1;
  }
  return current;
}
```

导入备份文件时，`backup.ts` 调用此函数将老版本 JSON 逐步升级到当前版本，然后再写入数据库。

---

## 5. 与 Zustand Store 的关系

Dexie 是唯一的**持久化写入路径**：
- Zustand stores（`useTransactionStore`、`usePositionStore`、`useFundStore`）调用 Dexie 的 `add()`、`put()`、`delete()` 来持久化数据。
- UI 组件通过 `useLiveQuery()`（`dexie-react-hooks`）订阅数据库变化，实现响应式更新。
- Zustand 状态与 IndexedDB 不做双向同步——Store 里不缓存全量数据，而是按需查询。

---

## 6. 添加新版本的操作规程

当需要改变数据结构时：

1. **在 `src/lib/db.ts`** 中，复制最新的 `db.version(N).stores(...)` 块，版本号改为 `N+1`，在 `.stores()` 中修改 schema，添加 `.upgrade(tx => migrations[N-1].upgradeIdb(tx))`。

2. **在 `src/lib/migrations.ts`** 中，向 `MIGRATIONS` 数组末尾追加新的 Migration 对象，实现 `upgradePayload`、`upgradeIdb`，按需实现 `upgradeLocalStorage`。

3. **更新 `DB_VERSION` 常量**（`src/lib/db.ts`）与新版本号一致。

4. **更新 `src/lib/backup.ts`** 中的 `BACKUP_VERSION` 常量。

5. **为新迁移编写测试**（`src/lib/migrations.test.ts`）。

> 永远不要修改已有的迁移条目——它们可能已经在用户浏览器中执行过。
