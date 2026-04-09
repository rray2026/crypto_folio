import { Link } from "react-router-dom"
import { format } from "date-fns"
import { TrendingUp, TrendingDown, Calendar, Clock, Circle, Layers } from "lucide-react"
import type { Position, PositionMetrics } from "@/lib/types"

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
    const isProfit = (v: number) => v > 0;
    const isLoss = (v: number) => v < 0;
    const pnlColor = (v: number) =>
        isProfit(v) ? 'text-emerald-500 dark:text-emerald-400' : isLoss(v) ? 'text-red-500 dark:text-red-400' : 'text-foreground';

    return (
        <Link to={`/positions/${position.id}`} className="block group">
            <div
                className={`h-full flex flex-col relative overflow-hidden rounded-xl border transition-all duration-200
                    bg-card hover:bg-card
                    hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5
                    hover:-translate-y-0.5
                    border-border/50
                `}
            >
                {/* Accent bar top */}
                <div className={`h-0.5 w-full ${
                    isActive
                        ? (metrics.unrealizedPnL > 0 ? 'bg-emerald-500' : metrics.unrealizedPnL < 0 ? 'bg-red-500' : 'bg-primary')
                        : (metrics.realizedPnL > 0 ? 'bg-emerald-500/60' : metrics.realizedPnL < 0 ? 'bg-red-500/60' : 'bg-border')
                }`} />

                {/* Header */}
                <div className="px-4 pt-3 pb-3 border-b border-border/40">
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="text-sm font-semibold tracking-tight line-clamp-1 text-foreground" title={position.strategyName || `${base} Position`}>
                            {position.strategyName || `${base} Position`}
                        </h3>
                        <div className="flex justify-end gap-1 shrink-0 flex-wrap">
                            {fundName && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/40">
                                    <Layers className="h-2.5 w-2.5" />
                                    {fundName}
                                </span>
                            )}
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${
                                metrics.positionType === 'LONG'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/40'
                            }`}>
                                {metrics.positionType === 'LONG' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {metrics.positionType}
                            </span>
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${
                                isActive
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : 'bg-muted text-muted-foreground border-border'
                            }`}>
                                <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} aria-hidden="true" />
                                {isActive ? 'ACTIVE' : 'CLOSED'}
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
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Holdings</p>
                                    <p className="font-mono text-sm font-semibold">
                                        {metrics.totalRemaining} <span className="text-muted-foreground text-[10px] font-normal">{base}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                        {metrics.currentPrice > 0 ? 'Current Price' : 'Avg Cost'}
                                    </p>
                                    <p className="font-mono text-sm font-semibold">
                                        {currencySymbol}{metrics.currentPrice > 0
                                            ? metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                            : (metrics.totalRemaining !== 0 ? (metrics.totalInvestment / Math.abs(metrics.totalRemaining)).toFixed(2) : '0.00')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-start pt-2.5 border-t border-border/30">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Inv.</p>
                                    <p className="font-mono text-sm">{currencySymbol}{metrics.totalInvestment.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Realized PnL</p>
                                    <p className={`font-mono text-sm font-medium ${pnlColor(metrics.realizedPnL)}`}>
                                        {currencySymbol}{metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pt-2.5 border-t border-border/30">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Unrealized PnL</p>
                                    <p className={`font-mono font-bold text-lg leading-none ${pnlColor(metrics.unrealizedPnL)}`}>
                                        {currencySymbol}{metrics.unrealizedPnL > 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">ROI</p>
                                    <p className={`font-mono font-bold text-lg leading-none ${pnlColor(metrics.roi)}`}>
                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Buy</p>
                                    <p className="font-mono text-sm font-semibold">
                                        {currencySymbol}{metrics.avgBuyPrice > 0 ? metrics.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Sell</p>
                                    <p className="font-mono text-sm font-semibold">
                                        {currencySymbol}{metrics.avgSellPrice > 0 ? metrics.avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pt-2.5 border-t border-border/30">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Realized PnL</p>
                                    <p className={`font-mono font-bold text-lg leading-none ${pnlColor(metrics.realizedPnL)}`}>
                                        {currencySymbol}{metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">ROI</p>
                                    <p className={`font-mono font-bold text-lg leading-none ${pnlColor(metrics.roi)}`}>
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
