import { cva, type VariantProps } from "class-variance-authority"

// =============================================================================
// Design Tokens — single source of truth for repeated UI patterns
// =============================================================================

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
// Usage: <span className={badge({ color: "buy" })}>{tx.type}</span>

export const badge = cva(
    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border",
    {
        variants: {
            color: {
                buy:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40",
                sell:   "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40",
                long:   "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40",
                short:  "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40",
                active: "bg-primary/10 text-primary border-primary/20",
                closed: "bg-muted text-muted-foreground border-border",
                fund:   "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200/50 dark:border-violet-800/40",
            },
        },
    }
)

export type BadgeColor = NonNullable<VariantProps<typeof badge>["color"]>

/** Map transaction type to badge color. */
export function txBadgeColor(type: "BUY" | "SELL"): BadgeColor {
    return type === "BUY" ? "buy" : "sell"
}

/** Map position direction to badge color. */
export function dirBadgeColor(dir: "LONG" | "SHORT"): BadgeColor {
    return dir === "LONG" ? "long" : "short"
}

/** Map status to badge color. */
export function statusBadgeColor(status: "OPEN" | "CLOSED" | "ACTIVE"): BadgeColor {
    return status === "OPEN" || status === "ACTIVE" ? "active" : "closed"
}

// ---------------------------------------------------------------------------
// PnL color
// ---------------------------------------------------------------------------

export function pnlColor(value: number): string {
    if (value > 0) return "text-emerald-500 dark:text-emerald-400"
    if (value < 0) return "text-red-500 dark:text-red-400"
    return "text-foreground"
}

// ---------------------------------------------------------------------------
// Typography tokens
// ---------------------------------------------------------------------------

/** Metric label — small uppercase text above a value. */
export const label = "text-[10px] text-muted-foreground uppercase tracking-wider"

/** Metric value — monospace number. */
export const value = "font-mono text-sm"

/** Metric value — emphasized (e.g. holdings, avg price). */
export const valueBold = "font-mono text-sm font-semibold"

/** Metric value — hero size (e.g. unrealized PnL, ROI). */
export const valueHero = "font-mono text-lg font-bold leading-none"

/** Date/time stamp text. */
export const dateText = "text-[11px] font-mono text-muted-foreground"

/** Section header — e.g. "Linked Trades (3)". */
export const sectionHeader = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-1"

/** Form field label. */
export const formLabel = "text-xs font-semibold uppercase tracking-wider text-muted-foreground/80"

// ---------------------------------------------------------------------------
// Layout tokens
// ---------------------------------------------------------------------------

/** Card container border (lists, cards). */
export const cardBorder = "border border-border/50"

/** Divider inside a card section. */
export const divider = "border-t border-border/30"

/** Divider between card header and body. */
export const headerDivider = "border-b border-border/40"

/** List item container — inline row with swipe support. */
export const listItem = "p-3 bg-card hover:bg-card/80 transition-colors cursor-pointer group"

/** Dialog list item — selectable with ring highlight. */
export const dialogItem = (selected: boolean) =>
    `w-full p-3 rounded-lg border transition-colors text-left ${
        selected
            ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
            : "border-border/50 hover:bg-muted/30"
    }`
