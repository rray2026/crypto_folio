# 数据模型设计

本文档描述 CryptoFolio 的核心数据类型、实体关系及设计决策。

## 1. 核心实体

### 1.1 Transaction（交易记录）

`Transaction` 是系统的**数据原子**，代表一次真实的买卖操作。

```typescript
interface Transaction {
  id: string;                      // UUID，主键
  date: number;                    // Unix 时间戳（毫秒）
  symbol: string;                  // 交易对，如 "BTC/USDT"
  type: 'BUY' | 'SELL';
  price: number;                   // 成交价
  quantity: number;                // 成交数量
  amount: number;                  // 成交总额 = price × quantity
  fee: number;                     // 手续费
  orderId?: string;                // 交易所原始订单 ID（用于去重）
  associatedPositionIds: string[]; // 反向引用：关联的持仓 ID 列表
  notes?: string;
}
```

**设计要点：**
- `amount` 冗余存储（不依赖运行时计算），避免浮点累积误差。
- `orderId` 来自交易所导出文件（如 Binance），用于批量导入时的去重判断。
- `associatedPositionIds` 是双向关系的一侧——Transaction 主动持有对 Position 的引用，以便删除 Position 时可以反向清理。

---

### 1.2 Position（持仓策略）

`Position` 将多笔 Transaction 聚合为一个**交易策略单元**，是盈亏计算的主体。

```typescript
interface Position {
  id: string;                  // UUID，主键
  symbol: string;              // 交易标的，如 "BTC/USDT"
  strategyName?: string;       // 策略名称，如 "网格底仓"
  type: 'PRIMARY' | 'SHADOW'; // 实盘 vs 影随（沙盒）
  status: 'OPEN' | 'CLOSED';
  entries: PositionEntry[];    // 持仓条目（链接到交易）
  journal?: PositionJournal;   // 交易日志
  notes?: string;
  startDate: number;           // 开仓时间（Unix 时间戳毫秒）
  endDate?: number;            // 平仓时间（CLOSED 时设置）
  fundId?: string;             // 可选：归属的基金 ID
}

interface PositionEntry {
  transactionId: string;   // 关联的交易 ID
  allocatedAmount: number; // 该条目分配的金额（支持部分分配）
}

interface PositionJournal {
  entryReason?: string;  // 开仓原因
  exitReason?: string;   // 平仓原因
  moodScore?: number;    // 情绪评分（1-5）
  reviewNotes?: string;  // 复盘笔记
}
```

**设计要点：**

**PRIMARY vs SHADOW 类型：**
- `PRIMARY`：实盘策略，纳入全局仪表盘统计（总盈亏、ROI、胜率）。
- `SHADOW`：影随/沙盒策略，可复用已关联到 PRIMARY 持仓的交易，用于"如果当初那样操作"的假设验证。SHADOW 持仓的数据完全不影响全局指标。

**部分分配（Partial Allocation）：**
- `PositionEntry.allocatedAmount` 允许将同一笔交易的**部分金额**分配给不同持仓。
- 例：买入 1 BTC，可将 0.3 BTC 分给"短期策略"，0.7 BTC 分给"长期囤币"，各自独立计算均价和盈亏。

**OPEN vs CLOSED：**
- `OPEN`：持仓进行中，未实现盈亏按实时价格计算。
- `CLOSED`：持仓已结束，`endDate` 被设置，该持仓纳入历史胜率统计。

---

### 1.3 Fund（基金）

`Fund` 是一组 Position 的**资金池**，使用 NAV（净值）模型跟踪复合收益。

```typescript
interface Fund {
  id: string;           // UUID，主键
  name: string;
  description?: string;
  initialAmount: number; // 初始本金（如 10000 USDT）
  initialShares: number; // 初始份额（如 100 份）
  currency: string;      // 计价货币，默认 "USDT"
  createdAt: number;     // 创建时间（Unix 时间戳毫秒）
  status: 'ACTIVE' | 'CLOSED';
}
```

**NAV 计算模型：**
- 初始 NAV = `initialAmount / initialShares`（如 100 USDT/份）
- 当前净值 = `初始本金 + 所有关联持仓的总盈亏`
- 当前 NAV = `当前净值 / initialShares`
- NAV 涨跌幅 = `(当前 NAV - 初始 NAV) / 初始 NAV × 100%`

---

## 2. 实体关系

```
Transaction ←──────────────────────────────────→ Position
     (associatedPositionIds: string[])      (entries: PositionEntry[])
                    ↑ 多对多双向关系 ↑

Position ──────────────────────────────────────→ Fund
     (fundId?: string)
                    ↑ 多对一，可选 ↑
```

**关系说明：**

| 关系 | 方向 | 实现方式 | 删除行为 |
|------|------|----------|----------|
| Transaction ↔ Position | 多对多 | Transaction.associatedPositionIds + Position.entries | 删除 Position：清理 Transaction.associatedPositionIds；删除 Transaction：清理 Position.entries |
| Position → Fund | 多对一（可选） | Position.fundId | 删除 Fund：清空所有关联 Position 的 fundId |

**双向引用的必要性：**

从 Transaction 侧引用（`associatedPositionIds`）：
- 交易列表页快速判断"该交易是否已关联持仓"
- 删除 Position 时，能反向找到并更新所有相关交易

从 Position 侧引用（`entries`）：
- 持仓详情页直接加载关联交易，无需全表扫描
- 支持 `allocatedAmount` 的精确分配

---

## 3. 数据完整性规则

### 删除级联规则

**删除 Transaction 时：**
1. 从 `db.transactions` 删除记录。
2. 找到所有 `associatedPositionIds` 中包含该 Transaction 的 Position。
3. 从每个 Position 的 `entries` 中移除对应条目。
4. 更新受影响的 Position 记录到数据库。

**删除 Position 时：**
1. 从 `db.positions` 删除记录。
2. 找到所有 `associatedPositionIds` 包含该 Position ID 的 Transaction。
3. 从每个 Transaction 的 `associatedPositionIds` 中移除该 ID。
4. **不删除** Transaction 本身（Transaction 是独立数据）。

**删除 Fund 时：**
1. 从 `db.funds` 删除记录。
2. 将所有 `fundId === 该 Fund ID` 的 Position 的 `fundId` 清空。

### 数据一致性保障

- 所有双向引用的更新在同一个 Zustand action 中完成（虽然非事务性，但操作顺序固定）。
- Dexie 的 IndexedDB 操作本身是原子的（单条记录更新）。
- 测试套件对双向引用的一致性有覆盖（见 `src/store/*.test.ts`）。

---

## 4. 类型约束与边界值

| 字段 | 类型 | 约束 |
|------|------|------|
| `Transaction.type` | 枚举 | `'BUY' \| 'SELL'` |
| `Position.type` | 枚举 | `'PRIMARY' \| 'SHADOW'` |
| `Position.status` | 枚举 | `'OPEN' \| 'CLOSED'` |
| `Fund.status` | 枚举 | `'ACTIVE' \| 'CLOSED'` |
| `PositionJournal.moodScore` | 数字 | 1–5 整数 |
| 所有金额字段 | number | 使用 Decimal.js 计算，不用原生浮点运算 |
| 所有时间字段 | number | Unix 毫秒时间戳 |
| 所有 ID 字段 | string | `crypto.randomUUID()` 生成的 UUID v4 |

---

## 5. 设计演进记录

| 版本 | 变更 | 原因 |
|------|------|------|
| v1 | 初始结构 | — |
| v2 | Position 新增 `type` 字段（默认 PRIMARY）；Transaction 新增 `orderId` | 支持影随持仓；Binance 导入去重 |
| v3 | 新增 Fund 实体；Position 新增 `fundId` | NAV 基金功能 |
| v4 | pairConfig.dataSource 改名为 dataProvider | 命名统一 |

详见 [`02-database.md`](./02-database.md) 迁移系统章节。
