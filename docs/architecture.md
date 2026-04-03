# Technical Architecture Overview

This document describes the system design principles, technology choices, and key architectural decisions in CryptoFolio.
For detailed implementation of each module, see the files under `docs/technical/`.

---

## 1. Design Principles

### Privacy First

**Zero backend**: the app's core functionality requires no server. All user data — transactions, positions, and settings — is stored in the browser's local IndexedDB and is never uploaded to any server.

The only network requests are:
- Real-time price fetching (public REST APIs from each exchange)
- A-share and US stock prices, proxied through a Cloudflare Pages Function to work around browser CORS restrictions on Yahoo Finance

### Client-Side SPA

A single-page application built with React 19 + Vite 7, statically hosted on Cloudflare Pages. All routing is handled client-side by React Router; the server only needs to redirect all 404s to `index.html`.

---

## 2. Technology Choices

| Layer | Technology | Reason |
|---|---|---|
| UI framework | React 19 | Mature ecosystem, concurrent features |
| Language | TypeScript (strict mode) | Type safety; `noUnusedLocals` enforced |
| Build tool | Vite 7 | Fast HMR, native ES module support |
| Local storage | IndexedDB (Dexie v4) | GB-scale capacity, indexed queries — more suitable for structured financial data than localStorage |
| State management | Zustand v5 | Lightweight, zero boilerplate, decoupled from Dexie |
| Styling | Tailwind CSS v3 + Shadcn/UI | Atomic classes for rapid development; Radix UI accessibility foundation |
| Financial math | Decimal.js (precision 20) | Eliminates JS floating-point errors for financial-grade accuracy |
| Charts | Recharts | React-friendly, declarative |
| Testing | Vitest + fake-indexeddb | Fast, shares Vite config, enables testing real DB logic |
| Deployment | Cloudflare Pages + Workers | Free CDN hosting; Pages Functions handle CORS |

---

## 3. Data Layer Architecture

```
┌─────────────────────────────────────────────────┐
│                   UI Components                  │
│         (React; reads/writes via Stores)         │
└──────────────────────┬──────────────────────────┘
                       │ action calls
┌──────────────────────▼──────────────────────────┐
│                  Zustand Stores                  │
│  TransactionStore / PositionStore / FundStore    │
│  SettingsStore (persist → localStorage)          │
└──────────────────────┬──────────────────────────┘
                       │ CRUD operations
┌──────────────────────▼──────────────────────────┐
│                 Dexie (IndexedDB)                │
│      transactions / positions / funds tables     │
└─────────────────────────────────────────────────┘

Reactive data flow:
UI ←── useLiveQuery() ── Dexie (auto-subscribes to changes, re-queries)
```

**Key rules:**
- Stores are the **only write path**. UI components never call Dexie directly.
- For reading data, prefer `useLiveQuery()` (reactive). Complex aggregations are done inside store actions.
- Settings use Zustand `persist` to write to localStorage; they do not go through IndexedDB.

---

## 4. Core Module Relationships

```
types.ts          ← All type definitions (single source of truth)
    │
    ├── db.ts         ← Dexie database instance and schema
    │       └── migrations.ts  ← Version upgrade logic
    │
    ├── math.ts       ← Decimal.js wrappers (precision-safe arithmetic)
    │
    ├── metrics.ts    ← P&L / ROI / NAV calculations (depends on math.ts)
    │
    └── backup.ts     ← Import / export (depends on db.ts + migrations.ts)

store/
    ├── useTransactionStore.ts  ← Transaction CRUD (depends on db.ts)
    ├── usePositionStore.ts     ← Position CRUD (depends on db.ts)
    ├── useFundStore.ts         ← Fund CRUD (depends on db.ts)
    └── useSettingsStore.ts     ← Settings + price fetching (localStorage persist)

pages/            ← Route-level pages (depend on store/ + metrics.ts)
components/       ← UI components (depend on store/ + pages/)
```

---

## 5. Key Architectural Decisions and Patterns

### PRIMARY vs. SHADOW Positions (the double-counting problem)

**Problem:** A user may want to analyze the same transaction under multiple strategy lenses (e.g. both a "short-term trade" and a "long-term position" used the same buy). Naively summing everything would double-count assets.

**Solution:**
- `PRIMARY`: real trading strategies. Included in global dashboard statistics.
- `SHADOW`: sandbox strategies. Can reuse transactions already in PRIMARY for "what-if" scenarios, but are completely ignored by global metrics.
- `getPortfolioMetrics` only iterates positions where `type === 'PRIMARY'`.

### Partial Allocation

**Problem:** After buying 1 BTC, the user may want to attribute only 0.3 BTC to a specific strategy.

**Solution:** `PositionEntry.allocatedAmount` stores the **monetary amount** allocated (not quantity). The effective quantity is `allocatedAmount / transaction.price`. The same transaction can be referenced by multiple positions, each with its own `allocatedAmount`.

### Bidirectional Reference Maintenance

**Problem:** Transaction and Position are in a many-to-many relationship; deleting one side must clean up references on the other.

**Solution:**
- `Transaction.associatedPositionIds` (reverse index): allows fast lookup of all positions linked to a transaction.
- `Position.entries` (forward entries): contains `transactionId + allocatedAmount`.
- Store actions (`deleteTransaction` / `deletePosition`) atomically maintain both sides.

### On-the-fly Metric Calculation

**Design choice:** Metrics are not stored in the database; they are computed fresh on demand by `getPositionMetrics()`.

**Trade-offs:**
- Pro: data is always consistent; no sync needed; logic is clear.
- Con: computational overhead for large numbers of positions (acceptable at current scale).
- Optimization: `useLiveQuery()` only triggers recalculation when the underlying data changes.

### Immutable Migrations

Each DB version's migration logic is permanently frozen once released — users' browsers may have already executed it. New requirements always require a new version; old migrations are never edited. See [Database & Migrations](technical/02-database.md).

---

## 6. Deployment Architecture

```
GitHub main/master ──→ GitHub Actions ──→ Cloudflare Pages (production)
GitHub claude/**   ──→ GitHub Actions ──→ Cloudflare Pages (nightly)

Cloudflare Pages hosts:
  /dist/           ← Vite build output (React SPA)
  /api/stock-price ← Cloudflare Pages Function (Yahoo Finance proxy)
```

See [Deployment Guide](deployment.md) for details.

---

## 7. Further Reading

- [Data Model](technical/01-data-model.md)
- [Database & Migration System](technical/02-database.md)
- [State Management](technical/03-state-management.md)
- [Metrics Engine](technical/04-metrics-engine.md)
- [Price Fetching System](technical/05-price-fetching.md)
- [Routing & Pages](technical/06-routing-and-pages.md)
- [Component Architecture](technical/07-components.md)
- [Backup & Restore](technical/08-backup-restore.md)
- [Testing](technical/09-testing.md)
