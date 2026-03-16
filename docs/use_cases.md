# Technical Use Cases & User Flows

This document maps user actions to their technical implementation and data state changes.

## UC1: Transaction Recording & Ingestion

### UC1.1: Manual Entry
- **Action**: User fills `TransactionForm`.
- **System**: 
  1. Generates UUID.
  2. Persists to `db.transactions`.
  3. Updates `TransactionStore` state.

### UC1.2: Binance Bulk Import
- **Action**: User uploads Excel.
- **System**: 
  1. `xlsx` library parses rows into JSON.
  2. **Fee Aggregation**: Child rows (Trades) are summed into the parent Order row.
  3. **ID Mapping**: Binance Order IDs are used to prevent duplicates via IndexedDB unique indexes.

---

## UC2: Strategic Position Management

### UC2.1: Position Creation from Selection
- **Action**: User selects multiple transactions on the list and clicks "Create Position".
- **System**: 
  1. Validates all transactions share the same `Symbol`.
  2. Calculates a "Preview" calculation using `getPositionMetrics` before saving.
  3. Creates `Position` record and creates `PositionEntry` links for all selected IDs.

### UC2.2: Primary vs. Shadow Selection
- **Logic**: 
  - If `PRIMARY`: Tagged for inclusion in global aggregation.
  - If `SHADOW`: Excluded from `getGlobalMetrics` loop.

---

## UC3: Performance Analytics (The Metric Loop)

### UC3.1: Global ROI Calculation
- **Trigger**: Dashboard mount or Time Range shift.
- **System**: 
  1. Fetches all `PRIMARY` positions.
  2. Filters by `derivedEndDate` >= `timeThreshold`.
  3. Sums `realizedPnL` and `unrealizedPnL` using the `add` utility.
  4. Divides by `totalInvestment` to output Global ROI.

### UC3.2: Price Pulse
- **Background**: `setInterval` every 5 mins.
- **System**: 
  1. Identifies all unique symbols in `OPEN` positions.
  2. Batch fetches prices from Binance.
  3. Cascades update to all `PositionDetails` subscribers.
