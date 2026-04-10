import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { differenceInDays } from "date-fns"
import { ArrowLeft, Activity, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getPositionMetrics, comparePositionsByMetrics } from "@/lib/metrics"
import { useEffect, useState } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { PositionCard } from "@/components/shared/PositionCard"
import { TransactionCard, TransactionListHeader } from "@/components/shared/TransactionCard"

export default function AssetDetails() {
    const { symbol } = useParams<{ symbol: string }>()
    const decodedSymbol = symbol?.replace('_', '/') || ""
    const navigate = useNavigate()
    const { prices, fetchPrices, pairConfigs } = useSettingsStore()
    const currencySymbol = getCurrencySymbolForPair(decodedSymbol, pairConfigs)
    const [editingTxId, setEditingTxId] = useState<string | null>(null)
    const { setMobileHeader } = useMobileHeader()

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

    useEffect(() => {
        setMobileHeader({
            title: decodedSymbol || "Asset",
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
    }, [decodedSymbol, navigate, setMobileHeader]);

    const now = useState(() => Date.now())[0]

    if (!decodedSymbol) return <div className="p-8 text-center text-muted-foreground">Invalid Symbol</div>

    const currentPriceData = prices[decodedSymbol]
    const currentPrice = currentPriceData?.price || 0
    const [base, quote] = decodedSymbol.split('/')

    // Calculate metrics and sort for display
    const enrichedPositions = (positions || []).map(pos => {
        const linkedTxs = transactions?.filter(tx => pos.entries.some(e => e.transactionId === tx.id)) || []
        const metrics = getPositionMetrics(pos, linkedTxs, prices)
        return { pos, metrics }
    }).sort(comparePositionsByMetrics)

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section (desktop: full; mobile: price/stats only, title in MobileHeader) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hidden md:inline-flex shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="hidden md:block text-3xl font-bold tracking-tight">{base} <span className="text-muted-foreground text-xl">/ {quote}</span></h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-mono font-bold text-foreground">
                                {Number(currentPrice) > 0 ? `${currencySymbol}${Number(currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '---'}
                            </span>
                            <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded font-bold tracking-tighter">Live Price</span>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="strategies" className="w-full">
                <TabsList>
                    <TabsTrigger value="strategies">
                        <Activity className="h-3.5 w-3.5" /> Strategies ({positions?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="transactions">
                        <Clock className="h-3.5 w-3.5" /> Transactions ({transactions?.length || 0})
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
                                const duration = differenceInDays(metrics.derivedEndDate || now, metrics.derivedStartDate || now)
                                return (
                                    <PositionCard
                                        key={pos.id}
                                        position={pos}
                                        metrics={metrics}
                                        isActive={pos.status === 'OPEN'}
                                        duration={duration}
                                        currencySymbol={currencySymbol}
                                    />
                                )
                            })
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4 md:space-y-2">
                    <TransactionListHeader showAsset={false} />
                    
                    {transactions?.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                            No transactions found for {decodedSymbol}
                        </div>
                    ) : (
                        transactions?.map(tx => (
                            <TransactionCard
                                key={tx.id}
                                tx={tx}
                                showAsset={false}
                                currencySymbol={currencySymbol}
                                onViewDetail={(id) => navigate(`/transactions/${id}`)}
                                onEdit={(id) => setEditingTxId(id)}
                                onDelete={() => {}}
                                isEditing={editingTxId === tx.id}
                                setIsEditing={(isOpen) => setEditingTxId(isOpen ? tx.id : null)}
                            />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
