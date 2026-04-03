# Routing and Pages Design

## 1. Route Structure

Uses React Router v7 (browser mode). Routes are configured in `src/App.tsx`:

```
/                           → Dashboard
/positions                  → Positions list
/positions/:id              → PositionDetails
/transactions               → Transactions list
/transactions/:id           → TransactionDetails
/assets/:symbol             → AssetDetails
/funds                      → Funds list
/funds/:id                  → FundDetails
/settings                   → Settings
/settings/trading-pairs     → TradingPairs
/glossary                   → Glossary
```

All routes are wrapped by `AppLayout`, sharing the same navigation shell.

---

## 2. Layout Architecture

### 2.1 AppLayout

`src/components/layout/AppLayout.tsx` is the top-level layout component:

```
┌─────────────────────────────────────────────────────┐
│ Desktop:                                            │
│ ┌──────────┬──────────────────────────────────────┐ │
│ │          │                                      │ │
│ │ Sidebar  │  <Outlet /> (current route page)     │ │
│ │ (fixed)  │                                      │ │
│ │          │                                      │ │
│ └──────────┴──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Mobile:                                             │
│ ┌─────────────────────────────────────────────────┐ │
│ │ MobileHeader (dynamic top bar)                  │ │
│ ├─────────────────────────────────────────────────┤ │
│ │                                                 │ │
│ │ <Outlet /> (current route page)                 │ │
│ │                                                 │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ MobileNav (bottom tab bar)                      │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Responsive breakpoint: `md` (768 px) and above shows the Sidebar; below that switches to the mobile layout.

### 2.2 Sidebar (desktop navigation)

`src/components/layout/Sidebar.tsx`

- Fixed on the left; contains navigation links for all primary routes.
- Uses `NavLink` to highlight the active route.
- Includes the logo and build date (injected via Vite's `__BUILD_DATE__`).
- Settings link is pinned at the bottom.

**Navigation items:**

| Icon | Label | Route |
|---|---|---|
| LayoutDashboard | Dashboard | `/` |
| TrendingUp | Positions | `/positions` |
| ArrowLeftRight | Transactions | `/transactions` |
| Wallet | Funds | `/funds` |
| Settings | Settings | `/settings` |

### 2.3 MobileHeader (mobile top bar)

`src/components/layout/MobileHeader.tsx`

- Fixed at the top; fixed height (e.g. 56 px).
- Content is **dynamic**: set by the current page via the `useMobileHeader()` hook.
- Structure: `[left action] [centered title] [right actions]`

### 2.4 MobileNav (mobile bottom tab bar)

`src/components/layout/MobileNav.tsx`

- Fixed at the bottom; 5 icon tabs (Dashboard / Positions / Transactions / Funds / Settings).
- Active tab is highlighted.
- Tapping a tab navigates to the corresponding route.

---

## 3. Mobile Dynamic Header System

### 3.1 Motivation

Each page on mobile has a different title and different action buttons in the top bar (e.g. Positions has a "New" button top-right; details pages have a "Back" button top-left). The header must be configured dynamically per page.

This is implemented with a Context + Hook pattern to avoid threading props through the router.

### 3.2 Implementation

```typescript
// src/contexts/MobileHeaderContextDefinition.ts
interface MobileHeaderConfig {
  title: string;
  leftAction?: ReactNode;   // Typically a back button
  rightActions?: ReactNode; // Typically action buttons (new, edit, etc.)
}

// src/contexts/MobileHeaderContext.tsx
const MobileHeaderContext = createContext<{
  config: MobileHeaderConfig;
  setMobileHeader: (config: MobileHeaderConfig) => void;
}>(/* ... */);

export function MobileHeaderProvider({ children }) {
  const [config, setConfig] = useState<MobileHeaderConfig>({ title: '' });
  return (
    <MobileHeaderContext.Provider value={{ config, setMobileHeader: setConfig }}>
      {children}
    </MobileHeaderContext.Provider>
  );
}

// src/hooks/useMobileHeader.ts
export function useMobileHeader() {
  return useContext(MobileHeaderContext);
}
```

### 3.3 Usage in a page component

```typescript
function PositionDetails() {
  const { setMobileHeader } = useMobileHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileHeader({
      title: 'Position Details',
      leftAction: (
        <button onClick={() => navigate(-1)}>
          <ChevronLeft />
        </button>
      ),
      rightActions: (
        <button onClick={openEditDialog}>
          <Edit2 />
        </button>
      ),
    });
  }, [setMobileHeader, navigate, openEditDialog]);

  // ...
}
```

`MobileHeaderProvider` wraps inside `AppLayout`, so all child pages can access it.

---

## 4. Page-by-Page Feature Reference

### 4.1 Dashboard (`/`)

**Features:**
- Displays real-time prices for pinned pairs.
- Shows global portfolio metrics (totalPnL, globalROI, winRate).
- Supports time range filter (1M / 3M / 6M / 1Y / ALL).

**Data flow:**
1. Read `pinnedPairs` and `prices` from `useSettingsStore`.
2. Call `fetchPrices()` on mount.
3. Read all PRIMARY positions from IndexedDB; call `getPortfolioMetrics()`.
4. Pull-to-refresh triggers `fetchPrices({ force: true })`.

### 4.2 Positions (`/positions`)

**Features:**
- Position list grouped by status (OPEN / CLOSED).
- Search/filter by symbol or strategy name.
- Each position card shows `PositionMetrics` (ROI, P&L, etc.).
- Create a new position (opens `PositionForm` dialog).

**Note:** The list page calls `getPositionMetrics()` for every position, which requires current prices. On mount, prices for all OPEN position symbols are fetched in batch.

### 4.3 PositionDetails (`/positions/:id`)

**Features:**
- Full position information: metrics, linked transactions, journal.
- Add / remove linked transactions.
- Close / reopen the position.
- Edit position metadata (name, strategy, notes).
- Edit the trading journal.

**Data loading:**
```typescript
const position = useLiveQuery(
  () => db.positions.get(id),
  [id]
);
const linkedTxs = useLiveQuery(
  () => db.transactions
    .where('id').anyOf(position?.entries.map(e => e.transactionId) ?? [])
    .toArray(),
  [position]
);
```

### 4.4 Transactions (`/transactions`)

**Features:**
- Transaction list sorted by date descending.
- Multi-dimension filters: time range, type, symbol, linked status.
- Bulk select → create position.
- Manual single-entry form.
- Bulk file import (CSV / Excel).
- AI-assisted import.

### 4.5 Funds (`/funds`)

**Features:**
- Fund list; each `FundCard` shows NAV and change percentage.
- Create a new fund.

### 4.6 FundDetails (`/funds/:id`)

**Features:**
- Fund details: NAV chart, metrics.
- Linked positions list.
- Assign positions to the fund (`assignPositionToFund`).

### 4.7 Settings (`/settings`)

**Features:**
- Theme switcher (dark / light / system).
- Data backup (download JSON).
- Data restore (upload JSON).
- Database version info and compatibility status.
- App version and build date.

### 4.8 TradingPairs (`/settings/trading-pairs`)

**Features:**
- Manage the predefined trading pair list.
- Configure Exchange and data provider per pair.
- Pin / unpin pairs to the dashboard.
- Live test price fetching (refresh button per pair).

### 4.9 AssetDetails (`/assets/:symbol`)

**Features:**
- All positions filtered by the given symbol.
- Symbol-level aggregate metrics.

### 4.10 Glossary (`/glossary`)

- Static page showing definitions and calculation formula explanations.

---

## 5. Theme Management

Theme is managed exclusively by `useSettingsStore`. `App.tsx` watches for changes and applies them to the `<html>` element:

```typescript
// src/App.tsx
function ThemeApplier() {
  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return null;
}
```

Tailwind uses the `class` strategy (`darkMode: 'class'`), so all `dark:` prefixed utilities take effect whenever the `<html>` element carries the `dark` class.

**Rule: read and write the theme only through `useSettingsStore`. Never manipulate `document.documentElement` directly.**
