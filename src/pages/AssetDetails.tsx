import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore } from "@/store/useSettingsStore"
import { differenceInDays } from "date-fns"
import { ArrowLeft, Activity, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPositionMetrics } from "@/lib/metrics"
import { useEffect, useState } from "react"
import { PositionCard } from "@/components/shared/PositionCard"
import { TransactionRow } from "@/components/shared/TransactionRow"

export default function AssetDetails() {
    const { symbol } = useParams<{ symbol: string }>()
    const decodedSymbol = symbol?.replace('_', '/') || ""
    const navigate = useNavigate()
    const { prices, fetchPrices } = useSettingsStore()
    const [editingTxId, setEditingTxId] = useState<string | null>(null)

    const transactions = useLiveQuery(() => 
        db.transactions.where('symbol').equals(decodedSymbol).reverse().sortBy('date'), 
        [decodedSymbol]
    )
    
    // Sort positions by startDate (derived from transactions) descending to match list page
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

    // Calculate metrics and sort for display
    const enrichedPositions = (positions || []).map(pos => {
        const linkedTxs = transactions?.filter(tx => pos.entries.some(e => e.transactionId === tx.id)) || []
        const metrics = getPositionMetrics(pos, linkedTxs, prices)
        return { pos, metrics }
    }).sort((a, b) => (b.metrics.derivedStartDate || 0) - (a.metrics.derivedStartDate || 0))

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
                        {enrichedPositions.length === 0 ? (
                            <Card className="md:col-span-2 lg:col-span-3 border-dashed bg-muted/20">
                                <CardContent className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                                    <p>No strategies linked to {decodedSymbol} yet.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            enrichedPositions.map(({ pos, metrics }) => {
                                const duration = differenceInDays(metrics.derivedEndDate || Date.now(), metrics.derivedStartDate || Date.now())
                                return (
                                    <PositionCard 
                                        key={pos.id}
                                        position={pos}
                                        metrics={metrics}
                                        isActive={pos.status === 'OPEN'}
                                        duration={duration}
                                    />
                                )
                            })
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-6">
                    {/* Simplified header mockup matching the grid of TransactionRow with showAsset=false */}
                    <div className="bg-card/40 rounded-2xl border border-border/40 overflow-hidden">
                        <div className="px-6 py-4 grid grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_0.8fr_80px] bg-muted/30 border-b border-border/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            <div>Date</div>
                            <div>Side</div>
                            <div className="text-right">Price</div>
                            <div className="text-right">Quantity</div>
                            <div className="text-right">Total Amount</div>
                            <div className="text-right">Fee</div>
                            <div></div>
                        </div>
                        <div className="divide-y divide-border/20">
                            {transactions?.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">No transactions found for {decodedSymbol}</div>
                            ) : (
                                transactions?.map(tx => (
                                    <TransactionRow 
                                        key={tx.id}
                                        tx={tx}
                                        showAsset={false}
                                        onViewDetail={(id) => navigate(`/transactions/${id}`)}
                                        onEdit={(id) => setEditingTxId(id)}
                                        onDelete={() => {}} // Disabled in this view or add handler if needed
                                        isEditing={editingTxId === tx.id}
                                        setIsEditing={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}
                                        className="border-none rounded-none hover:bg-muted/10"
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
