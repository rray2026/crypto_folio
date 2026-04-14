# 03. Position & Strategy Management

In Folio, a **Position** represents a complete trading thesis (opening → closing) for a specific asset. It is the core container for all profit and loss calculations. A **Strategy** is a separate entity that defines a trading methodology and can be linked to multiple positions.

## Position + Strategy Relationship

- A **Position** can optionally be linked to a **Strategy** via `strategyId`.
- When linked, the Strategy's name is used as the Position's display name.
- A Position can also belong to a **Fund** (via `fundId`) simultaneously — Fund tracks capital, Strategy tracks method.
- Strategies aggregate metrics (win rate, avg ROI, total P&L) across all their linked positions.

## Internal Position Logic

### Smart Tracking Engine
- **Direction Auto-Detection**: Based on the type of the first transaction you link, the position is automatically identified as `LONG` or `SHORT`.
- **Weighted Average Price (Avg Buy)**: The engine computes your current holding cost based on the quantity and price of all buy orders.
- **Realized vs. Unrealized**: Separately displays profit from sold parts (Realized PnL) and floating PnL based on current holdings (Unrealized PnL).

### Precision Operations
- **Multi-Position Splitting**: A single large buy order can be linked to different Positions via allocated amounts to achieve position splitting.
- **Strategy Linking**: Link a position to a Strategy to evaluate your trading methodology's performance across multiple positions.
- **Fund Assignment**: Assign a position to a Fund to track capital allocation and NAV.
- **Close Position**: Manually click "Close" to lock the position's results for archival. The position can be re-opened if needed.

---

> [!IMPORTANT]
> A Position is just a "container." It doesn't generate data; it merely combines and explains existing transaction flows through the **Linking** mechanism. Strategies and Funds are orthogonal organizational layers on top of positions.
