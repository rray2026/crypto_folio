import { Link } from "react-router-dom"
import { Layers, Circle } from "lucide-react"
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
        <Link to={`/funds/${fund.id}`} className="block group">
            <div className="h-full flex flex-col relative overflow-hidden rounded-xl border transition-all duration-200 bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                {/* Accent bar */}
                <div className={`h-0.5 w-full ${navUp ? 'bg-emerald-500' : 'bg-red-500'}`} />

                <div className="px-4 pt-3 pb-3 border-b border-border/40">
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="text-sm font-semibold tracking-tight line-clamp-1 text-foreground" title={fund.name}>
                            {fund.name}
                        </h3>
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${
                            isActive
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted text-muted-foreground border-border'
                        }`}>
                            <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} />
                            {isActive ? 'ACTIVE' : 'CLOSED'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-mono">
                        <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {positionCount} position{positionCount !== 1 ? 's' : ''}
                        </span>
                        <span>{fund.currency}</span>
                    </div>
                </div>

                <div className="flex-1 px-4 pt-3 pb-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Initial Amount</p>
                            <p className="font-mono text-sm font-semibold">
                                {fund.initialAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Value</p>
                            <p className="font-mono text-sm font-semibold">
                                {metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-end pt-2.5 border-t border-border/30">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">NAV / Share</p>
                            <p className="font-mono font-bold text-lg leading-none">
                                {metrics.currentNAV.toFixed(4)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">NAV Change</p>
                            <p className={`font-mono font-bold text-lg leading-none ${navUp ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                {navUp ? '+' : ''}{metrics.navChangePct.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}
