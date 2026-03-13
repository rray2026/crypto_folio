import { useNavigate } from "react-router-dom"
import { ArrowLeft, BookOpen, Calculator, Layout, ShieldCheck, TrendingUp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Glossary() {
    const navigate = useNavigate()

    const sections = [
        {
            title: "Fundamental Concepts",
            icon: <Layout className="h-5 w-5 text-blue-500" />,
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
                {
                    term: "Execution Price",
                    definition: "The specific price at which a transaction was filled in the market."
                }
            ]
        },
        {
            title: "Metrics & Formulas",
            icon: <Calculator className="h-5 w-5 text-emerald-500" />,
            items: [
                {
                    term: "Average Entry Price",
                    definition: "The volume-weighted average cost of all your entry transactions. Formula: Total Cost / Total Quantity Purchased.",
                    formula: "Σ(Price * Quantity) / ΣQuantity"
                },
                {
                    term: "Realized PnL",
                    definition: "The actual profit or loss locked in after closing a trade. It is the difference between your exit value and the cost basis of those specific units."
                },
                {
                    term: "Unrealized PnL",
                    definition: "Also known as 'Paper PnL'. The estimated profit or loss based on the current market price of an open position.",
                    formula: "(Current Price - Avg Entry) * Current Quantity"
                },
                {
                    term: "ROI (Return on Investment)",
                    definition: "A percentage measure of the efficiency of an investment relative to its cost.",
                    formula: "(Total PnL / Total Invested) * 100%"
                },
                {
                    term: "Net PnL",
                    definition: "The total profit or loss across all trades, including both realized and unrealized amounts, minus all transaction fees."
                }
            ]
        },
        {
            title: "Portfolio Management",
            icon: <ShieldCheck className="h-5 w-5 text-purple-500" />,
            items: [
                {
                    term: "OPEN (Active)",
                    definition: "A position that currently has a balance. It is actively exposed to market price movements."
                },
                {
                    term: "CLOSED (Archived)",
                    definition: "A position where the quantity has returned to zero. The strategy is complete, and the final results are locked into your history."
                },
                {
                    term: "Total Investment",
                    definition: "The total amount of capital (excluding fees) used to enter the position. This is the 'skin in the game'."
                },
                {
                    term: "Transaction Fees",
                    definition: "Costs charged by exchanges for executing trades. These are deducted from your total balance and impact Net PnL."
                }
            ]
        }
    ]

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <BookOpen className="h-7 w-7 text-primary" />
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
                                <Card key={iIdx} className="bg-card/40 border-border/40 hover:border-primary/20 transition-colors shadow-sm overflow-hidden group">
                                    <CardHeader className="pb-2 space-y-1">
                                        <CardTitle className="text-base font-bold group-hover:text-primary transition-colors flex items-center justify-between">
                                            {item.term}
                                            {item.formula && <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/30" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {item.definition}
                                        </p>
                                        {item.formula && (
                                            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/10">
                                                <Info className="h-3.5 w-3.5 text-primary/50 shrink-0" />
                                                <code className="text-[11px] font-mono font-bold text-primary/80 truncate">
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
                <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 text-center space-y-2">
                    <p className="text-sm font-medium text-primary">Need more help?</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        This glossary covers the primary logic used to calculate your portfolio performance. 
                        Prices are fetched in real-time from market providers.
                    </p>
                </div>
            </div>
        </div>
    )
}
