# CryptoFolio

A **privacy-first** cryptocurrency portfolio tracker — all your trade data lives in your browser's IndexedDB. No accounts. No servers. No data leaves your device.

---

## Features

### Privacy & Data Ownership
- **Zero backend**: every transaction, position, and setting is stored locally in IndexedDB
- **No sign-up required**: open the app and start tracking immediately
- **Full backup/restore**: export a versioned JSON snapshot and restore it on any device

### Transaction Management
- **Manual entry**: record any BUY/SELL with price, quantity, fee, date, and notes
- **Bulk import**: upload a Binance trade-history Excel file — duplicate orders are automatically detected and skipped via Exchange Order IDs
- **AI-assisted import**: paste raw text and let the AI parse it into structured transactions

### Strategic Position Analysis
- **Primary positions**: real strategies included in global portfolio statistics
- **Shadow positions**: what-if sandboxes that reuse the same transactions without distorting your actual P&L
- **Partial allocation**: assign a portion of any transaction to a position via `allocatedAmount`, so a single trade can serve multiple strategies without double-counting

### Performance Metrics
- Weighted average buy/sell price, break-even price
- Realized P&L, unrealized P&L, total ROI
- Win rate across closed positions
- Time-range filtering (7 d / 30 d / 90 d / all time)
- NAV-based fund performance tracking

### Real-Time Prices
Multi-exchange price feeds with a 5-minute cache:

| Exchange | Type |
|---|---|
| Binance | Spot |
| OKX | Spot |
| Bybit | Spot |
| HTX | Spot |
| Gate.io | Spot |
| MEXC | Spot |
| Yahoo Finance | Stocks & ETFs (A-shares, US equities) |

### Fund Management
- Group positions into named funds with an initial NAV
- Track per-fund and cross-fund P&L and share value over time

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run tests
npm test

# Production build
npm run build
```

Open `http://localhost:5173` in your browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + Vite 7 |
| Language | TypeScript (strict mode) |
| Local Database | Dexie v4 (IndexedDB) |
| State Management | Zustand v5 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI) |
| Charts | Recharts |
| Financial Math | Decimal.js (precision 20, `ROUND_HALF_UP`) |
| Testing | Vitest + fake-indexeddb |
| Deployment | Cloudflare Pages + Pages Functions |

---

## Development Workflow

```bash
npm run dev          # Start dev server with HMR
npm test             # Run test suite (Vitest)
npm run test:watch   # Watch mode
npm run lint         # ESLint check
npm run build        # TypeScript type-check + Vite build
npm run deploy       # Build and deploy to Cloudflare Pages
```

**Before every push**, ensure both of these pass — the `pre-push` Husky hook enforces them:

```bash
npm run lint && npm run build
```

---

## Project Structure

```
src/
├── components/
│   ├── funds/          # Fund management UI
│   ├── layout/         # AppLayout, Sidebar, MobileHeader, MobileNav
│   ├── positions/      # Position creation and editing forms
│   ├── shared/         # PositionCard, TransactionCard, TransactionRow
│   ├── transactions/   # Transaction forms, bulk import, AI import
│   └── ui/             # shadcn/ui component library (do not edit manually)
├── lib/
│   ├── backup.ts       # JSON export/import with cross-version migration
│   ├── db.ts           # Dexie database setup and schema versioning
│   ├── math.ts         # Decimal.js arithmetic helpers
│   ├── metrics.ts      # Position and fund metric calculations
│   ├── migrations.ts   # Immutable DB upgrade functions (v1 → v4)
│   └── types.ts        # Core data types (single source of truth)
├── pages/              # Route-level page components
├── store/              # Zustand stores (the only write path to IndexedDB)
└── App.tsx             # Router setup + theme management
functions/
└── api/
    └── stock-price.ts  # Cloudflare Pages Function: Yahoo Finance CORS proxy
docs/                   # Architecture and user-guide documentation
```

---

## Deployment

The app is statically hosted on **Cloudflare Pages**. A Cloudflare Pages Function at `/api/stock-price` proxies Yahoo Finance requests to work around browser CORS restrictions.

| Branch pattern | Environment |
|---|---|
| `main` / `master` | Production |
| `claude/**` | Nightly / preview |

Manual deploy:

```bash
npm run deploy
```

See [`docs/deployment.md`](docs/deployment.md) for full setup instructions.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | Design principles, data-layer diagram, key patterns |
| [Data Model](docs/technical/01-data-model.md) | Entity definitions and relationships |
| [Database & Migrations](docs/technical/02-database.md) | Dexie schema versioning |
| [State Management](docs/technical/03-state-management.md) | Zustand store designs |
| [Metrics Engine](docs/technical/04-metrics-engine.md) | P&L, ROI, and NAV calculations |
| [Price Fetching](docs/technical/05-price-fetching.md) | Multi-exchange APIs and cache strategy |
| [Backup & Restore](docs/technical/08-backup-restore.md) | Export format and import flow |
| [User Guides](docs/guides/) | Step-by-step guides for end users |
| [Glossary](docs/GLOSSARY.md) | Metric definitions and formulas |
