import { Link } from "react-router-dom"
import { Layers, Circle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { Fund } from "@/lib/types"

interface FundCardProps {
    fund: Fund;
    positionCount: number;
    metrics: {
        currentValue: number;
        initialNAV: number;
        currentNAV: number;
        navChangePct: number;
        totalPnL: number;
    };
}

export function FundCard({ fund, positionCount, metrics }: FundCardProps) {
    const isActive = fund.status === 'ACTIVE'
    const navUp = metrics.navChangePct >= 0

    return (
        <Link to={`/funds/${fund.id}`} className="block transition-transform hover:-translate-y-1">
            <Card className="h-full flex flex-col border-border/40 hover:border-border transition-colors bg-card/60 hover:bg-card/100 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex justify-between items-start mb-1">
                        <CardTitle className="text-lg font-bold tracking-tight line-clamp-1 mr-2" title={fund.name}>
                            {fund.name}
                        </CardTitle>
                        <div className="flex items-center gap-1 shrink-0">
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isActive
                                ? 'bg-blue-500/5 text-blue-600 border-blue-200 dark:border-blue-900/50 dark:text-blue-400'
                                : 'bg-muted/50 text-muted-foreground border-border'
                            }`}>
                                <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} />
                                {isActive ? 'ACTIVE' : 'CLOSED'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            <span>{positionCount} position{positionCount !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="font-mono">{fund.currency}</span>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 pt-4 pb-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground mb-1">Initial Amount</span>
                            <span className="font-mono text-sm font-bold">
                                {fund.initialAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-xs text-muted-foreground mb-1">Current Value</span>
                            <span className="font-mono text-sm font-bold">
                                {metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="mt-2 pt-4 border-t border-border/30 flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">NAV / Share</span>
                            <span className="font-mono font-bold text-lg">
                                {metrics.currentNAV.toFixed(4)}
                            </span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">NAV Change</span>
                            <span className={`font-mono font-bold text-lg ${navUp ? 'text-green-500' : 'text-destructive'}`}>
                                {navUp ? '+' : ''}{metrics.navChangePct.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
