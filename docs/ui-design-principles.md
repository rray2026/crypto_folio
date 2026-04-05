# UI Design Principles

This document captures the design system and UI principles established in the premium fintech redesign. All new UI work should follow these conventions for visual consistency.

---

## Color Palette

### Primary Accent: Teal

The primary accent color is **teal**, replacing the default shadcn gray palette.

| Token | Light Mode (HSL) | Dark Mode (HSL) |
|---|---|---|
| `--primary` | `173 58% 38%` | `173 58% 48%` |
| `--accent` | `173 58% 94%` (bg) / `173 58% 30%` (fg) | `222 14% 15%` (bg) / `173 58% 48%` (fg) |
| `--ring` | `173 58% 38%` | `173 58% 48%` |

### Background

- **Light mode**: Cool-tinted white (`210 20% 98%`), not pure white
- **Dark mode**: Deep navy (`222 14% 7%`, approximately `#0c1018`), not pure black

### Cards & Surfaces

- **Light**: Pure white cards (`0 0% 100%`) on cool-tinted background
- **Dark**: Slightly lighter navy (`222 14% 10%`) for card surfaces

### PnL Colors

Use **emerald/red** consistently for profit/loss — never `text-green-500`/`text-destructive`:

```tsx
// Correct
const pnlColor = (v: number) =>
    v > 0 ? 'text-emerald-500 dark:text-emerald-400'
  : v < 0 ? 'text-red-500 dark:text-red-400'
  : 'text-foreground';

// Incorrect — do not use
'text-green-500'       // too bright, inconsistent
'text-destructive'     // semantically wrong for financial loss
```

### Chart Colors

Charts use a coordinated 5-color scheme anchored on teal:

| Token | Purpose | Light HSL | Dark HSL |
|---|---|---|---|
| `--chart-1` | Primary (teal) | `173 58% 38%` | `173 58% 48%` |
| `--chart-2` | Blue | `221 83% 53%` | `221 83% 63%` |
| `--chart-3` | Green | `142 71% 45%` | `142 71% 48%` |
| `--chart-4` | Amber | `38 92% 55%` | `38 92% 58%` |
| `--chart-5` | Red | `0 72% 51%` | `0 72% 58%` |

---

## Typography

### General

- Use `tracking-tight` for headings and titles
- Use `font-mono` for all numeric/financial values
- Use `lining-nums` for price displays to ensure uniform digit height

### Label Hierarchy

| Level | Style | Usage |
|---|---|---|
| Section label | `text-[10px] text-muted-foreground uppercase tracking-wider` | Metric labels (Holdings, PnL, ROI) |
| Card title | `text-sm font-semibold tracking-tight text-foreground` | Position names, card headers |
| Large metric | `font-mono font-bold text-lg leading-none` | Primary PnL/ROI values |
| Small metric | `font-mono text-sm font-semibold` | Secondary values (price, holdings) |
| Pair symbol | `text-xs font-bold text-foreground uppercase tracking-wider` | Trading pair labels |
| Timestamp | `text-[10px] text-muted-foreground/60` | Sync times, secondary info |

### Mobile Header

- Title: `text-[15px] font-semibold tracking-tight` (not the default `text-base`)

---

## Spacing & Layout

### Border Radius

- Default radius: `0.625rem` (10px) — slightly larger than shadcn default of `0.5rem`
- Cards: `rounded-xl` (12px)
- Badges: `rounded-md` (not `rounded-full`)
- Icon containers: `rounded-lg`
- Scrollbar thumb: `rounded-full`

### Sidebar

- Width: `w-60` (240px, narrower than the original `w-64`)
- Nav item spacing: `space-y-0.5` (tight)
- Nav padding: `px-3 py-2.5`
- Logo area: icon in `h-8 w-8 rounded-lg bg-primary/10` container + branded text

### Card Padding

- Card header: `px-4 pt-3 pb-3`
- Card body: `px-4 pt-3 pb-4`
- Summary card cells: `p-5` with `gap-1.5`
- Section dividers inside cards: `border-t border-border/30`

---

## Component Patterns

### Badges

All badges use a consistent pattern:

```tsx
<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-{color}-500/10 text-{color}-600 dark:text-{color}-400 border border-{color}-200/50 dark:border-{color}-800/40">
    <Icon className="h-2.5 w-2.5" />
    LABEL
</span>
```

Badge color assignments:
- **LONG**: emerald
- **SHORT**: red
- **ACTIVE status**: primary (teal) — `bg-primary/10 text-primary border-primary/20`
- **CLOSED status**: muted — `bg-muted text-muted-foreground border-border`
- **Fund**: violet — `bg-violet-500/10 text-violet-600`
- **SHADOW**: muted — `bg-muted text-muted-foreground border-border`

### Cards (PositionCard)

- Use plain `<div>` with `rounded-xl border` instead of shadcn `<Card>` for position cards
- Top accent bar: `h-0.5 w-full` colored by PnL state (emerald/red/primary/border)
- Hover: `hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5`
- Transition: `transition-all duration-200`
- Shadow positions: `border-dashed border-border/60`

### Dashboard Price Ticker

- Asset icon chip: `h-8 w-8 rounded-lg bg-primary/10` with 3-letter symbol text
- Arrow indicator: `<ArrowUpRight>` icon in muted color, transitions to primary on hover
- Grid layout: `grid grid-cols-1 sm:grid-cols-2 gap-3`

### Summary Cards

- Grid with dividers: `grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/40`
- Each cell centered: `flex flex-col items-center justify-center text-center gap-1.5`
- Icons: `h-3.5 w-3.5 text-muted-foreground/70` (smaller, muted)
- Loading skeleton: `rounded-lg bg-muted animate-pulse`

---

## Navigation

### Sidebar (Desktop)

- Active state: `bg-primary/10 text-primary` (teal tint, not solid fill)
- Inactive state: `text-muted-foreground hover:bg-secondary hover:text-foreground`
- Transition: `duration-150`
- Logo: `TrendingUp` icon in teal container + "Crypto" (foreground) + "Folio" (primary)
- Footer: privacy tagline — `text-[10px] text-muted-foreground/50 uppercase tracking-widest`

### Mobile Bottom Nav

- Active: `text-primary` with a top accent bar (`h-0.5 w-6 rounded-full bg-primary`)
- Inactive: `text-muted-foreground hover:text-foreground`

### Mobile Header

- Backdrop: `bg-card/98 backdrop-blur-md` (stronger blur, higher opacity than default)

---

## Scrollbar

Custom webkit scrollbar for a refined look:

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { @apply bg-border rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-muted-foreground/40; }
```

---

## Interaction & Motion

- Card hover lift: `hover:-translate-y-0.5` (subtle, 2px)
- Transition duration: `duration-200` for cards, `duration-150` for nav items
- Active indicator pulse: `animate-pulse` on the status circle dot
- Color transitions: `transition-colors` on links and interactive text

---

## Key Principles Summary

1. **Teal-anchored palette** — primary accent is teal across light and dark modes
2. **Emerald/Red for PnL** — never use generic green or `destructive` for financial values
3. **Cool-tinted neutrals** — backgrounds have a subtle blue/navy tint, not pure gray
4. **Consistent label style** — `10px uppercase tracking-wider` for all metric labels
5. **Monospace for numbers** — all financial values use `font-mono` for alignment
6. **Subtle card elevation** — accent bars, soft shadows, gentle hover lifts
7. **Refined badge system** — `rounded-md` with color-coded bg/text/border per semantic role
8. **Tight, intentional spacing** — smaller icons, tighter nav, more padding in content areas
9. **Privacy-first branding** — sidebar footer, minimal chrome, no unnecessary decoration
10. **Dark mode first** — deep navy base, brighter accent variants for dark mode readability
