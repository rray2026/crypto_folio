# 03. Tactical Position Management (Positions)

In CryptoFolio, a **Position** represents a complete "snipe" (opening -> closing) for a specific currency. It is the core container for all profit and loss calculations.

## Strategic vs. Analysis (Primary vs. Shadow)

When creating a position, you can choose the type:
1. **Strategic (Primary)**: 
   - This is your **real account book**.
   - Its PnL and ROI will be included in the global indicators and win rate statistics at the top of the page.
2. **Analysis (Shadow)**: 
   - This is a **laboratory/shadow position**.
   - You can use it to simulate scenarios such as "what happens if I don't stop loss" or "view the performance of this long-term position separately."
   - **Its data does not interfere with each other** and will not affect your global real statistical indicators.

## Internal Position Logic

### Smart Tracking Engine
- **Direction Auto-Detection**: Based on the type of the first transaction you link, the position is automatically locked as `LONG` or `SHORT`.
- **Weighted Average Price (Avg Entry)**: The engine real-time infers your current holding cost based on the quantity and price of all buy orders.
- **Realized vs. Unrealized**: Discretely displays profit from sold parts (Realized) and floating PnL based on current holding (Unrealized).

### Precision Operations
- **Multi-Position Splitting**: A single large buy order can be linked to different Positions to achieve position splitting.
- **Journaling**: Record your opening logic, mentality, and review notes in the detail page; the system will save them automatically.
- **Close Position**: After the remaining holding returns to zero, manually click "Close," and the battle record will be officially locked and archived.

---

> [!IMPORTANT]
> A Position is just a "container." It doesn't generate data; it merely combines and explains existing transaction flows through the **Linking** mechanism.
