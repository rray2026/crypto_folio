# Glossary

This document defines the core metrics, terms, and their underlying calculation logic used in CryptoFolio.

## 1. Position Strategies

### OPEN (Active)
A position that currently holds assets (remaining quantity > 0) or has not yet been manually closed.
- **Status indicator**: typically shown as a green animated dot.

### CLOSED (Archived)
A position whose trading goal has been completed and has been manually marked as closed.
- **Status indicator**: typically shown as a static gray indicator.

### PRIMARY (Real Trade)
A real trading strategy. Its asset value, P&L, and ROI are included in the **global dashboard** portfolio statistics.

### SHADOW (Sandbox / Shadow)
A sandbox or simulation strategy. Used to record observations such as "what if I hadn't stopped the loss" or for pure technical analysis experiments.
- **Key property**: its data does not affect the global portfolio balance or P&L statistics.

---

## 2. Core Financial Metrics

### Avg. Cost (Breakeven Price / Diluted Cost Basis)
This metric uses **breakeven price** logic. It accounts not only for the buy cost but also for the effect that partially sold holdings have on the remaining cost basis.
- **Formula**: `(Total Buy Amount − Total Sell Amount) / Current Remaining Quantity`
- **Meaning**: the price at which the remaining holdings must be sold to reach **net break-even**.
- **Note**: if this value displays as `--`, it typically means you have already recouped your cost through partial sales (the remaining cost basis has gone negative), or the current holding quantity is 0.

### Avg. Exit (Average Sell Price)
The volume-weighted average price of all completed **SELL** orders under this strategy.
- **Formula**: `Total Sell Amount / Total Sell Quantity`

### Unrealized PnL
The floating profit or loss on current holdings, calculated using the real-time market price.
- **Formula**: `(Current Market Price − Avg. Cost) × Current Remaining Quantity`

### Realized PnL
The profit or loss that has been locked in through sell executions.

### ROI (Return on Investment)
The percentage return on the capital deployed in this strategy.
- **Formula**: `(Unrealized PnL + Realized PnL) / Total Buy Amount × 100%`

---

## 3. Transactions

### Allocation (Linkage)
Each transaction on a position detail page can be partially or fully linked to that position.
- **Example**: you buy 1 BTC and can allocate 0.5 BTC to the "Aggressive Trading" strategy and the remaining 0.5 BTC to the "Long-term Hold" strategy. The system calculates the cost basis for each strategy precisely based on the quantity you allocate.

### Order ID (orderId)
The original order identifier from the exchange. Used for deduplication when importing bulk trade histories — re-importing the same file will not create duplicate records.

---

## 4. Fund (NAV Model)

### NAV (Net Asset Value per Share)
The value of a single fund share.
- **Formula**: `Total Fund Value / Total Shares`
- **Initial NAV**: `initialAmount / initialShares`
- **Current NAV**: `(initialAmount + Total P&L of all linked positions) / initialShares`

### NAV Change %
- **Formula**: `(Current NAV − Initial NAV) / Initial NAV × 100%`

### Assets Value
The total market value of open position holdings within the fund: sum of `(remaining quantity × current price)` across all OPEN positions.

### Cash Value
`Current Fund Value − Assets Value`. Represents the uninvested portion of the fund.
