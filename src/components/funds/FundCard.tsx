import { Link } from "react-router-dom"
import { Layers, Circle } from "lucide-react"
import type { Fund } from "@/lib/types"
import { badge, statusBadgeColor, pnlColor, label, valueBold, valueHero, divider, headerDivider, cardBorder } from "@/lib/styles"

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
            <div className={`h-full flex flex-col relative overflow-hidden rounded-xl ${cardBorder} transition-all duration-200 bg-card hover:border-border hover:shadow-lg hover:-translate-y-0.5`}>
                <div className={`px-4 pt-3 pb-3 ${headerDivider}`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="text-sm font-semibold tracking-tight line-clamp-1 text-foreground" title={fund.name}>
                            {fund.name}
                        </h3>
                        <span className={badge({ color: statusBadgeColor(fund.status) })}>
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
                            <p className={`${label} mb-1`}>Initial Amount</p>
                            <p className={valueBold}>
                                {fund.initialAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className={`${label} mb-1`}>Current Value</p>
                            <p className={valueBold}>
                                {metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className={`flex justify-between items-end pt-2.5 ${divider}`}>
                        <div>
                            <p className={`${label} mb-1.5`}>NAV / Share</p>
                            <p className={valueHero}>
                                {metrics.currentNAV.toFixed(4)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className={`${label} mb-1.5`}>NAV Change</p>
                            <p className={`${valueHero} ${pnlColor(navUp ? 1 : -1)}`}>
                                {navUp ? '+' : ''}{metrics.navChangePct.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}
