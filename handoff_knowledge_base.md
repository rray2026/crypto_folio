# CryptoFolio Project Handoff & Knowledge Base

This document provides essential context, architectural decisions, and current state for the **CryptoFolio** project to ensure continuity when transitioning environments or AI assistants.

## 1. Project Overview
- **Objective**: A high-performance, privacy-focused crypto portfolio tracker using local storage.
- **Tech Stack**:
    - **Frontend**: Vite + React + TypeScript.
    - **State Management**: Zustand (stores located in `src/store/`).
    - **Database**: Dexie.js (IndexedDB) for persistent local storage (`src/lib/db.ts`).
    - **Styling**: Vanilla CSS with a design system inspired by premium modern web apps.
    - **Icons**: Lucide-React.
    - **Testing**: Vitest + fake-indexeddb for integration tests.

## 2. Core Architectural Decisions

### Primary vs. Shadow Positions (The "Double-Counting" Solution)
- **Concept**: A `Position` can be of type `PRIMARY` (Strategic) or `SHADOW` (Analysis).
- **Metric Filtering**: Global portfolio metrics (PnL, ROI) on the `Positions` page **only** calculate data from `PRIMARY` positions.
- **Flexibility**: Users can create overlapping `SHADOW` positions to analyze specific strategies (e.g., "BTC Swing Trading" vs "Long Term BTC") without inflating the total account balance.
- **Conflict Detection**: The UI provides a "Duplicate inclusion" warning if a transaction is added to a `PRIMARY` position when it already exists in another `PRIMARY` position.

### Terminology & State Management
- **Status Lifecycle**: Positions transition from `OPEN` to `CLOSED`.
- **UI Labels**: The UI has been standardized to use financial terminology:
    - `OPEN` -> **UNREALIZED** (Current exposure).
    - `CLOSED` -> **REALIZED** (Locked-in performance).
- **Terminology Update**: Former labels "Active/History" have been completely replaced by "UNREALIZED/REALIZED" across the app, tabs, and glossary.

## 3. Latest Feature Implementations

### Bulk Position Creation
- Users can select multiple transactions in the `Transactions.tsx` list and click "Create Position".
- Symbols are validated to ensure all selected trades belong to the same asset.
- A performance preview (Avg Price, PnL, ROI) is shown during creation.

### Mobile UX & Performance
- **Pull-to-Refresh**: Implemented on the `PositionDetails` page for manual price sync.
- **Input Focus Management**: Supressed auto-focus on mobile dialogs to prevent the keyboard from interrupting the view.
- **Responsive Summary**: The Positions page uses a consolidated "Portfolio Summary" card designed for high density.

## 4. Current State & Setup
- **Build Status**: `npm run build` is passing. Unit tests in `src/lib/user_cases.test.ts` are updated for the latest schema changes.
- **Database Schema**:
    - `Position` interface in `src/lib/types.ts` now includes `type: 'PRIMARY' | 'SHADOW'`.
    - Automated migration tool exists in `Settings.tsx` to upgrade legacy data (missing `type` field).
- **Git State**: All recent features are committed to the `master` branch.

## 5. Implementation Notes for Future Work

### Metric Calculation (Metrics Engine)
- Logic resides in `src/lib/metrics.ts` and `src/lib/math.ts`.
- Uses a volume-weighted average cost basis.
- **Caution**: When adding new features, ensure `SHADOW` positions remain excluded from any global "Total" calculations.

### Known Edge Cases
- **Loose Conflict Resolution**: The system allows a transaction to be in multiple `PRIMARY` positions but warns the user. This was a specific design choice for flexibility.

## 6. Pending Roadmap
- [ ] Implement enhanced charting (Recharts or similar).
- [ ] Add CSV export/import for specific exchange formats.
- [ ] Refine the "Shadow" visual style for even better distinction in dark mode.

---
*Created on 2026-03-15 by Antigravity (Advanced Agentic Coding).*
