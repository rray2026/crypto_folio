# CryptoFolio Documentation Hub

Welcome to the central documentation for CryptoFolio. This hub provides both user-centric guides and technical implementation details.

## 📖 User Guides (How-to)

Our guides are designed to help you master the application from a functional perspective.

1. [**Market Watch & Dashboard**](guides/01-market-watch.md): Tracking real-time prices and pinned assets.
2. [**Transaction Mastery**](guides/02-transaction-mastery.md): Logging trades and mastering Binance bulk imports.
3. [**Position Strategies**](guides/03-position-strategies.md): Understanding Strategic (Primary) vs. Analysis (Shadow) positions.
4. [**Performance Analytics**](guides/04-performance-analytics.md): Deep dive into Global ROI, Win Rate, and time filtering.
5. [**Data Security & UI**](guides/05-data-security.md): Managing backups, restores, and theme settings.
6. [**Glossary (名词解释)**](GLOSSARY.md): Definitions and calculation logic for all metrics.

## 🛠 Technical Reference (Internal)

For developers or advanced users interested in the inner workings of the engine.

- [**Technical Architecture**](architecture.md): Data models, metric engine details, and Price API caching.
- [**Technical Use Cases**](use_cases.md): User flows mapped to system events.
- [**Deployment Guide**](deployment.md): Standard procedures for Cloudflare Pages deployment.

---
*Privacy First. Local Storage. Strategic Insights.*

## Development Guide

### Prerequisites
- Node.js (v18+)
- npm

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.

### Testing
We use **Vitest** for unit and integration testing.
- Run all tests: `npm run test`.
- Run tests in watch mode: `npm run test:watch`.

### Key Directories
- `src/lib`: Core logic, database setup, and metrics.
- `src/store`: Zustand state management.
- `src/pages`: Main UI views.
- `src/components`: Reusable UI components.
