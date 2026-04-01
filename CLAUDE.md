# Claude Code Rules

## Pre-push Requirements

**Always run `npm run build` before pushing.** This project has a Husky `pre-push` hook that runs `npm run lint && npm run build`, but Claude should also verify both pass before attempting a push.

```bash
npm run lint
npm run build
```

If either fails, fix all TypeScript, lint, and build errors before pushing.

## Development Workflow

1. Make code changes
2. Run `npm run lint` to check for lint errors
3. Run `npm test` to run the test suite
4. Run `npm run build` to verify the build passes
5. Commit and push — the `pre-push` hook will re-run lint + build as a final check

## Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS 3 + shadcn/ui components
- Dexie 4 (IndexedDB) for local storage — **no backend, all data is local**
- Zustand 5 for state management
- Vitest for testing (jsdom environment)
- Cloudflare Pages for deployment (`npm run deploy`)
- Decimal.js for all financial math (never use native JS floats for money)

---

## Project Overview

A privacy-first cryptocurrency portfolio tracker. All user data lives in the browser's IndexedDB — there is no server-side storage. The app supports position tracking, fund management, multi-exchange price fetching, and backup/restore.

---

## Directory Structure

```
src/
├── components/
│   ├── funds/          # Fund management UI
│   ├── layout/         # AppLayout, Sidebar, MobileHeader, MobileNav
│   ├── positions/      # Position form components
│   ├── shared/         # PositionCard, TransactionCard, TransactionRow
│   ├── transactions/   # Transaction forms, import flows, AI import
│   └── ui/             # shadcn/ui component library (do not hand-edit)
├── contexts/           # MobileHeaderContext
├── hooks/              # useMobileHeader
├── lib/
│   ├── backup.ts       # JSON export/import with migration support
│   ├── db.ts           # Dexie database setup, version management
│   ├── math.ts         # Decimal.js arithmetic helpers
│   ├── metrics.ts      # Position and fund metric calculations
│   ├── migrations.ts   # DB schema migrations (v1 → v4)
│   ├── types.ts        # Core data types (source of truth)
│   └── utils.ts        # cn() utility for class merging
├── pages/              # Route-level page components
├── store/              # Zustand stores
├── App.tsx             # Router setup + theme management
├── main.tsx            # React entry point
└── setupTests.ts       # Vitest setup (fake-indexeddb, crypto polyfill)
functions/
└── api/
    └── stock-price.ts  # Cloudflare Pages function: Yahoo Finance CORS proxy
docs/                   # Architecture/deployment documentation
```

---

## Core Data Types (`src/lib/types.ts`)

```typescript
Transaction {
  id, date, symbol, type: 'BUY' | 'SELL',
  price, quantity, amount, fee,
  orderId?,           // exchange order ID (used for dedup on bulk import)
  associatedPositionIds: string[],
  notes?
}

Position {
  id, symbol, strategyName?,
  type: 'PRIMARY' | 'SHADOW',  // SHADOW = what-if positions
  status: 'OPEN' | 'CLOSED',
  entries: PositionEntry[],     // links to transactions
  journal?, notes?, startDate, endDate?, fundId?
}

PositionEntry { transactionId, allocatedAmount }

Fund {
  id, name, description?,
  initialAmount, initialShares, currency,
  createdAt, status: 'ACTIVE' | 'CLOSED'
}
```

**Data relationships:**
- `Transaction` ↔ `Position` is many-to-many via `associatedPositionIds` (on transaction) and `entries` (on position)
- `Position` → `Fund` via `fundId` (optional)

---

## Database (`src/lib/db.ts`)

- **Database**: `CryptoFolioDB`, current version **4**
- Tables: `transactions`, `positions`, `funds`
- Migrations live in `src/lib/migrations.ts` (v1→v2→v3→v4)
- When adding a new DB version: add a schema snapshot, write an upgrade function, increment `DB_VERSION`
- Never modify existing migration versions — always add a new one

---

## State Management (`src/store/`)

Four Zustand stores, each wrapping Dexie operations:

| Store | Responsibility |
|---|---|
| `useTransactionStore` | Transaction CRUD, bulk add with dedup |
| `usePositionStore` | Position CRUD, entry management, open/close |
| `useSettingsStore` | Prices, pair configs, theme, pinned pairs (persisted) |
| `useFundStore` | Fund CRUD, position assignment |

**Key conventions:**
- Stores maintain bidirectional refs (e.g. deleting a position also cleans `associatedPositionIds` on its transactions)
- `useSettingsStore` uses Zustand `persist` middleware (localStorage)
- `fetchPrices()` has a 5-minute cache TTL; use `force: true` to bypass

---

## Financial Math (`src/lib/math.ts`)

**Always use the helpers from `math.ts` for financial calculations — never raw JS arithmetic.**

```typescript
import { add, sub, mul, div, getAveragePrice } from '@/lib/math'
```

All functions use `Decimal.js` with precision 20 and `ROUND_HALF_UP`. Functions accept and return `string | number | Decimal` and return `Decimal`.

---

## Metrics (`src/lib/metrics.ts`)

- `getPositionMetrics(position, linkedTransactions, prices)` → `PositionMetrics`
  - Computes realizedPnL, unrealizedPnL, ROI, avgBuyPrice, avgSellPrice, breakeven
  - Handles both LONG and SHORT positions
- `getFundMetrics(fund, positionMetrics[])` → NAV-based fund stats

---

## Routing (`src/App.tsx`)

```
/                       → Dashboard
/positions              → Positions list
/positions/:id          → PositionDetails
/transactions           → Transactions list
/transactions/:id       → TransactionDetails
/assets/:symbol         → AssetDetails
/funds                  → Funds list
/funds/:id              → FundDetails
/settings               → Settings
/settings/trading-pairs → TradingPairs
/glossary               → Glossary
```

---

## Price Fetching

Supported data providers: Binance, OKX, Bybit, HTX, Gate.io, MEXC, Yahoo Finance (for stocks via Cloudflare function at `/api/stock-price`).

Chinese stock exchanges (SSE `.SS`, SZSE `.SZ`) route through Yahoo Finance.

---

## Testing

```bash
npm test          # run once
npm run test:watch  # watch mode
```

- Environment: jsdom with `fake-indexeddb` (IDB mock) and `globalThis.crypto.randomUUID` polyfill
- Test files live alongside source in `src/lib/*.test.ts` and `src/store/*.test.ts`
- When adding a new module that does computation or data manipulation, add a corresponding test file
- Tests import from `@/lib/...` using the path alias

---

## UI Components

- All shadcn/ui components live in `src/components/ui/` — **do not hand-edit these files**
- Add new shadcn components via `npx shadcn@latest add <component>`
- Use `cn()` from `@/lib/utils` for conditional class merging
- Tailwind dark mode uses the `class` strategy (toggled on `<html>`)
- Custom CSS variables for colors are defined in `src/index.css`

---

## Mobile Layout

- `AppLayout` wraps all pages with `Sidebar` (desktop) + `MobileHeader` + `MobileNav` (mobile)
- Page titles and header actions on mobile are set via the `useMobileHeader` hook
- Use `MobileHeaderContext` for dynamic header content — do not pass props through the router

---

## Backup & Restore (`src/lib/backup.ts`)

- `exportData()`: Downloads a JSON snapshot of all IndexedDB data + settings
- `importData(file)`: Validates app identity, migrates data if needed, then clears and restores the DB
- The backup format is versioned — maintain backward compatibility when changing schemas

---

## Deployment

- **Production**: push to `main`/`master` → GitHub Actions deploys to Cloudflare Pages (`crypto-folio` project)
- **Nightly/Preview**: push to `claude/**` → deploys to nightly environment
- Manual deploy: `npm run deploy`
- Cloudflare config: `wrangler.toml`

---

## Key Conventions

1. **No floats for money** — always use `Decimal.js` via `src/lib/math.ts`
2. **No backend** — all persistence goes through Dexie; stores are the only write path
3. **Path alias** — use `@/` instead of relative imports for `src/` files
4. **TypeScript strict** — `noUnusedLocals` and `noUnusedParameters` are enabled; fix all warnings
5. **Shadcn components** — do not modify files in `src/components/ui/` manually
6. **Migrations** — never edit existing migration versions; always add new ones
7. **Bidirectional refs** — when deleting entities, clean up all cross-references in the same store action
8. **Theme** — read/write theme only through `useSettingsStore`; apply via class on `<html>`
