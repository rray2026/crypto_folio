# Metrics Calculation Engine

## 1. Overview

All P&L calculations are centralized in `src/lib/metrics.ts`. The underlying arithmetic uses the Decimal.js wrappers in `src/lib/math.ts` to guarantee financial-grade precision.

**Three primary calculation functions:**

| Function | Input | Output | Use |
|---|---|---|---|
| `getPositionMetrics` | Position + linked transactions + prices | `PositionMetrics` | Complete financial metrics for a single position |
| `getFundMetrics` | Fund + multiple PositionMetrics | `FundMetrics` | NAV statistics at the fund level |
| `getPortfolioMetrics` | All positions + transactions + prices + time range | `PortfolioMetrics` | Global dashboard summary metrics |

---

## 2. Math Utility Layer (`src/lib/math.ts`)

```typescript
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// All functions accept string | number | Decimal and return number
export function add(a, b): number
export function sub(a, b): number
export function mul(a, b): number
export function div(a, b): number  // returns 0 when b=0, no exception thrown
export function getAveragePrice(totalCost, totalQty): number  // = div(cost, qty)
```

**Why not native JS arithmetic:**
```javascript
// Native JS floating-point problem
0.1 + 0.2 === 0.3  // false → 0.30000000000000004
// Decimal.js
new Decimal(0.1).add(0.2).equals(0.3)  // true
```

All monetary values passed between functions must be computed using these helpers. Direct use of `+`, `-`, `*`, `/` on financial amounts is prohibited.

---

## 3. `getPositionMetrics`

### 3.1 Signature

```typescript
function getPositionMetrics(
  position: Position,
  linkedTransactions: Transaction[],
  prices: Record<string, { price: number; currency: string }>
): PositionMetrics

interface PositionMetrics {
  positionType: 'LONG' | 'SHORT' | null;  // null = no transactions
  totalInvestment: number;
  totalRemaining: number;    // Current open quantity
  avgBuyPrice: number;
  avgSellPrice: number;
  breakevenPrice: number;    // Price at which net P&L = 0
  currentPrice: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;          // = realizedPnL + unrealizedPnL
  roi: number;               // As a percentage, e.g. 15.3
  derivedStartDate: number | null;
  derivedEndDate: number | null;
  currency: string;
}
```

### 3.2 Direction detection

The position direction is determined by the **first transaction**:
- First transaction is `BUY` → `LONG`
- First transaction is `SELL` → `SHORT`

```typescript
const sortedTxs = linkedTransactions.sort((a, b) => a.date - b.date);
const positionType = sortedTxs[0]?.type === 'BUY' ? 'LONG' : 'SHORT';
```

### 3.3 LONG position calculation

**Splitting buys and sells:**
```typescript
// Note: entries.allocatedAmount determines each entry's effective quantity
const buyEntries = entries.filter(tx => tx.type === 'BUY');
const sellEntries = entries.filter(tx => tx.type === 'SELL');

// Total buy quantity & total buy cost
const totalBuyQty  = buyEntries.reduce((sum, tx) => add(sum, allocatedQty(tx)), 0);
const totalBuyCost = buyEntries.reduce((sum, tx) => add(sum, entry.allocatedAmount), 0);

// Total sell quantity & total sell revenue
const totalSellQty     = sellEntries.reduce((sum, tx) => add(sum, allocatedQty(tx)), 0);
const totalSellRevenue = sellEntries.reduce((sum, tx) => add(sum, entry.allocatedAmount), 0);
```

**Key metrics:**
```
avgBuyPrice  = totalBuyCost / totalBuyQty
avgSellPrice = totalSellRevenue / totalSellQty

totalRemaining = totalBuyQty - totalSellQty

// Realized P&L: profit from the sold portion
realizedPnL = totalSellRevenue - (avgBuyPrice × totalSellQty)

// Unrealized P&L: floating P&L on remaining holdings at current price
unrealizedPnL = (currentPrice - avgBuyPrice) × totalRemaining

totalPnL = realizedPnL + unrealizedPnL

// Total investment (total buy cost as the baseline)
totalInvestment = totalBuyCost

roi = totalPnL / totalInvestment × 100
```

**Breakeven price:**
```
breakevenPrice = (totalBuyCost - totalSellRevenue) / totalRemaining
```
This is the price at which the remaining holdings must be sold to reach zero net P&L.

- Displays `--` when `totalRemaining ≤ 0` (fully closed) or when the numerator is negative (already recouped the investment).

### 3.4 SHORT position calculation

In a short, direction is reversed: the opening trade is a sell, and subsequent buys are closes.

```
avgSellPrice  = initial sell revenue / initial sell quantity
avgBuyPrice   = buyback cost / buyback quantity

totalRemaining = totalSellQty - totalBuyQty  // open short quantity

// Realized P&L: profit from closed-out short legs (sell high, buy low = positive)
realizedPnL = (avgSellPrice - avgBuyPrice) × closedQty

// Unrealized P&L: floating P&L on remaining short (sell high, current price falling = positive)
unrealizedPnL = (avgSellPrice - currentPrice) × totalRemaining

// Total investment: total sell revenue as the baseline
totalInvestment = totalSellRevenue
```

### 3.5 The role of allocatedAmount

The `allocatedAmount` in `PositionEntry` represents the **monetary amount** of this transaction allocated to the position (not quantity):

```
effective quantity for entry = entry.allocatedAmount / transaction.price
```

This allows the capital from a single transaction to be split across multiple positions, with each position computing its own average cost and P&L based only on its allocated share.

---

## 4. `getFundMetrics`

### 4.1 Signature

```typescript
function getFundMetrics(
  fund: Fund,
  positionMetrics: PositionMetrics[]  // Metrics for all positions in this fund
): FundMetrics

interface FundMetrics {
  currentValue: number;   // Current total net value
  initialNAV: number;     // Initial NAV per share
  currentNAV: number;     // Current NAV per share
  navChangePct: number;   // NAV change (%)
  totalPnL: number;
  assetsValue: number;    // Market value of open position holdings
  cashValue: number;      // Cash portion (currentValue - assetsValue)
}
```

### 4.2 Calculation logic

```
totalPnL      = sum(positionMetrics.map(m => m.totalPnL))
currentValue  = fund.initialAmount + totalPnL

initialNAV    = fund.initialAmount / fund.initialShares
currentNAV    = currentValue / fund.initialShares
navChangePct  = (currentNAV - initialNAV) / initialNAV × 100

// Total market value of open position holdings: sum of (remainingQty × currentPrice)
assetsValue   = sum(openPositions.map(m => m.totalRemaining × m.currentPrice))
cashValue     = currentValue - assetsValue
```

**Why the NAV model:**
Converting absolute P&L into per-share NAV allows meaningful comparison of funds at different scales.

---

## 5. `getPortfolioMetrics`

### 5.1 Signature

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
  winRate: number;         // Win rate (%)
  winningTrades: number;
  closedTrades: number;
  timeThreshold: number;   // Cutoff timestamp for the time filter
}
```

### 5.2 Calculation flow

```
1. Filter: only process positions where type === 'PRIMARY' (SHADOW positions are excluded)

2. Time filter:
   - OPEN positions: included if startDate >= timeThreshold
   - CLOSED positions: included if derivedEndDate >= timeThreshold
   (The time range filters which positions participate; it does not filter by transaction date)

3. Call getPositionMetrics() for each filtered position

4. Aggregate:
   totalRealizedPnL   = sum(metrics.realizedPnL)
   totalUnrealizedPnL = sum(metrics.unrealizedPnL)
   totalInvestment    = sum(metrics.totalInvestment)
   globalROI          = (totalRealizedPnL + totalUnrealizedPnL) / totalInvestment × 100

5. Win rate (CLOSED positions only):
   closedTrades  = count(closed positions)
   winningTrades = count(closed positions where realizedPnL > 0)
   winRate       = winningTrades / closedTrades × 100
```

**Time range → timeThreshold mapping:**

| Range | timeThreshold |
|---|---|
| `'1M'` | `now - 30 days` |
| `'3M'` | `now - 90 days` |
| `'6M'` | `now - 180 days` |
| `'1Y'` | `now - 365 days` |
| `'ALL'` | `0` (no filter) |

---

## 6. Edge Case Handling

| Situation | Handling |
|---|---|
| Position with no transactions | All metrics return 0; `positionType: null` |
| Price unavailable | `currentPrice: 0`, `unrealizedPnL: 0` |
| Division by zero (e.g. qty = 0) | `div()` returns 0; no exception |
| Fully closed position | `totalRemaining: 0`, `unrealizedPnL: 0` |
| Cost fully recouped (negative numerator) | `breakevenPrice` displays as `--` |
| SHADOW positions | Skipped in `getPortfolioMetrics` |

---

## 7. Extension Guide

### Adding a new metric

1. Add the new field to the relevant `*Metrics` interface in `src/lib/metrics.ts`.
2. Compute the value using the helpers from `math.ts`.
3. Add tests covering edge cases in `src/lib/metrics.test.ts`.
4. Read and display the new field in the relevant page component.

### Modifying P&L calculation logic

When changing `getPositionMetrics`, pay close attention to:
- Both the LONG and SHORT branches must be updated.
- The `allocatedAmount` conversion (monetary value → quantity) and whether it needs adjustment.
- Updating expected values in the existing tests.
