import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useSettingsStore, getCurrencySymbolForPair } from "@/store/useSettingsStore"
import { differenceInDays } from "date-fns"
import { ArrowLeft, Activity, Clock, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
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
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
            {/* Header */}
            <div className="flex items-start gap-2 md:gap-4 flex-col sm:flex-row w-full">
                <Button variant="ghost" size="icon" className="hidden md:inline-flex shrink-0 self-start mt-1" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 w-full min-w-0">
                    <h1 className="hidden md:block text-2xl md:text-3xl font-bold tracking-tight">{base} <span className="text-muted-foreground text-xl">/ {quote}</span></h1>
                    {/* Info chips */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1.5 md:mt-2.5">
                        <span className="text-sm md:text-lg text-foreground font-mono font-bold tracking-wider">
                            {Number(currentPrice) > 0 ? `${currencySymbol}${Number(currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '---'}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] md:text-xs text-primary font-semibold uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20">
                            <Activity className="h-2.5 w-2.5" />
                            Live
                        </span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="positions" className="w-full">
                <TabsList>
                    <TabsTrigger value="positions">
                        <Target className="h-3.5 w-3.5" /> Positions ({positions?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="transactions">
                        <Clock className="h-3.5 w-3.5" /> Transactions ({transactions?.length || 0})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="positions" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrichedPositions.length === 0 ? (
                            <div className="md:col-span-2 lg:col-span-3 p-6 rounded-xl border border-dashed border-border/50 text-center">
                                <p className="text-sm text-muted-foreground">No positions linked to {decodedSymbol} yet.</p>
                            </div>
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
                        <div className="p-6 rounded-xl border border-dashed border-border/50 text-center">
                            <p className="text-sm text-muted-foreground">No transactions found for {decodedSymbol}</p>
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
