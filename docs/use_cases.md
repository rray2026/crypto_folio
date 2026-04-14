# Technical Use Cases & User Flows

This document maps user actions to their technical implementation and data state changes.

## UC1: Transaction Recording & Ingestion

### UC1.1: Manual Entry
- **Action**: User fills `TransactionForm`.
- **System**: 
  1. Generates UUID.
  2. Persists to `db.transactions`.
  3. Updates `TransactionStore` state.

### UC1.2: AI-Assisted Import
- **Action**: User copies a pre-built prompt from the app, sends it along with a trade screenshot to any AI assistant (ChatGPT, Claude, etc.), then pastes the AI's JSON response back into the app.
- **System**: 
  1. Displays a hardcoded `AI_PROMPT` with strict JSON schema (orderId, symbol, type, date, price, quantity, amount, fee).
  2. **Parsing**: Strips markdown code fences, parses JSON, validates required fields, coerces types (uppercase symbol, numeric values).
  3. **Preview**: Renders a read-only confirmation table of all extracted transactions for user review.
  4. **Save**: On confirmation, calls `addTransaction()` for each entry, converting date strings to timestamps.

---

## UC2: Position Management

### UC2.1: Position Creation from Selection
- **Action**: User selects multiple transactions on the list and clicks "Create Position".
- **System**: 
  1. Validates all transactions share the same `Symbol`.
  2. Calculates a "Preview" calculation using `getPositionMetrics` before saving.
  3. Creates `Position` record and creates `PositionEntry` links for all selected IDs.

### UC2.2: Strategy Linking
- **Action**: User links a position to a strategy from the position detail page.
- **System**:
  1. Updates `Position.strategyId` via `useStrategyStore.assignPositionToStrategy()`.
  2. Position display name resolves to the Strategy's name.
  3. Strategy metrics (win rate, avg ROI, total P&L) are recalculated to include this position.

### UC2.3: Fund Assignment
- **Action**: User assigns a position to a fund from the position detail page.
- **System**:
  1. Updates `Position.fundId` via `useFundStore.assignPositionToFund()`.
  2. Fund NAV is recalculated to include this position's P&L.

---

## UC3: Strategy Management

### UC3.1: Strategy Creation
- **Action**: User creates a new strategy via the Strategies page.
- **System**:
  1. Generates UUID, sets `status: 'ACTIVE'`, `createdAt: Date.now()`.
  2. Persists to `db.strategies`.

### UC3.2: Strategy Evaluation
- **Action**: User views strategy details to evaluate methodology effectiveness.
- **System**:
  1. Queries all positions where `strategyId === strategy.id`.
  2. Computes per-position metrics via `getPositionMetrics()`.
  3. Aggregates: win rate, avg ROI, total/realized/unrealized PnL, closed/total count.

### UC3.3: Strategy Archival
- **Action**: User archives a strategy that is no longer in use.
- **System**:
  1. Updates `Strategy.status` to `'ARCHIVED'`.
  2. Strategy is hidden from default lists and link menus but remains accessible for historical review.

---

## UC4: Performance Analytics (The Metric Loop)

### UC4.1: Position-Level Metrics
- **Trigger**: PositionDetails page mount.
- **System**: 
  1. Fetches linked transactions via `position.entries`.
  2. Calls `getPositionMetrics(position, linkedTxs, prices)`.
  3. Returns: realizedPnL, unrealizedPnL, totalPnL, roi, avgBuyPrice, avgSellPrice, breakevenPrice.

### UC4.2: Price Pulse
- **Background**: `setInterval` every 5 mins.
- **System**: 
  1. Identifies all unique symbols in `OPEN` positions and pinned pairs.
  2. Batch fetches prices from configured providers.
  3. Cascades update to all `PositionDetails` subscribers.
