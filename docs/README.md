# Folio Documentation Hub

A privacy-first local cryptocurrency and stock portfolio tracker. All user data is stored in the browser's IndexedDB — no server-side dependency of any kind. Supports Crypto, US Stocks, and CN Stocks markets.

---

## Technical Reference (Developers)

### Core Module Design

| Document | Content |
|---|---|
| [Data Model](technical/01-data-model.md) | Transaction / Position / Fund field definitions, entity relationships, cascade delete rules |
| [Database & Migrations](technical/02-database.md) | Dexie configuration, schema version management, per-version migration logic |
| [State Management](technical/03-state-management.md) | Four Zustand store action designs, reactive query patterns |
| [Metrics Engine](technical/04-metrics-engine.md) | LONG/SHORT P&L calculation, NAV model, global portfolio metrics |
| [Price Fetching](technical/05-price-fetching.md) | Multi-exchange APIs, cache strategy, Yahoo Finance proxy |
| [Routing & Pages](technical/06-routing-and-pages.md) | Route configuration, layout architecture, mobile dynamic header system |
| [Component Architecture](technical/07-components.md) | Component directory structure, responsibilities, style conventions |
| [Backup & Restore](technical/08-backup-restore.md) | Backup file format, import/export flow, cross-version migration |
| [Testing](technical/09-testing.md) | Testing stack, per-test-file responsibilities, writing guide |

### Architecture Overview

- [Technical Architecture](architecture.md) — System design principles, technology choices, key patterns
- [Deployment Guide](deployment.md) — Cloudflare Pages deployment procedure

---

## User Guides

1. [Market Watch & Dashboard](guides/01-market-watch.md) — Real-time price tracking and pinned assets
2. [Transaction Mastery](guides/02-transaction-mastery.md) — Manual entry and bulk import
3. [Position Strategies](guides/03-position-strategies.md) — PRIMARY vs. SHADOW position design
4. [Performance Analytics](guides/04-performance-analytics.md) — ROI, win rate, time range filtering
5. [Data Security & UI](guides/05-data-security.md) — Backup, restore, and theme settings

---

## Glossary

- [GLOSSARY.md](GLOSSARY.md) — Core metric definitions and calculation formulas

---

## Development Quick Reference

```bash
npm run dev          # Start the development server
npm test             # Run tests
npm run lint         # Lint check
npm run build        # Production build (must pass before pushing)
npm run deploy       # Deploy to Cloudflare Pages
```

**Pre-push checklist:**
1. `npm run lint` — no lint errors
2. `npm run build` — build succeeds (includes TypeScript type check)
3. `npm test` — all tests pass

See [CLAUDE.md](../CLAUDE.md) for full development rules.
