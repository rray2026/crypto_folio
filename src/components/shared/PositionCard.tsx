import { Link } from "react-router-dom"
import { format } from "date-fns"
import { TrendingUp, TrendingDown, Eye, Calendar, Clock, Circle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { Position } from "@/lib/types"

interface PositionCardProps {
    position: Position;
    metrics: any;
    isActive: boolean;
    duration: number;
}

export function PositionCard({ position, metrics, isActive, duration }: PositionCardProps) {
    const base = position.symbol.split('/')[0];
    
    return (
        <Link to={`/positions/${position.id}`} className="block transition-transform hover:-translate-y-1">
            <Card 
                className={`h-full flex flex-col relative group overflow-hidden border-border/40 hover:border-border transition-colors bg-card/60 hover:bg-card/100 shadow-sm ${
                    position.type === 'SHADOW' 
                    ? 'border-dashed border-2' 
                    : ''
                }`}
            >
                <CardHeader className="pb-3 border-b border-border/40">
                    <div className="flex justify-between items-start mb-2">
                        <CardTitle className="text-lg font-bold tracking-tight line-clamp-1 mr-2" title={position.strategyName || `${base} Position`}>
                            {position.strategyName || `${base} Position`}
                        </CardTitle>
                        <div className="flex justify-end gap-1.5 shrink-0 flex-wrap">
                            {/* Shadow Badge */}
                            {position.type === 'SHADOW' && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
                                    <Eye className="h-2.5 w-2.5" />
                                    SHADOW
                                </div>
                            )}
                            {/* Direction Badge */}
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                metrics.positionType === 'LONG' 
                                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}>
                                {metrics.positionType === 'LONG' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                {metrics.positionType}
                            </div>
                            {/* Status Badge */}
                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isActive
                                ? 'bg-blue-500/5 text-blue-600 border-blue-200 dark:border-blue-900/50 dark:text-blue-400'
                                : 'bg-muted/50 text-muted-foreground border-border'
                            }`}>
                                <Circle className={`h-1.5 w-1.5 fill-current ${isActive ? 'animate-pulse' : ''}`} />
                                {isActive ? 'ACTIVE' : 'ARCHIVED'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground/80 font-mono font-medium">{position.symbol}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                            <div className="flex items-center gap-1" title="Start Date">
                                <Calendar className="h-3 w-3" />
                                {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : 'Unknown'}
                            </div>
                            <div className="flex items-center gap-1" title="Duration">
                                <Clock className="h-3 w-3" />
                                {duration}d
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 pt-4 pb-2 space-y-4">
                    {isActive ? (
                        <>
                            {/* Holdings and Price / Cost */}
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground mb-1">Holdings</span>
                                    <span className="font-mono text-sm font-bold">
                                        {metrics.totalRemaining} <span className="text-muted-foreground text-[10px]">{base}</span>
                                    </span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-xs text-muted-foreground mb-1">{metrics.currentPrice > 0 ? 'Current Price' : 'Avg Cost'}</span>
                                    <span className="font-mono text-sm font-bold">
                                        ${metrics.currentPrice > 0
                                            ? metrics.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                            : (metrics.totalRemaining > 0 ? (metrics.totalInvestment / metrics.totalRemaining).toFixed(2) : '0.00')}
                                    </span>
                                </div>
                            </div>

                            {/* Investment and Realized PnL */}
                            <div className="flex justify-between items-center pt-3 border-t border-border/30">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground mb-1">Total Inv.</span>
                                    <span className="font-mono text-sm">${metrics.totalInvestment.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-xs text-muted-foreground mb-1">Realized PnL</span>
                                    <span className={`font-mono text-sm font-medium ${metrics.realizedPnL > 0 ? 'text-green-500' : metrics.realizedPnL < 0 ? 'text-destructive' : 'text-foreground'}`}>
                                        ${metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Unrealized PnL and ROI */}
                            <div className="mt-2 pt-4 border-t border-border/30 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-primary/80 mb-1 uppercase tracking-wider font-semibold">Unrealized PnL</span>
                                    <span className={`font-mono font-bold text-lg ${metrics.unrealizedPnL > 0 ? 'text-green-500' : metrics.unrealizedPnL < 0 ? 'text-destructive' : ''}`}>
                                        ${metrics.unrealizedPnL > 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">ROI</span>
                                    <span className={`font-mono font-bold text-lg ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : ''}`}>
                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Avg Entry and Avg Exit */}
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground mb-1">Avg Entry</span>
                                    <span className="font-mono text-sm font-bold">
                                        ${metrics.avgBuyPrice > 0 ? metrics.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-xs text-muted-foreground mb-1">Avg Exit</span>
                                    <span className="font-mono text-sm font-bold">
                                        ${metrics.avgSellPrice > 0 ? metrics.avgSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Realized PnL and ROI */}
                            <div className="mt-2 pt-4 border-t border-border/30 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Realized PnL</span>
                                    <span className={`font-mono font-bold text-lg ${metrics.realizedPnL > 0 ? 'text-green-500' : metrics.realizedPnL < 0 ? 'text-destructive' : ''}`}>
                                        ${metrics.realizedPnL > 0 ? '+' : ''}{metrics.realizedPnL.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">ROI</span>
                                    <span className={`font-mono font-bold text-lg ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : ''}`}>
                                        {metrics.roi > 0 ? '+' : ''}{metrics.roi.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
