# 技术架构总览

本文档描述 CryptoFolio 的系统设计原则、技术选型和关键架构决策。
各模块的详细实现请参阅 `docs/technical/` 目录下的专项文档。

---

## 1. 设计原则

### 隐私优先（Privacy First）

**零后端**：应用所有核心功能不依赖任何服务端。用户的交易数据、持仓信息和设置全部存储在浏览器本地 IndexedDB，不会上传到任何服务器。

唯一的网络请求：
- 实时价格获取（调用各交易所的公开 API）
- A 股/美股价格通过 Cloudflare Pages Function 代理 Yahoo Finance（CORS 限制导致需要代理）

### 客户端 SPA

React 19 + Vite 7 构建的单页应用，通过 Cloudflare Pages 静态托管。所有路由由 React Router 在客户端处理，服务端只需将所有 404 重定向到 `index.html`。

---

## 2. 技术选型

| 层次 | 技术 | 选型原因 |
|------|------|---------|
| UI 框架 | React 19 | 生态成熟，并发特性 |
| 语言 | TypeScript（strict 模式） | 类型安全，`noUnusedLocals` |
| 构建 | Vite 7 | 极快的 HMR，ES Module 原生支持 |
| 本地存储 | IndexedDB（Dexie v4） | 容量大（GB 级），支持索引查询，比 localStorage 更适合结构化财务数据 |
| 状态管理 | Zustand v5 | 轻量，无样板代码，与 Dexie 解耦 |
| 样式 | Tailwind CSS v3 + Shadcn/UI | 原子类快速开发，Radix UI 无障碍基础 |
| 财务计算 | Decimal.js（精度 20） | 解决 JS 浮点问题，金融级精度 |
| 图表 | Recharts | React 友好，声明式 |
| 测试 | Vitest + fake-indexeddb | 速度快，与 Vite 同配置，可测试真实 DB 逻辑 |
| 部署 | Cloudflare Pages + Workers | 免费 CDN 托管，Pages Function 处理 CORS |

---

## 3. 数据层架构

```
┌─────────────────────────────────────────────────┐
│                   UI Components                  │
│         (React 组件，读写通过 Store)              │
└──────────────────────┬──────────────────────────┘
                       │ 调用 action
┌──────────────────────▼──────────────────────────┐
│                  Zustand Stores                  │
│  TransactionStore / PositionStore / FundStore    │
│  SettingsStore（persist → localStorage）         │
└──────────────────────┬──────────────────────────┘
                       │ CRUD 操作
┌──────────────────────▼──────────────────────────┐
│                   Dexie（IndexedDB）              │
│    transactions / positions / funds 三张表        │
└─────────────────────────────────────────────────┘

响应式数据流：
UI ←── useLiveQuery() ── Dexie（自动订阅变化，重新查询）
```

**关键规则：**
- Store 是**唯一写入路径**。UI 组件不直接操作 Dexie。
- 读取数据：优先 `useLiveQuery()`（响应式），复杂聚合在 Store action 中完成。
- Settings 使用 Zustand `persist` 存入 localStorage，不走 IndexedDB。

---

## 4. 核心模块关系

```
types.ts          ← 所有类型定义（单一事实来源）
    │
    ├── db.ts         ← Dexie 数据库实例和 Schema
    │       └── migrations.ts  ← 版本升级逻辑
    │
    ├── math.ts       ← Decimal.js 封装（精度安全的四则运算）
    │
    ├── metrics.ts    ← 盈亏/ROI/NAV 计算（依赖 math.ts）
    │
    └── backup.ts     ← 导入/导出（依赖 db.ts + migrations.ts）

store/
    ├── useTransactionStore.ts  ← 交易 CRUD（依赖 db.ts）
    ├── usePositionStore.ts     ← 持仓 CRUD（依赖 db.ts）
    ├── useFundStore.ts         ← 基金 CRUD（依赖 db.ts）
    └── useSettingsStore.ts     ← 设置 + 价格获取（localStorage persist）

pages/            ← 路由页面（依赖 store/ + metrics.ts）
components/       ← UI 组件（依赖 store/ + pages/）
```

---

## 5. 关键架构决策与设计模式

### PRIMARY vs SHADOW 持仓（双计数问题）

**问题：** 用户可能想在多个策略维度分析同一笔交易（如"短线策略"和"长期仓位"都用了同一笔买入），如果简单合计会导致资产被重复计数。

**解决方案：**
- `PRIMARY`：实盘策略，纳入全局仪表盘统计。
- `SHADOW`：沙盒策略，可复用已在 PRIMARY 中的交易，但全局指标完全忽略它。
- 全局指标（`getPortfolioMetrics`）只遍历 `type === 'PRIMARY'` 的持仓。

### 部分分配（Partial Allocation）

**问题：** 买入 1 BTC 后，可能只想将其中 0.3 BTC 算入某个策略。

**解决方案：** `PositionEntry.allocatedAmount` 存储分配的**金额**（不是数量），计算有效数量时 `= allocatedAmount / transaction.price`。同一笔交易可被多个持仓引用，各自使用不同的 `allocatedAmount`。

### 双向引用维护

**问题：** Transaction 和 Position 是多对多关系，删除一侧时需要清理另一侧的引用。

**解决方案：** 
- `Transaction.associatedPositionIds`（反向索引）：允许从交易快速找到所有关联持仓。
- `Position.entries`（正向条目）：包含 transactionId + allocatedAmount。
- Store action（deleteTransaction / deletePosition）负责原子地维护双向引用。

### 指标实时计算

**设计选择：** 指标不存储在数据库，每次需要时实时计算（`getPositionMetrics()`）。

**权衡：**
- 优点：数据永远一致，无需同步，逻辑清晰。
- 缺点：大量持仓时有性能开销（当前规模下可接受）。
- 优化：`useLiveQuery()` 仅在相关数据变化时重新计算。

### 迁移系统的不可变性

每个 DB 版本的迁移逻辑一经发布就不能修改——用户的浏览器可能已经执行过该版本的迁移。新需求必须添加新的版本迁移，不能改旧的。详见 [数据库与迁移文档](technical/02-database.md)。

---

## 6. 部署架构

```
GitHub main/master ──→ GitHub Actions ──→ Cloudflare Pages（生产）
GitHub claude/**   ──→ GitHub Actions ──→ Cloudflare Pages（nightly）

Cloudflare Pages 托管内容：
  /dist/           ← Vite 构建产物（React SPA）
  /api/stock-price ← Cloudflare Pages Function（Yahoo Finance 代理）
```

详见 [部署指南](deployment.md)。

---

## 7. 延伸阅读

- [数据模型详解](technical/01-data-model.md)
- [数据库与迁移系统](technical/02-database.md)
- [状态管理设计](technical/03-state-management.md)
- [指标计算引擎](technical/04-metrics-engine.md)
- [价格获取系统](technical/05-price-fetching.md)
- [路由与页面设计](technical/06-routing-and-pages.md)
- [组件架构](technical/07-components.md)
- [备份与恢复](technical/08-backup-restore.md)
- [测试体系](technical/09-testing.md)
