# Glossary

This document defines the core metrics, terms, and their underlying calculation logic used in Folio.

## 1. Data Architecture

### Transaction
The atomic unit of the entire system — a single BUY or SELL order executed on an exchange. Each transaction records: asset symbol, direction (BUY/SELL), price, quantity, date, and fees. Transactions are raw market events and exist independently of any position.

### Position
A trading thesis that aggregates one or more transactions. It links transactions via entries with allocated amounts, computes blended avg cost, realized/unrealized PnL, and ROI across all those trades. A position can optionally belong to a Fund and/or a Strategy.

### Fund
A portfolio container that groups multiple positions under a single capital pool. A fund tracks total capital deployment (Initial Amount), NAV per share, overall PnL, and each position's allocation percentage within the fund. Funds answer the question "How is my capital performing?".

### Strategy
A trading methodology or rule set that defines how you approach the market (e.g., "Grid Trading", "Breakout Momentum"). Strategies are linked to positions to measure execution quality and compare different approaches. Strategies answer the question "Is my method working?".

### Fund vs Strategy
A Fund represents a capital pool ("where is the money?"), while a Strategy represents a trading methodology ("how do I trade?"). A position can belong to both simultaneously.

### Data Hierarchy
Fund → Position → Transaction, with Strategy as an orthogonal dimension. Funds own Positions; Positions link Transactions. Strategies cross-cut this hierarchy — any position can be tagged with a strategy regardless of which fund it belongs to.

---

## 2. Core Financial Metrics

### Avg Buy (Average Entry Price)
The volume-weighted average price of all BUY orders (for LONG) or SELL orders (for SHORT) under this position.
- **Formula**: `Total Entry Amount / Total Entry Quantity`

### Avg Sell (Average Exit Price)
The volume-weighted average price of all completed exit orders.
- **Formula**: `Total Exit Amount / Total Exit Quantity`

### Avg Cost (Breakeven Price)
The price at which remaining holdings must be sold to reach net break-even, accounting for capital already recovered from partial exits.
- **Formula**: `(Total Buy Amount − Total Sell Amount) / Remaining Quantity`
- **Note**: if this value displays as `--`, it typically means the remaining cost basis has gone negative (cost recouped through partial sales), or the holding quantity is 0.

### Unrealized PnL
The floating profit or loss on current holdings, calculated using the real-time market price.
- **Formula**: `(Current Price − Avg Buy) × Remaining Quantity`

### Realized PnL
The profit or loss locked in through sell executions.

### Total PnL
The combined profit or loss, including both realized and unrealized amounts.
- **Formula**: `Realized PnL + Unrealized PnL`

### ROI (Return on Investment)
The percentage return on the capital deployed.
- **Formula**: `Total PnL / Total Invested × 100%`

### Win Rate
The percentage of closed positions that ended with a positive Total PnL. Displayed on the strategy details page.
- **Formula**: `Profitable Closed Positions / Total Closed Positions × 100%`

---

## 3. Fund Metrics

### NAV (Net Asset Value per Share)
The value of a single fund share.
- **Initial NAV**: `initialAmount / initialShares`
- **Current NAV**: `(initialAmount + Total P&L of all linked positions) / initialShares`

### NAV Change %
- **Formula**: `(Current NAV − Initial NAV) / Initial NAV × 100%`

### Assets Value
The total market value of open position holdings within the fund: sum of `(remaining quantity × current price)` across all OPEN positions.

### Cash Value
`Current Fund Value − Assets Value`. Represents the uninvested portion of the fund.

---

## 4. Position Concepts

### OPEN / CLOSED
Position lifecycle states. OPEN means the position is in progress and may have an active balance. CLOSED means the position has been completed — its results are finalized.

### ACTIVE / ARCHIVED
Strategy and Fund lifecycle states. ACTIVE means in use. ARCHIVED means shelved for historical review, hidden from default lists and link menus.

### Allocated Amount
When linking a transaction to a position, the allocated amount defines how much of that transaction's quantity belongs to this position. This allows a single transaction to be split across multiple positions.

### Long Position
Buying an asset with the expectation that its price will increase. You "buy low" and aim to "sell high."

### Short Position
Selling an asset with the expectation that its price will decrease. You "sell high" and aim to "buy back" lower.

### Order ID (orderId)
The original order identifier from the exchange. Used for deduplication when importing bulk trade histories.
