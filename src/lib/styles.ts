import { cva, type VariantProps } from "class-variance-authority"

// =============================================================================
// Design Tokens — single source of truth for repeated UI patterns
// =============================================================================

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
// Usage: <span className={badge({ color: "buy" })}>{tx.type}</span>

export const badge = cva(
    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[9px] font-semibold uppercase tracking-wider border backdrop-blur-sm",
    {
        variants: {
            color: {
                buy:    "bg-pnl-up/12 text-pnl-up border-pnl-up/25 shadow-[0_0_6px_hsl(168_66%_38%/0.1)]",
                sell:   "bg-pnl-down/12 text-pnl-down border-pnl-down/25 shadow-[0_0_6px_hsl(350_70%_54%/0.1)]",
                long:   "bg-pnl-up/12 text-pnl-up border-pnl-up/25 shadow-[0_0_6px_hsl(168_66%_38%/0.1)]",
                short:  "bg-pnl-down/12 text-pnl-down border-pnl-down/25 shadow-[0_0_6px_hsl(350_70%_54%/0.1)]",
                open:   "bg-primary/12 text-primary border-primary/25 shadow-[0_0_6px_hsl(var(--primary)/0.1)]",
                closed: "text-muted-foreground border-border/50",
                fund:   "bg-primary/12 text-primary border-primary/25 shadow-[0_0_6px_hsl(var(--primary)/0.1)]",
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
    return status === "OPEN" || status === "ACTIVE" ? "open" : "closed"
}

// ---------------------------------------------------------------------------
// PnL color
// ---------------------------------------------------------------------------

export function pnlColor(value: number): string {
    if (value > 0) return "text-pnl-up"
    if (value < 0) return "text-pnl-down"
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

/** Card container border — bold Impressionist: minimal border + rich colored shadow. */
export const cardBorder = "border border-border/20 shadow-ambient"

/** Divider inside a card section — nearly dissolved. */
export const divider = "border-t border-border/15"

/** Divider between card header and body — nearly dissolved. */
export const headerDivider = "border-b border-border/15"

/** List item container — warm Impressionist surface. */
export const listItem = "p-3 impressionist-card hover:bg-card/80 transition-all duration-300 ease-out cursor-pointer group"

/** Dialog list item — selectable with glow highlight. */
export const dialogItem = (selected: boolean) =>
    `w-full p-3 rounded-xl border transition-all duration-300 ease-out text-left ${
        selected
            ? "bg-primary/8 border-primary/25 ring-1 ring-primary/20 shadow-[0_0_16px_hsl(var(--primary)/0.1)]"
            : "border-border/30 hover:bg-primary/5 hover:shadow-ambient"
    }`
