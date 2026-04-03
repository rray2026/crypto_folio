# 指标计算引擎

## 1. 概览

所有盈亏计算集中在 `src/lib/metrics.ts`，底层算术使用 `src/lib/math.ts` 封装的 Decimal.js，确保金融计算精度。

**三个主要计算函数：**

| 函数 | 输入 | 输出 | 用途 |
|------|------|------|------|
| `getPositionMetrics` | Position + 关联交易 + 价格 | `PositionMetrics` | 单个持仓的完整财务指标 |
| `getFundMetrics` | Fund + 多个 PositionMetrics | `FundMetrics` | 基金层面的 NAV 统计 |
| `getPortfolioMetrics` | 所有持仓 + 交易 + 价格 + 时间范围 | `PortfolioMetrics` | 全局仪表盘汇总指标 |

---

## 2. 数学工具层（`src/lib/math.ts`）

```typescript
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// 所有函数接受 string | number | Decimal，返回 number
export function add(a, b): number
export function sub(a, b): number
export function mul(a, b): number
export function div(a, b): number  // b=0 时返回 0，不抛异常
export function getAveragePrice(totalCost, totalQty): number  // = div(cost, qty)
```

**为什么不用原生 JS 运算：**
```javascript
// 原生 JS 浮点问题
0.1 + 0.2 === 0.3  // false → 0.30000000000000004
// Decimal.js
new Decimal(0.1).add(0.2).equals(0.3)  // true
```

所有跨函数传递的财务数值都应使用这套工具计算，禁止用 `+`、`-`、`*`、`/` 直接操作金额。

---

## 3. `getPositionMetrics`

### 3.1 输入与输出

```typescript
function getPositionMetrics(
  position: Position,
  linkedTransactions: Transaction[],
  prices: Record<string, { price: number; currency: string }>
): PositionMetrics

interface PositionMetrics {
  positionType: 'LONG' | 'SHORT' | null;  // null = 无交易
  totalInvestment: number;
  totalRemaining: number;    // 当前未平仓数量
  avgBuyPrice: number;
  avgSellPrice: number;
  breakevenPrice: number;    // 当前回本价
  currentPrice: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;          // = realizedPnL + unrealizedPnL
  roi: number;               // 以百分比表示，如 15.3
  derivedStartDate: number | null;
  derivedEndDate: number | null;
  currency: string;
}
```

### 3.2 方向判断

持仓方向由**第一笔交易**的类型决定：
- 第一笔为 `BUY` → `LONG`（做多）
- 第一笔为 `SELL` → `SHORT`（做空）

```typescript
const sortedTxs = linkedTransactions.sort((a, b) => a.date - b.date);
const positionType = sortedTxs[0]?.type === 'BUY' ? 'LONG' : 'SHORT';
```

### 3.3 LONG 仓位计算

**分拆买入和卖出：**
```typescript
// 注意：entries 中 allocatedAmount 决定各自分配数量
const buyEntries = entries.filter(tx => tx.type === 'BUY');
const sellEntries = entries.filter(tx => tx.type === 'SELL');

// 总买入数量 & 总买入金额
const totalBuyQty = buyEntries.reduce((sum, tx) => add(sum, allocatedQty(tx)), 0);
const totalBuyCost = buyEntries.reduce((sum, tx) => add(sum, entry.allocatedAmount), 0);

// 总卖出数量 & 总卖出金额
const totalSellQty = sellEntries.reduce((sum, tx) => add(sum, allocatedQty(tx)), 0);
const totalSellRevenue = sellEntries.reduce((sum, tx) => add(sum, entry.allocatedAmount), 0);
```

**关键指标：**
```
avgBuyPrice  = totalBuyCost / totalBuyQty
avgSellPrice = totalSellRevenue / totalSellQty

totalRemaining = totalBuyQty - totalSellQty

// 已实现盈亏：卖出部分的盈亏
realizedPnL = totalSellRevenue - (avgBuyPrice × totalSellQty)

// 未实现盈亏：剩余持仓按当前价的浮动盈亏
unrealizedPnL = (currentPrice - avgBuyPrice) × totalRemaining

totalPnL = realizedPnL + unrealizedPnL

// 总投入（以买入总额为基准）
totalInvestment = totalBuyCost

roi = totalPnL / totalInvestment × 100
```

**回本价（Breakeven Price）：**
```
breakevenPrice = (totalBuyCost - totalSellRevenue) / totalRemaining
```
即：剩余持仓需要以此价格卖出才能让总盈亏归零。

- 如果 `totalRemaining ≤ 0`（已完全平仓）或分子为负（已回本），显示 `--`。

### 3.4 SHORT 仓位计算

做空方向相反：第一笔是卖出（开空），后续买入是平仓。

```
avgSellPrice  = 初始卖出总额 / 初始卖出总量
avgBuyPrice   = 买回总额 / 买回总量

totalRemaining = totalSellQty - totalBuyQty  // 尚未平仓的空头数量

// 已实现盈亏：买回部分的盈亏（卖高买低为正）
realizedPnL = (avgSellPrice - avgBuyPrice) × closedQty

// 未实现盈亏：剩余空头按当前价的浮动盈亏
unrealizedPnL = (avgSellPrice - currentPrice) × totalRemaining

// 总投入（以卖出总额为基准，即做空的"本金"）
totalInvestment = totalSellRevenue
```

### 3.5 allocatedAmount 的作用

持仓条目（`PositionEntry`）中的 `allocatedAmount` 表示该笔交易分配给此持仓的**金额**（不是数量）：

```
entry 的有效数量 = entry.allocatedAmount / transaction.price
```

这允许将同一笔交易的资金在多个持仓间分割，每个持仓只计算自己分配到的那部分。

---

## 4. `getFundMetrics`

### 4.1 输入与输出

```typescript
function getFundMetrics(
  fund: Fund,
  positionMetrics: PositionMetrics[]  // 该基金下所有持仓的指标
): FundMetrics

interface FundMetrics {
  currentValue: number;   // 当前净值总额
  initialNAV: number;     // 初始每份净值
  currentNAV: number;     // 当前每份净值
  navChangePct: number;   // NAV 涨跌幅（%）
  totalPnL: number;
  assetsValue: number;    // 持仓资产市值
  cashValue: number;      // 现金部分（currentValue - assetsValue）
}
```

### 4.2 计算逻辑

```
totalPnL      = sum(positionMetrics.map(m => m.totalPnL))
currentValue  = fund.initialAmount + totalPnL

initialNAV    = fund.initialAmount / fund.initialShares
currentNAV    = currentValue / fund.initialShares
navChangePct  = (currentNAV - initialNAV) / initialNAV × 100

// 持仓资产总市值：所有 OPEN 持仓的 (remainingQty × currentPrice)
assetsValue   = sum(openPositions.map(m => m.totalRemaining × m.currentPrice))
cashValue     = currentValue - assetsValue
```

**NAV 模型的意义：**
将绝对盈亏转化为可比较的份额净值，适合衡量不同规模基金的相对表现。

---

## 5. `getPortfolioMetrics`

### 5.1 输入与输出

```typescript
function getPortfolioMetrics(
  positions: Position[],
  transactions: Transaction[],
  prices: Record<string, { price: number }>,
  timeRange: '1M' | '3M' | '6M' | '1Y' | 'ALL'
): PortfolioMetrics

interface PortfolioMetrics {
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalInvestment: number;
  globalROI: number;
  winRate: number;         // 胜率（%）
  winningTrades: number;
  closedTrades: number;
  timeThreshold: number;   // 时间过滤的截止时间戳
}
```

### 5.2 计算流程

```
1. 过滤：只处理 type === 'PRIMARY' 的持仓（SHADOW 不计入全局）

2. 时间过滤：
   - 'OPEN' 持仓：startDate >= timeThreshold 才纳入
   - 'CLOSED' 持仓：derivedEndDate >= timeThreshold 才纳入
   （时间范围仅过滤哪些持仓参与统计，不按交易日期过滤）

3. 为每个过滤后的持仓调用 getPositionMetrics()

4. 汇总：
   totalRealizedPnL   = sum(metrics.realizedPnL)
   totalUnrealizedPnL = sum(metrics.unrealizedPnL)
   totalInvestment    = sum(metrics.totalInvestment)
   globalROI          = (totalRealizedPnL + totalUnrealizedPnL) / totalInvestment × 100

5. 胜率统计（仅 CLOSED 持仓参与）：
   closedTrades  = count(closed positions)
   winningTrades = count(closed positions where realizedPnL > 0)
   winRate       = winningTrades / closedTrades × 100
```

**时间范围到 timeThreshold 的映射：**

| 时间范围 | timeThreshold |
|---------|--------------|
| `'1M'` | `now - 30天` |
| `'3M'` | `now - 90天` |
| `'6M'` | `now - 180天` |
| `'1Y'` | `now - 365天` |
| `'ALL'` | `0`（不过滤）|

---

## 6. 常见边界情况处理

| 情况 | 处理方式 |
|------|---------|
| 无交易的持仓 | 所有指标返回 0，`positionType: null` |
| 价格不可用 | `currentPrice: 0`，`unrealizedPnL: 0` |
| 除数为零（如 qty=0） | `div()` 返回 0，不抛异常 |
| 已完全平仓的持仓 | `totalRemaining: 0`，`unrealizedPnL: 0` |
| 回本后余仓（分子为负） | `breakevenPrice` 显示为 `--` |
| SHADOW 持仓 | `getPortfolioMetrics` 中跳过 |

---

## 7. 扩展指南

### 添加新指标

1. 在 `src/lib/metrics.ts` 对应的 `*Metrics` interface 添加新字段。
2. 在计算函数中用 `math.ts` 工具完成计算。
3. 在 `src/lib/metrics.test.ts` 中添加覆盖边界情况的测试。
4. 在相关页面组件中读取并展示新字段。

### 修改盈亏计算逻辑

涉及 `getPositionMetrics` 时，需特别注意：
- 确认 LONG 和 SHORT 两个分支都已更新。
- `allocatedAmount` 的换算（金额 → 数量）是否需要调整。
- 更新测试中的预期值。
