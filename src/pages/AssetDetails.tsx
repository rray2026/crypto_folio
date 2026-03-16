import { useParams, useNavigate, Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore } from "@/store/useSettingsStore"
import { format, differenceInDays } from "date-fns"
import { ArrowLeft, Clock, Activity, Calendar, Eye, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPositionMetrics } from "@/lib/metrics"
import { useEffect } from "react"

export default function AssetDetails() {
    const { symbol } = useParams<{ symbol: string }>()
    const decodedSymbol = symbol?.replace('_', '/') || ""
    const navigate = useNavigate()
    const { prices, fetchPrices } = useSettingsStore()

    const transactions = useLiveQuery(() => 
        db.transactions.where('symbol').equals(decodedSymbol).reverse().sortBy('date'), 
        [decodedSymbol]
    )
    
    const positions = useLiveQuery(() => 
        db.positions.where('symbol').equals(decodedSymbol).toArray(),
        [decodedSymbol]
    )

    // Fetch price for this asset
    useEffect(() => {
        if (decodedSymbol) {
            fetchPrices([decodedSymbol]);
            const interval = setInterval(() => fetchPrices([decodedSymbol]), 300000);
            return () => clearInterval(interval);
        }
    }, [decodedSymbol, fetchPrices]);

    if (!decodedSymbol) return <div className="p-8 text-center text-muted-foreground">Invalid Symbol</div>

    const currentPriceData = prices[decodedSymbol]
    const currentPrice = currentPriceData?.price || 0
    const [base, quote] = decodedSymbol.split('/')

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{base} <span className="text-muted-foreground text-xl">/ {quote}</span></h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-mono font-bold text-primary">
                                {Number(currentPrice) > 0 ? `$${Number(currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '---'}
                            </span>
                            <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded font-bold tracking-tighter">Live Price</span>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="strategies" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
                    <TabsTrigger value="strategies" className="gap-2">
                        <Activity className="h-4 w-4" /> Strategies ({positions?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="gap-2">
                        <Clock className="h-4 w-4" /> Transactions ({transactions?.length || 0})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="strategies" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {positions?.length === 0 ? (
                            <Card className="md:col-span-2 lg:col-span-3 border-dashed bg-muted/20">
                                <CardContent className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                                    <p>No strategies linked to {decodedSymbol} yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            positions?.map(pos => {
                                const linkedTxs = transactions?.filter(tx => pos.entries.some(e => e.transactionId === tx.id)) || []
                                const metrics = getPositionMetrics(pos, linkedTxs, prices)
                                const duration = differenceInDays(metrics.derivedEndDate || Date.now(), metrics.derivedStartDate || Date.now())
                                const isActive = pos.status === 'OPEN'

                                return (
                                    <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                                        <Card className={`h-full flex flex-col border-border/40 hover:border-border transition-all bg-card/60 hover:bg-card/90 ${pos.type === 'SHADOW' ? 'border-dashed border-2' : ''}`}>
                                            <CardHeader className="pb-3 border-b border-border/40">
                                                <div className="flex justify-between items-start mb-2">
                                                    <CardTitle className="text-lg font-bold tracking-tight line-clamp-1">{pos.strategyName || `${base} Position`}</CardTitle>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        {pos.type === 'SHADOW' && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
                                                                <Eye className="h-2.5 w-2.5" />
                                                            </div>
                                                        )}
                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${metrics.positionType === 'LONG' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                                                            {metrics.positionType}
                                                        </div>
                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${isActive ? 'bg-blue-500/5 text-blue-600 border-blue-200' : 'bg-muted/50 text-muted-foreground'}`}>
                                                            {isActive ? 'OPEN' : 'CLOSED'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                                                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {metrics.derivedStartDate ? format(new Date(metrics.derivedStartDate), "yyyy/MM/dd") : '---'}</div>
                                                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}d</div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">PnL</span>
                                                        <span className={`text-lg font-bold font-mono ${metrics.totalPnL > 0 ? 'text-green-500' : metrics.totalPnL < 0 ? 'text-destructive' : ''}`}>
                                                            ${metrics.totalPnL.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">ROI</span>
                                                        <span className={`text-lg font-bold font-mono ${metrics.roi > 0 ? 'text-green-500' : metrics.roi < 0 ? 'text-destructive' : ''}`}>
                                                            {metrics.roi.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="pt-2 pb-3 px-4 flex justify-end bg-muted/20 border-t border-border/10 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary">
                                                    View Strategy <ArrowRight className="h-3 w-3" />
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    </Link>
                                )
                            })
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                    <div className="bg-card/40 rounded-2xl border border-border/40 overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr] gap-4 px-6 py-4 bg-muted/30 border-b border-border/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            <div>Date</div>
                            <div>Type</div>
                            <div className="text-right">Price</div>
                            <div className="text-right">Quantity</div>
                            <div className="text-right">Amount</div>
                            <div className="text-right">Action</div>
                        </div>
                        <div className="divide-y divide-border/20">
                            {transactions?.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">No transactions found for {decodedSymbol}</div>
                            ) : (
                                transactions?.map(tx => (
                                    <div key={tx.id} className="grid grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr] gap-4 px-6 py-4 items-center hover:bg-muted/10 transition-colors group">
                                        <div className="text-xs font-mono text-muted-foreground/80">{format(new Date(tx.date), "yyyy/MM/dd HH:mm")}</div>
                                        <div>
                                            <div className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${tx.type === "BUY" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                                                {tx.type}
                                            </div>
                                        </div>
                                        <div className="text-right font-mono text-sm">${tx.price.toLocaleString()}</div>
                                        <div className="text-right font-mono text-sm">{tx.quantity.toLocaleString()}</div>
                                        <div className="text-right font-mono font-bold text-sm text-primary/90">${tx.amount.toLocaleString()}</div>
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background/80" onClick={() => navigate(`/transactions/${tx.id}`)}>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
