# Data Model Design

This document describes the core data types, entity relationships, and design decisions in CryptoFolio.

## 1. Core Entities

### 1.1 Transaction

`Transaction` is the **atomic unit** of the system — it represents a single real buy or sell action.

```typescript
interface Transaction {
  id: string;                      // UUID, primary key
  date: number;                    // Unix timestamp (ms)
  symbol: string;                  // Trading pair, e.g. "BTC/USDT"
  type: 'BUY' | 'SELL';
  price: number;                   // Execution price
  quantity: number;                // Executed quantity
  amount: number;                  // Total value = price × quantity
  fee: number;                     // Trading fee
  orderId?: string;                // Exchange order ID (used for dedup on import)
  associatedPositionIds: string[]; // Back-reference: linked position IDs
  notes?: string;
}
```

**Design notes:**
- `amount` is stored redundantly (not computed at runtime) to avoid accumulated floating-point errors.
- `orderId` comes from exchange export files (e.g. Binance) and is used for deduplication during bulk import.
- `associatedPositionIds` is one side of the bidirectional relationship — the Transaction actively holds references to Positions so that when a Position is deleted, those references can be cleaned up in reverse.

---

### 1.2 Position

`Position` aggregates multiple Transactions into a single **trading strategy unit** and is the primary subject of P&L calculation.

```typescript
interface Position {
  id: string;                  // UUID, primary key
  symbol: string;              // Trading asset, e.g. "BTC/USDT"
  strategyName?: string;       // Manual strategy label, e.g. "Grid Base"
  status: 'OPEN' | 'CLOSED';
  entries: PositionEntry[];    // Entries linking to transactions
  journal?: PositionJournal;   // Trade journal
  notes?: string;
  startDate: number;           // Open timestamp (Unix ms)
  endDate?: number;            // Close timestamp (set when CLOSED)
  fundId?: string;             // Optional fund association
  strategyId?: string;         // Optional strategy association
}

interface PositionEntry {
  transactionId: string;   // Linked transaction ID
  allocatedAmount: number; // Capital allocated to this entry (supports partial allocation)
}

interface PositionJournal {
  entryReason?: string;  // Reason for opening
  exitReason?: string;   // Reason for closing
  moodScore?: number;    // Emotional score (1–5)
  reviewNotes?: string;  // Post-trade review notes
}
```

**Design notes:**

**Partial Allocation:**
- `PositionEntry.allocatedAmount` allows a **portion of a transaction's value** to be assigned to a given position.
- Example: buying 1 BTC can allocate 0.3 BTC to a "short-term strategy" and 0.7 BTC to a "long-term hold" — each calculates its own average cost and P&L independently.

**OPEN vs. CLOSED:**
- `OPEN`: Position is active; unrealized P&L is calculated using the current market price.
- `CLOSED`: Position has ended; `endDate` is set and the position is included in historical win-rate statistics.

---

### 1.3 Fund

`Fund` is a **capital pool** grouping a set of Positions, tracking compound returns using a NAV (Net Asset Value) model.

```typescript
interface Fund {
  id: string;           // UUID, primary key
  name: string;
  description?: string;
  initialAmount: number; // Starting capital (e.g. 10,000 USDT)
  initialShares: number; // Units issued (e.g. 100 shares)
  currency: string;      // Quote currency, default "USDT"
  createdAt: number;     // Creation timestamp (Unix ms)
  status: 'ACTIVE' | 'CLOSED';
}
```

**NAV calculation model:**
- Initial NAV = `initialAmount / initialShares` (e.g. 100 USDT/share)
- Current value = `initialAmount + total P&L of all linked positions`
- Current NAV = `currentValue / initialShares`
- NAV change % = `(currentNAV − initialNAV) / initialNAV × 100`

---

### 1.4 Strategy

`Strategy` is a **trading methodology** that defines how you approach the market. Positions can be linked to a Strategy to measure the method's effectiveness across multiple trades.

```typescript
interface Strategy {
  id: string;           // UUID, primary key
  name: string;         // e.g. "Grid Trading", "Breakout Momentum"
  description?: string; // Free-text description of the methodology
  createdAt: number;    // Creation timestamp (Unix ms)
  status: 'ACTIVE' | 'ARCHIVED';
}
```

**Design notes:**
- A Strategy is independent from a Fund: Fund = "where is the money?" (capital pool), Strategy = "how do I trade?" (methodology).
- A Position can belong to both a Fund and a Strategy simultaneously.
- When a Position is linked to a Strategy, the Strategy's name is used as the Position's display name (overriding `strategyName`).
- Deleting a Strategy clears `strategyId` on all linked Positions (positions are not deleted).

---

## 2. Entity Relationships

```
Transaction ←──────────────────────────────────→ Position
     (associatedPositionIds: string[])      (entries: PositionEntry[])
                    ↑ many-to-many, bidirectional ↑

Position ──────────────────────────────────────→ Fund
     (fundId?: string)
                    ↑ many-to-one, optional ↑

Position ──────────────────────────────────────→ Strategy
     (strategyId?: string)
                    ↑ many-to-one, optional ↑
```

**Relationship summary:**

| Relationship | Direction | Implementation | On delete |
|---|---|---|---|
| Transaction ↔ Position | many-to-many | Transaction.associatedPositionIds + Position.entries | Delete Position: clean Transaction.associatedPositionIds; Delete Transaction: clean Position.entries |
| Position → Fund | many-to-one (optional) | Position.fundId | Delete Fund: clear fundId on all linked Positions |
| Position → Strategy | many-to-one (optional) | Position.strategyId | Delete Strategy: clear strategyId on all linked Positions |

**Why bidirectional references are necessary:**

From the Transaction side (`associatedPositionIds`):
- The transaction list can quickly determine whether a transaction is already linked to a position.
- When a Position is deleted, all affected transactions can be found and updated in reverse.

From the Position side (`entries`):
- The position detail page loads linked transactions directly without a full-table scan.
- Supports precise `allocatedAmount` allocation.

---

## 3. Data Integrity Rules

### Cascade delete rules

**When deleting a Transaction:**
1. Delete the record from `db.transactions`.
2. Find all Positions whose `entries` reference this transaction ID.
3. Remove the entry from each Position's `entries` array.
4. Write the updated Position records back to the database.

**When deleting a Position:**
1. Delete the record from `db.positions`.
2. Find all Transactions whose `associatedPositionIds` contains this Position ID.
3. Remove the Position ID from each Transaction's `associatedPositionIds`.
4. **Do not delete** the Transactions themselves (they are independent data atoms).

**When deleting a Fund:**
1. Delete the record from `db.funds`.
2. Set `fundId = undefined` on all Positions where `fundId === this Fund ID`.

**When deleting a Strategy:**
1. Delete the record from `db.strategies`.
2. Set `strategyId = undefined` on all Positions where `strategyId === this Strategy ID`.

### Consistency guarantees

- All bidirectional reference updates are performed within the same Zustand action (non-transactional, but with a fixed operation order).
- Individual Dexie IndexedDB operations are atomic (single-record updates).
- The test suite covers bidirectional reference consistency (see `src/store/*.test.ts`).

---

## 4. Type Constraints and Boundary Values

| Field | Type | Constraint |
|---|---|---|
| `Transaction.type` | enum | `'BUY' \| 'SELL'` |
| `Position.status` | enum | `'OPEN' \| 'CLOSED'` |
| `Fund.status` | enum | `'ACTIVE' \| 'CLOSED'` |
| `Strategy.status` | enum | `'ACTIVE' \| 'ARCHIVED'` |
| `PositionJournal.moodScore` | number | Integer 1–5 |
| All monetary fields | number | Computed via Decimal.js; never raw float arithmetic |
| All timestamp fields | number | Unix millisecond timestamps |
| All ID fields | string | UUID v4 from `crypto.randomUUID()` |

---

## 5. Schema Evolution History

| Version | Change | Reason |
|---|---|---|
| v1 | Initial schema | — |
| v2 | Position gains `type` field (default PRIMARY); Transaction gains `orderId` | Shadow positions; Binance import deduplication |
| v3 | Fund entity added; Position gains `fundId` | NAV fund feature |
| v4 | pairConfig.dataSource renamed to dataProvider | Naming consistency |
| v5 | pairConfig gains `market` field; settings gain `enabledMarkets` | Multi-market support |
| v6 | Position `type` field removed | Replaced by Strategy entity |
| v7 | Strategy entity added; Position gains `strategyId` | Trading methodology tracking |

See [`02-database.md`](./02-database.md) for details on the migration system.
