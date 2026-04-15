# UI Design Principles

This document captures the design system and UI principles established in the premium fintech redesign, now enhanced with **Impressionist-inspired design language**. The Impressionist treatment adds warmth, luminosity, organic texture, and atmospheric layering while preserving readability and usability for financial data.

---

## Impressionist Design Philosophy

The UI translates six core Impressionist art principles into a modern fintech interface:

| Impressionist Principle | UI Translation |
|---|---|
| **Light as Subject** | Warm ambient gradients, glowing accents, primary-hue light diffusion |
| **Pure Color / No Black Shadows** | Primary-hue-tinted shadows, warmer color palette, complementary shadow colors |
| **Visible Brushwork / Texture** | Subtle SVG fractal noise grain overlay on backgrounds |
| **Soft Dissolved Edges** | Gradient-fading accent bars, reduced border opacity, blur effects |
| **Atmospheric Depth** | Layered translucency, backdrop-blur with saturation boost, gradient backgrounds |
| **Spontaneity / Organic Motion** | Slow breathing grain animation, languid transition timing |

---

## Color Palette

### Primary Accent: Theme-selectable (8 options)

The primary accent is selectable via `data-theme-color` attribute (default: Blue). All 8 themes carry matching `--shadow-color` for harmonized colored shadows.

### Background — Warm Impressionist Tones

- **Light mode**: Warm ivory (`38 18% 97%`), not cool gray-white — evokes natural warm light
- **Dark mode**: Warm indigo (`230 12% 8%`), not pure navy — a touch of blue-violet warmth

### Cards & Surfaces

- **Light**: Cream-tinted white cards (`40 20% 99%`) on warm ivory background
- **Dark**: Warm indigo cards (`232 11% 11%`) for atmospheric layering

### PnL Colors — Impressionist Saturation

Use **emerald/rose** consistently for profit/loss, with slightly boosted saturation for Impressionist vibrancy:

- `--pnl-up`: `168 66% 38%` (light) / `168 55% 55%` (dark) — warm saturated emerald
- `--pnl-down`: `350 70% 54%` (light) / `350 58% 68%` (dark) — cadmium rose

```tsx
// Correct — use pnlColor() from styles.ts
import { pnlColor } from '@/lib/styles'
// pnlColor(value) → "text-pnl-up" | "text-pnl-down" | "text-foreground"

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

### Colored Shadow System (Impressionist)

Three shadow tokens replace generic gray drop shadows. Each uses `--shadow-color` which is overridden per theme color variant:

| Token | Usage | Light Mode | Dark Mode |
|---|---|---|---|
| `shadow-ambient` | Default card shadow (via `cardBorder`) | Warm 15% opacity | Primary-hue 8% opacity |
| `shadow-elevated` | Hover / interactive state | Layered warm shadow | Primary-hue glow |
| `shadow-glow` | Accent / decorative glow | 15% primary halo | 20% primary halo |

```css
/* Defined in :root and .dark */
--shadow-ambient: 0 2px 8px -2px hsl(var(--shadow-color) / 0.15);
--shadow-elevated: 0 8px 24px -4px hsl(var(--shadow-color) / 0.12), ...;
--shadow-glow: 0 0 20px -4px hsl(var(--primary) / 0.15);
```

### Canvas Grain Texture (Impressionist)

A faint SVG `feTurbulence` noise overlay creates the "visible brushwork" sensation:
- Applied via `body::before` pseudo-element at `z-index: 1`
- Light mode: 2.5% opacity, dark mode: 3% opacity
- `mix-blend-mode: overlay` for soft blending
- Breathing animation: 20-second opacity cycle (`light-breathe` keyframe)
- `pointer-events: none` — does not interfere with interaction

### Cards (PositionCard)

- Use plain `<div>` with `rounded-xl border` instead of shadcn `<Card>` for position cards
- Top accent bar: `h-0.5 w-full` with **gradient fade** — `bg-gradient-to-r from-transparent via-{color} to-transparent` (Impressionist soft stroke)
- Hover: `hover:border-border hover:shadow-elevated hover:-translate-y-0.5`
- Transition: `transition-all duration-300 ease-out` (slower, organic Impressionist timing)
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

### Sidebar (Desktop) — Impressionist Gradient

- Background: `bg-gradient-to-b from-card via-card to-card/95` (subtle vertical gradient, natural light effect)
- Border: `border-r border-border/30` (softened from solid)
- Active state: `bg-primary/10 text-primary shadow-[inset_0_0_12px_hsl(var(--primary)/0.08)]` (inner glow — "emits light")
- Inactive state: `text-muted-foreground hover:bg-secondary hover:text-foreground`
- Transition: `duration-250` (languid, organic timing)
- Logo: `TrendingUp` icon in primary container + "Folio" (foreground)
- Footer: privacy tagline — `text-[10px] text-muted-foreground/50 uppercase tracking-widest`

### Mobile Bottom Nav — Enhanced Glassmorphism

- Active: `text-primary` with a top accent bar
- Inactive: `text-muted-foreground hover:text-foreground`
- Backdrop: `bg-card/95 backdrop-blur-lg backdrop-saturate-150` (atmospheric translucency)
- Border: `border-t border-border/30` (softened)

### Mobile Header — Enhanced Glassmorphism

- Backdrop: `bg-card/95 backdrop-blur-lg backdrop-saturate-150` (increased blur, saturation boost, more translucent)
- Border: `border-b border-border/30` (softened)

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

## Interaction & Motion — Impressionist Timing

- Card hover lift: `hover:-translate-y-0.5` (subtle, 2px)
- Card transition: `duration-300 ease-out` (slower, organic Impressionist flow)
- Nav item transition: `duration-250` (languid sidebar), `transition-colors` (mobile)
- Active indicator pulse: `animate-pulse` on the status circle dot
- Color transitions: `transition-colors` on links and interactive text
- Grain breathing: `light-breathe` keyframe — 20s opacity cycle on canvas texture
- Shimmer utility: `.shimmer-accent` — 8s gradient animation for decorative containers

---

## Mobile Interaction Patterns

### Swipe-to-Reveal Actions

Mobile card lists use the `SwipeActions` component (`src/components/shared/SwipeActions.tsx`) instead of inline action buttons. This follows iOS-style swipe-to-reveal conventions.

**Core behavior:**
- Swipe left on a card to reveal action buttons behind it
- Tap the card to navigate (e.g. to detail page)
- Tap a swiped card to close it
- Desktop is unaffected — uses hover-reveal buttons instead

**Touch gesture details:**
- Direction locking after 8px of movement (prevents diagonal conflicts with scroll)
- Rubber-band effect when overswiping past the action area
- Snap threshold at 35% of total action width
- Smooth transition: `0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)`

**Dynamic border-radius:**
- Idle state: card has full `rounded-xl` on all corners
- Swiping/Open state: right-side border-radius is set to 0 via inline style (`borderRadius: '0.75rem 0 0 0.75rem'`), creating a seamless junction with the action buttons
- Action buttons container has `rounded-r-xl overflow-hidden` so the right edge matches the card's rounding
- The border-radius transition is animated alongside the transform

**Rounding strategy — `className` prop:**
- Default: `className="rounded-xl"` — the SwipeActions container itself provides rounding + `overflow-x-clip` (for standalone cards like Transactions list)
- Override: `className=""` — when the card is nested inside an already-rounded parent container, remove SwipeActions' own rounding to prevent shadow/border clipping
- When using `className=""`, the inner card div should add its own `rounded-xl`

**Foreground layer:**
- Wraps children in a `bg-background` div to prevent action button colors from bleeding through semi-transparent card backgrounds
- Uses `overflow-hidden` to clip children to the rounded boundary

**Action color conventions:**
| Action | Color | Icon |
|--------|-------|------|
| Delete / Unlink / Unassign | `bg-red-500` | `X` or `Trash2` |
| Edit | `bg-amber-500` | `Edit` (Pencil) |
| Link / Assign | `bg-emerald-500` | `LinkIcon` |

**Where SwipeActions is used:**

| Page | Section | Swipe Actions |
|------|---------|---------------|
| Transactions list | Main card list | Edit (amber) + Delete (red) |
| PositionDetails | Linked Trades | Unlink (red X) |
| PositionDetails | Available Trades | Link (green) |
| FundDetails | Linked Positions | Unassign (red X) |
| FundDetails | Available Positions | Link (green) |

**Design principles:**
1. Each swipe card should have **minimal actions** (1–2 max) — keep it simple
2. **Tap = navigate** — swiping is for actions, tapping is for viewing detail
3. **Edit goes through detail page** — don't put edit in swipe for nested contexts (e.g. trades within positions); navigate to the item's own detail page instead
4. **Desktop unchanged** — swipe is mobile-only; desktop uses hover-reveal buttons with `hidden md:flex` / `opacity-0 group-hover:opacity-100`

### Dashboard Price Freshness

Instead of absolute timestamps, the Dashboard uses colored dot indicators for price freshness:
- Green dot (`bg-emerald-500`): updated < 60 seconds ago
- Amber dot (`bg-amber-500`): updated < 300 seconds ago
- Gray dot (`bg-muted-foreground/40`): stale or unknown
- A 5-second interval tick keeps the indicators current

### Empty States & Onboarding

The Dashboard shows a guided onboarding state when the user has no data, with 3 action cards:
1. Add Trading Pairs → Settings
2. Record Trades → Transactions
3. Create Strategy → Positions

---

## Key Principles Summary

1. **Impressionist warmth** — warm ivory (light) and warm indigo (dark) backgrounds, not cool neutrals
2. **Colored shadows** — primary-hue-tinted `shadow-ambient` / `shadow-elevated` / `shadow-glow`, never generic gray
3. **Canvas grain texture** — subtle SVG noise overlay with breathing animation for organic feel
4. **Gradient accent bars** — `from-transparent via-{color} to-transparent` for soft Impressionist strokes
5. **Atmospheric glassmorphism** — `backdrop-blur-lg backdrop-saturate-150` on mobile chrome
6. **Organic motion** — 300ms ease-out card transitions, 250ms nav transitions, 20s breathing grain
7. **Emerald/Rose for PnL** — boosted saturation for Impressionist vibrancy, never `destructive`
8. **Consistent label style** — `10px uppercase tracking-wider` for all metric labels
9. **Monospace for numbers** — all financial values use `font-mono` for alignment
10. **Dissolved edges** — reduced border opacity (20-30%) with soft shadows replacing hard lines
11. **Privacy-first branding** — sidebar footer, minimal chrome, no unnecessary decoration
12. **Theme-aware shadows** — every theme color variant overrides `--shadow-color` for harmony
