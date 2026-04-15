import { Link } from "react-router-dom"
import { format } from "date-fns"
import { TrendingUp, TrendingDown, Calendar, Clock, Circle, Layers } from "lucide-react"
import type { Position, PositionMetrics } from "@/lib/types"
import { badge, dirBadgeColor, statusBadgeColor, pnlColor, label, value, valueBold, valueHero, divider, headerDivider, cardBorder } from "@/lib/styles"

interface PositionCardProps {
    position: Position;
    metrics: PositionMetrics;
    isActive: boolean;
    duration: number;
    fundName?: string;
    currencySymbol?: string;
}

export function PositionCard({ position, metrics, isActive, duration, fundName, currencySymbol = '$' }: PositionCardProps) {
    const base = position.symbol.split('/')[0];

    return (
        <Link to={`/positions/${position.id}`} className="block group">
            <div
                className={`h-full flex flex-col relative overflow-hidden rounded-xl ${cardBorder} transition-all duration-300 ease-out
                    bg-card hover:bg-card
                    hover:border-border hover:shadow-elevated
                    hover:-translate-y-0.5
                `}
            >
                {/* Accent bar — gradient fade for Impressionist soft edges */}
                <div className={`h-0.5 w-full bg-gradient-to-r from-transparent ${
                    isActive
                        ? (metrics.unrealizedPnL > 0 ? 'via-pnl-up' : metrics.unrealizedPnL < 0 ? 'via-pnl-down' : 'via-muted-foreground/30')
                        : (metrics.realizedPnL > 0 ? 'via-pnl-up/60' : metrics.realizedPnL < 0 ? 'via-pnl-down/60' : 'via-border')
                } to-transparent`} />

                {/* Header */}
                <div className={`px-4 pt-3 pb-3 ${headerDivider}`}>
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="text-sm font-semibold tracking-tight line-clamp-1 text-foreground" title={position.strategyName || `${base} Strategy`}>
                            {position.strategyName || `${base} Strategy`}
                        </h3>
                        <div className="flex justify-end gap-1 shrink-0 flex-wrap">
                            {fundName && (
                                <span className={badge({ color: "fund" })}>
                                    <Layers className="h-2.5 w-2.5" />
                                    {fundName}
                                </span>
                            )}
                            <span className={badge({ color: dirBadgeColor(metrics.positionType) })}>
                                {metrics.positionType === 'LONG' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {metrics.positionType}
                            </span>
                            <span className={badge({ color: statusBadgeColor(isActive ? 'OPEN' : 'CLOSED') })}>
                                <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} aria-hidden="true" />
                                {isActive ? 'OPEN' : 'CLOSED'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono font-medium tracking-wide">{position.symbol}</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : '—'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duration}d
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 px-4 pt-3 pb-4 space-y-3">
                    {isActive ? (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`${label} mb-1`}>Holdings</p>
                                    <p className={valueBold}>
                                        {metrics.totalRemaining} <span className="text-muted-foreground text-[10px] font-normal">{base}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`${label} mb-1`}>
                                        {metrics.currentPrice > 0 ? 'Current Price' : 'Avg Cost'}
                                    </p>
                                    <p className={valueBold}>
                                        {currencySymbol}{metrics.currentPrice > 0
                                            ? metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                            : (metrics.totalRemaining !== 0 ? (metrics.totalInvestment / Math.abs(metrics.totalRemaining)).toFixed(2) : '0.00')}
                                    </p>
                                </div>
                            </div>

                            <div className={`flex justify-between items-start pt-2.5 ${divider}`}>
                                <div>
                                    <p className={`${label} mb-1`}>Total Inv.</p>
                                    <p className={value}>{currencySymbol}{metrics.totalInvestment.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`${label} mb-1`}>Realized PnL</p>
                                    <p className={`${value} font-medium ${pnlColor(metrics.realizedPnL)}`}>
                                        {currencySymbol}{metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className={`flex justify-between items-end pt-2.5 ${divider}`}>
                                <div>
                                    <p className={`${label} mb-1.5`}>Unrealized PnL</p>
                                    <p className={`${valueHero} ${pnlColor(metrics.unrealizedPnL)}`}>
                                        {currencySymbol}{metrics.unrealizedPnL > 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`${label} mb-1.5`}>ROI</p>
                                    <p className={`${valueHero} ${pnlColor(metrics.roi)}`}>
                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`${label} mb-1`}>Avg Buy</p>
                                    <p className={valueBold}>
                                        {currencySymbol}{metrics.avgBuyPrice > 0 ? metrics.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`${label} mb-1`}>Avg Sell</p>
                                    <p className={valueBold}>
                                        {currencySymbol}{metrics.avgSellPrice > 0 ? metrics.avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className={`flex justify-between items-end pt-2.5 ${divider}`}>
                                <div>
                                    <p className={`${label} mb-1.5`}>Realized PnL</p>
                                    <p className={`${valueHero} ${pnlColor(metrics.realizedPnL)}`}>
                                        {currencySymbol}{metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`${label} mb-1.5`}>ROI</p>
                                    <p className={`${valueHero} ${pnlColor(metrics.roi)}`}>
                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Link>
    );
}
