# Component Architecture

## 1. Directory Structure

```
src/components/
├── funds/          # Fund-related forms and cards
├── layout/         # Application shell (navigation, headers)
├── positions/      # Position-related forms
├── shared/         # Cross-page reusable display components
├── strategies/     # Strategy-related forms
├── transactions/   # Transaction forms and import flows
└── ui/             # Shadcn/UI base component library (do not hand-edit)
```

---

## 2. Shadcn/UI Base Components (`src/components/ui/`)

These components come from [Shadcn/UI](https://ui.shadcn.com/), built on Radix UI primitives styled with Tailwind CSS.

**Rule: never manually modify any file inside `src/components/ui/`.**

To add a new Shadcn component:
```bash
npx shadcn@latest add <component-name>
```

**Currently installed Shadcn components (partial list):**

| Component | Use |
|---|---|
| `Button` | Button with variants: default / outline / ghost / destructive |
| `Input` | Text input field |
| `Label` | Form label |
| `Dialog` | Modal dialog (Trigger / Content / Header / Footer) |
| `Select` | Dropdown selector |
| `Tabs` | Tab panels |
| `Card` | Card container (Header / Content / Footer) |
| `Badge` | Status label (green / red / gray) |
| `Checkbox` | Checkbox |
| `Popover` | Floating overlay (used by date pickers, etc.) |
| `Calendar` | Calendar component |
| `Command` | Command palette (search + list) |
| `DateTimePicker` | Date-time picker (custom, built on Calendar + Popover) |
| `PullToRefresh` | Pull-to-refresh gesture (mobile) |

---

## 3. Layout Components (`src/components/layout/`)

See the layout architecture section in [06-routing-and-pages.md](./06-routing-and-pages.md) for full details.

| Component | Responsibility |
|---|---|
| `AppLayout` | Top-level container combining Sidebar / MobileHeader / MobileNav / Outlet |
| `Sidebar` | Desktop left-side navigation (fixed width, dark background) |
| `MobileHeader` | Mobile dynamic title bar at the top |
| `MobileNav` | Mobile bottom tab navigation bar |

---

## 4. Shared Display Components (`src/components/shared/`)

### 4.1 PositionCard

Displays a single position summary on the positions list page (`/positions`).

```tsx
interface PositionCardProps {
  position: Position;
  metrics: PositionMetrics;
  onClick?: () => void;
}
```

**Displayed content:**
- Asset symbol + strategy name (from linked Strategy or manual strategyName)
- OPEN / CLOSED status indicator
- Key metrics: ROI, total P&L, current price
- Open date / close date

**Color rules:**
- P&L > 0 → green
- P&L < 0 → red
- P&L = 0 → muted gray

### 4.2 SwipeActions

Reusable swipe-to-reveal action component for mobile card lists (`src/components/shared/SwipeActions.tsx`).

```tsx
interface SwipeActionsProps {
  actions: SwipeAction[];       // Action buttons revealed on swipe
  children: ReactNode;          // The card content
  actionWidth?: number;         // Width per button (default 64px)
  disabled?: boolean;           // Disable swipe (e.g. selection mode)
  className?: string;           // Container classes (default "rounded-xl")
}

interface SwipeAction {
  icon: ReactNode;
  bg: string;                   // Tailwind bg class (e.g. "bg-red-500")
  onAction: () => void;
}
```

**Key implementation details:**
- Touch gesture with direction locking (horizontal vs vertical scroll)
- Dynamic border-radius: full `rounded-xl` when idle, `rounded-l-xl` when swiped (right side becomes square to seamlessly meet action buttons)
- Foreground layer has `bg-background` to prevent color bleed-through from action buttons
- Action buttons container has `rounded-r-xl overflow-hidden`
- Desktop: completely transparent, renders children normally
- Use `className=""` when nested inside an already-rounded parent to avoid shadow clipping

See [UI Design Principles — Mobile Interaction Patterns](../ui-design-principles.md) for full conventions.

### 4.3 TransactionCard

Displays a single transaction in the transaction list. Two layout variants:

- **Desktop**: table row (`TransactionRow`) — hover-reveal action buttons
- **Mobile**: card (`TransactionCard`) — wrapped in `SwipeActions` for swipe-to-reveal Edit and Delete

```tsx
interface TransactionCardProps {
  transaction: Transaction;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  showPosition?: boolean;  // Whether to show linked position info
}
```

**Mobile interaction:**
- Tap: navigate to transaction detail (or toggle selection if in selection mode)
- Swipe left: reveal Edit (amber) and Delete (red) action buttons
- Selection mode: entered via header CheckSquare button (not long-press)

**Displayed content:**
- Date and time
- BUY / SELL type badge (color-coded)
- Symbol
- Quantity, price, total amount
- Fee
- Number of linked positions (if any)

### 4.4 TransactionListHeader

The desktop column header for the transaction list. Defines column widths and labels; used together with `TransactionRow`.

---

## 5. Fund Components (`src/components/funds/`)

### 5.1 FundForm

Form for creating or editing a fund (rendered inside a Dialog).

**Fields:**
- Fund name (required)
- Description (optional)
- Initial capital (required, numeric)
- Initial shares (required, numeric)
- Quote currency (default: USDT)

**Logic:**
- Computes and previews the initial NAV in real time (`initialAmount / initialShares`).
- On submit: calls `useFundStore.createFund()` or `updateFund()`.

### 5.2 FundCard

Single fund card on the funds list page.

**Displayed content:**
- Fund name
- Initial capital vs. current net value
- Initial NAV vs. current NAV
- NAV change % (color-coded)
- Number of linked positions
- ACTIVE / CLOSED status

---

## 6. Position Components (`src/components/positions/`)

### 6.1 PositionForm

Form for creating a new position. Can be triggered by selecting multiple transactions on the list, or opened independently to create an empty position.

**Fields:**
- Symbol (required; dropdown with predefined pairs or custom input)
- Strategy name (optional)
- Associated fund (optional dropdown)
- Notes (optional)

**Pre-fill logic:**
- When triggered from the transaction list with multiple selections, the symbol is pre-filled (all selected transactions must share the same symbol).
- Validation: transactions with different symbols cannot be mixed into the same position.

### 6.2 PositionEditForm

Form for editing an existing position. Fields are similar to `PositionForm`, with the addition of the journal editor:
- Entry reason
- Exit reason
- Mood score (1–5 stars)
- Post-trade review notes

---

## 7. Strategy Components (`src/components/strategies/`)

### 7.1 StrategyForm

Form for creating or editing a strategy (rendered inside a Dialog).

**Fields:**
- Strategy name (required)
- Description (optional, textarea with minimum 120px height)

**Logic:**
- Submit button is disabled when name is empty.
- Enter key in name field moves focus to description field.
- Supports both create mode (no `initialValues`) and edit mode (with `initialValues`).
- On submit: calls `useStrategyStore.createStrategy()` or `updateStrategy()`.

---

## 8. Transaction Components (`src/components/transactions/`)

### 7.1 TransactionForm

Form for manually entering a single transaction.

**Fields:**
- Trading pair (`SymbolSelector` component)
- Type (BUY / SELL toggle)
- Date and time (`DateTimePicker`)
- Price
- Quantity
- Total amount (auto-calculated: `price × quantity`; can be entered manually to back-calculate quantity)
- Fee
- Notes

**Auto-calculation logic:**
- Change price or quantity → automatically updates total amount.
- Change total amount → automatically back-calculates quantity (`amount / price`).
- Uses `math.ts` helpers throughout to maintain precision.

### 7.2 TransactionEditForm

Form for editing an existing transaction. Fields are identical to `TransactionForm`.

**Note:** Editing affects the metrics of all positions that are already linked to this transaction (metrics are computed on the fly, so edits take effect immediately).

### 7.3 SymbolSelector

Trading pair selector component combining Command (search + list) with custom input:

```tsx
interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
}
```

**Behavior:**
- Displays the `predefinedPairs` list, filterable by search.
- Accepts any custom trading pair not in the predefined list.
- Automatically closes the Popover after a selection.

### 7.4 AiImportFlow

AI-assisted import flow (multi-step Dialog):

1. User pastes raw transaction text (from any format).
2. Calls the Claude API to parse the text and extract structured transaction data.
3. Previews the parsed results; user confirms or edits.
4. On confirmation: calls `bulkAddTransactions()` to import.

**Design rationale:** Handles historical data from exchanges in non-standard formats, or manually organized records.

---

## 9. Style Conventions

### Semantic color usage

```typescript
// P&L color
const pnlClass = pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-red-500' : 'text-muted-foreground';

// Transaction type badge
const typeClass = type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
```

### Class merging utility

```typescript
// Use cn() to merge Tailwind class names (resolves conflicts correctly)
import { cn } from '@/lib/utils';

<div className={cn('base-class', condition && 'conditional-class', props.className)} />
```

`cn()` uses `clsx` + `tailwind-merge` internally, correctly handling Tailwind class priority and deduplication.

### Dark mode

All components should provide both light and dark styles:
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

Or use CSS variables (from `src/index.css`):
```tsx
<div className="bg-background text-foreground">
```

---

## 10. Adding New Components

### Adding a feature component

1. Determine the correct directory (`funds/`, `positions/`, `transactions/`, or `shared/`).
2. Use the `@/` path alias for imports.
3. Use `cn()` for class merging.
4. If a Shadcn base component is needed, run `npx shadcn@latest add <name>` first.

### Important rules

- **Never** manually add or modify files inside `src/components/ui/`.
- Prefer CSS variables (`bg-background`, `text-foreground`, etc.) over hardcoded colors to ensure correct dark mode behavior.
- Always format monetary values with `toFixed(2)` or a dedicated formatting utility — never render raw floating-point numbers.
