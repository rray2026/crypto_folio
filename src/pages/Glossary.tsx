import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { ArrowLeft, BookOpen, Calculator, Layout, ShieldCheck, TrendingUp, Info, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Glossary() {
    const navigate = useNavigate()
    const { setMobileHeader } = useMobileHeader()

    useEffect(() => {
        setMobileHeader({
            title: "Glossary",
            leftAction: (
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
            ),
        })
    }, [navigate, setMobileHeader])

    const sections = [
        {
            title: "Data Architecture",
            icon: <Layers className="h-5 w-5 text-orange-500" />,
            items: [
                {
                    term: "Transaction",
                    definition: "The atomic unit of the entire system — a single BUY or SELL order executed on an exchange. Each transaction records: asset symbol, direction (BUY/SELL), price, quantity, date, and fees. Transactions are raw market events and exist independently of any position."
                },
                {
                    term: "Position",
                    definition: "A trading thesis that aggregates one or more transactions. A position answers the question 'What is my overall view on this trade?'. It links transactions via entries with allocated amounts, computes blended avg cost, realized/unrealized PnL, and ROI across all those trades. One position can span many partial entries and exits, and can optionally belong to a Fund and/or a Strategy."
                },
                {
                    term: "Fund",
                    definition: "A portfolio container that groups multiple positions under a single capital pool. A fund tracks total capital deployment (Initial Amount), NAV per share, overall PnL, and each position's allocation percentage within the fund. One fund can hold many positions across different assets and strategies. Funds answer the question 'How is my capital performing?'."
                },
                {
                    term: "Strategy",
                    definition: "A trading methodology or rule set that defines how you approach the market (e.g., 'Grid Trading', 'Breakout Momentum'). Strategies are linked to positions to measure execution quality and compare different approaches. A strategy tracks win rate, average ROI, and total P&L across all its linked positions. Strategies answer the question 'Is my method working?'."
                },
                {
                    term: "Fund vs Strategy",
                    definition: "A Fund represents a capital pool ('where is the money?'), while a Strategy represents a trading methodology ('how do I trade?'). A position can belong to both a Fund and a Strategy simultaneously — the Fund tracks capital allocation and NAV, while the Strategy evaluates the trading method's effectiveness.",
                    formula: "Fund = Capital Pool (money) | Strategy = Methodology (method)"
                },
                {
                    term: "Data Hierarchy",
                    definition: "Fund → Position → Transaction, with Strategy as an orthogonal dimension. Funds own Positions; Positions link Transactions. Strategies cross-cut this hierarchy — any position can be tagged with a strategy regardless of which fund it belongs to. Moving up aggregates data: transactions → position PnL → fund NAV. Moving across compares data: strategy A win rate vs strategy B.",
                    formula: "Fund (capital) → Positions (trades) → Transactions (executions) | Strategy (method) ↔ Positions"
                }
            ]
        },
        {
            title: "Fundamental Concepts",
            icon: <Layout className="h-5 w-5 text-muted-foreground" />,
            items: [
                {
                    term: "Asset Symbol",
                    definition: "The unique identifier for a trading pair (e.g., BTC/USDT). It represents the asset being traded against a quote currency."
                },
                {
                    term: "Long Position",
                    definition: "Buying an asset with the expectation that its price will increase. You 'buy low' and aim to 'sell high'."
                },
                {
                    term: "Short Position",
                    definition: "Selling an asset with the expectation that its price will decrease. You 'sell high' and aim to 'buy back' lower."
                },
            ]
        },
        {
            title: "Metrics & Formulas",
            icon: <Calculator className="h-5 w-5 text-emerald-500" />,
            items: [
                {
                    term: "Avg Buy",
                    definition: "The weighted average price at which the position was entered. For LONG positions, this is the average buy price across all entry transactions. For SHORT positions, it is the average sell price.",
                    formula: "Total Entry Amount / Total Entry Quantity"
                },
                {
                    term: "Avg Sell",
                    definition: "The weighted average price at which units were closed out of the position. For LONG positions, this is the average sell price. For SHORT positions, it is the average buy-back price.",
                    formula: "Total Exit Amount / Total Exit Quantity"
                },
                {
                    term: "Avg Cost",
                    definition: "Also known as Breakeven Price. The price at which your remaining holdings would need to be closed to break even, accounting for capital already recovered from partial exits. For LONG: cost minus recovered revenue, spread over remaining quantity. For SHORT: revenue minus buyback cost, spread over remaining short quantity.",
                    formula: "LONG: (Total Spent - Total Revenue) / Remaining Qty | SHORT: (Total Revenue - Total Cost) / Remaining Qty"
                },
                {
                    term: "Realized PnL",
                    definition: "The actual profit or loss locked in after closing a trade. It is the difference between your exit value and the cost basis of those specific units."
                },
                {
                    term: "Unrealized PnL",
                    definition: "Also known as 'Paper PnL'. The estimated profit or loss based on the current market price of an open position.",
                    formula: "(Current Price - Avg Buy) × Remaining Quantity"
                },
                {
                    term: "Total PnL",
                    definition: "The combined profit or loss across a position or strategy, including both realized and unrealized amounts. Displayed in position details and strategy summary pages.",
                    formula: "Realized PnL + Unrealized PnL"
                },
                {
                    term: "ROI (Return on Investment)",
                    definition: "A percentage measure of the efficiency of an investment relative to its cost.",
                    formula: "(Total PnL / Total Invested) × 100%"
                },
                {
                    term: "Win Rate",
                    definition: "The percentage of closed positions that ended with a positive Total PnL. Displayed on the strategy details page to evaluate a trading methodology's success rate.",
                    formula: "Profitable Closed Positions / Total Closed Positions × 100%"
                },
                {
                    term: "NAV (Net Asset Value)",
                    definition: "The total value of a fund's holdings, calculated as the sum of all linked positions' current market value plus remaining cash. NAV per share reflects the fund's performance relative to its initial capital.",
                    formula: "NAV / Share = Current Fund Value / Total Shares"
                }
            ]
        },
        {
            title: "Portfolio Management",
            icon: <ShieldCheck className="h-5 w-5 text-purple-500" />,
            items: [
                {
                    term: "OPEN / CLOSED",
                    definition: "Position lifecycle states. OPEN means the position is in progress and may have an active balance. CLOSED means the position has been completed — its results are finalized. You can manually toggle status regardless of remaining holdings."
                },
                {
                    term: "ACTIVE / ARCHIVED",
                    definition: "Strategy and Fund lifecycle states. ACTIVE means the strategy or fund is in use. ARCHIVED means it has been shelved — it remains visible for historical review but is hidden from default lists and link menus."
                },
                {
                    term: "Allocated Amount",
                    definition: "When linking a transaction to a position, the allocated amount defines how much of that transaction's quantity belongs to this position. This allows a single transaction to be split across multiple positions (e.g., a 10 BTC buy split into 6 for Position A and 4 for Position B)."
                },
                {
                    term: "Total Investment",
                    definition: "The total amount of capital (excluding fees) used to enter the position. This is the 'skin in the game'."
                },
                {
                    term: "Transaction Fees",
                    definition: "Costs charged by exchanges for executing trades. Fees are proportionally allocated based on the allocated amount ratio when a transaction is shared across multiple positions."
                }
            ]
        }
    ]

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header (desktop only — mobile uses MobileHeader) */}
            <div className="hidden md:flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <BookOpen className="h-7 w-7 text-muted-foreground" />
                        Investment Glossary
                    </h1>
                    <p className="text-muted-foreground mt-1">Understanding the concepts and math behind your portfolio.</p>
                </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-10">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            {section.icon}
                            <h2 className="text-lg font-bold uppercase tracking-wider text-muted-foreground/80">{section.title}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.items.map((item, iIdx) => (
                                <Card key={iIdx} className="bg-card/40 border-border/40 hover:border-border transition-colors shadow-sm overflow-hidden group">
                                    <CardHeader className="pb-2 space-y-1">
                                        <CardTitle className="text-base font-bold group-hover:text-foreground transition-colors flex items-center justify-between">
                                            {item.term}
                                            {item.formula && <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/30" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {item.definition}
                                        </p>
                                        {item.formula && (
                                            <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg border border-border/10">
                                                <Info className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                                                <code className="text-[11px] font-mono font-bold text-foreground/80 break-words min-w-0">
                                                    {item.formula}
                                                </code>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Note */}
            <div className="pt-12 border-t border-border/40">
                <div className="p-6 bg-muted/30 rounded-2xl border border-border text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">Need more help?</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        This glossary covers the primary logic used to calculate your portfolio performance. 
                        Prices are fetched in real-time from market providers.
                    </p>
                </div>
            </div>
        </div>
    )
}
