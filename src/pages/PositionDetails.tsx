import { useParams, useNavigate } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { usePositionStore } from "@/store/usePositionStore"
import { ArrowLeft, Trash2, Link as LinkIcon, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getAveragePrice, mul, sub, add, div } from "@/lib/math"

export default function PositionDetails() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const addTransactionToPosition = usePositionStore(state => state.addTransactionToPosition)
    const removeTransactionFromPosition = usePositionStore(state => state.removeTransactionFromPosition)
    // const closePosition = usePositionStore(state => state.closePosition)

    const position = useLiveQuery(() => id ? db.positions.get(id) : undefined, [id])
    const allTransactions = useLiveQuery(() => db.transactions.toArray())

    if (position === undefined) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
    if (position === null) return <div className="p-8 text-center text-foreground">Position not found.</div>

    // Find all transactions that are linked to this position
    const linkedTxIds = new Set(position.entries.map(e => e.transactionId))
    const linkedTxs = allTransactions?.filter(tx => linkedTxIds.has(tx.id)) || []

    // Available transactions matching symbol that can be linked
    const availableTxs = allTransactions?.filter(tx => tx.symbol === position.symbol && !linkedTxIds.has(tx.id)) || []

    // Handlers
    const handleLink = async (txId: string, quantity: number) => {
        if (!id) return;
        await addTransactionToPosition(id, { transactionId: txId, allocatedAmount: quantity });
    }

    const handleRemove = async (txId: string) => {
        if (!id) return;
        await removeTransactionFromPosition(id, txId);
    }

    // Calculate Metrics
    let totalBought = 0;
    let totalSold = 0;
    let totalCost = 0;
    let totalRevenue = 0;

    linkedTxs.forEach(tx => {
        const allocated = position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount || 0;
        if (tx.type === 'BUY') {
            totalBought = add(totalBought, allocated);
            totalCost = add(totalCost, mul(allocated, tx.price));
        } else {
            totalSold = add(totalSold, allocated);
            totalRevenue = add(totalRevenue, mul(allocated, tx.price));
        }
    });

    const avgBuyPrice = totalBought > 0 ? getAveragePrice(totalCost, totalBought) : 0;
    const avgSellPrice = totalSold > 0 ? getAveragePrice(totalRevenue, totalSold) : 0;

    // Realized PnL = (Avg Sell - Avg Buy) * Total Sold
    const realizedPnL = totalSold > 0 ? mul(sub(avgSellPrice, avgBuyPrice), totalSold) : 0;
    const roi = totalCost > 0 ? mul(div(realizedPnL, totalCost), 100) : 0;

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/positions')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">{position.strategyName}</h1>
                        <Badge variant={position.status === 'OPEN' ? 'default' : 'secondary'}>{position.status}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 font-mono font-medium">{position.symbol}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground mb-1">Realized PnL</p>
                    <p className={`text-2xl font-bold ${realizedPnL > 0 ? 'text-green-500' : realizedPnL < 0 ? 'text-destructive' : ''}`}>
                        ${realizedPnL > 0 ? '+' : ''}{realizedPnL.toFixed(2)}
                    </p>
                </div>
                <div className="bg-card p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground mb-1">ROI (Return)</p>
                    <p className={`text-2xl font-bold ${roi > 0 ? 'text-green-500' : roi < 0 ? 'text-destructive' : ''}`}>
                        {roi > 0 ? '+' : ''}{roi.toFixed(2)}%
                    </p>
                </div>
                <div className="bg-card p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground mb-1">Avg. Entry Price</p>
                    <p className="text-2xl font-mono">${avgBuyPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                </div>
                <div className="bg-card p-4 rounded-xl border shadow-sm flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground mb-1">Current Holding</p>
                    <p className="text-2xl font-mono">{sub(totalBought, totalSold)} <span className="text-base text-muted-foreground ml-1">{position.symbol.split('/')[0]}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card rounded-xl p-6 border shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">Linked Trades</h2>
                        {linkedTxs.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No trades linked to this position yet. Link them from the right panel.</p>
                        ) : (
                            <div className="space-y-4">
                                {linkedTxs.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                                        <div className="flex gap-4 items-center">
                                            <Badge variant={tx.type === "BUY" ? "default" : "destructive"}>{tx.type}</Badge>
                                            <div className="text-sm">
                                                <p className="font-mono">${tx.price} <span className="text-muted-foreground mx-1">×</span> {tx.quantity}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium flex items-center gap-4">
                                            <span className="text-muted-foreground">Allocated:</span> {position.entries.find(e => e.transactionId === tx.id)?.allocatedAmount}
                                            <Button variant="ghost" size="icon" onClick={() => handleRemove(tx.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-card rounded-xl p-6 border shadow-sm">
                        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Available Trades</h3>
                        <div className="space-y-3">
                            {availableTxs.length === 0 ? (
                                <p className="text-muted-foreground text-sm flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    No available unlinked trades for this asset.
                                </p>
                            ) : (
                                availableTxs.map(tx => (
                                    <div key={tx.id} className="p-3 border rounded-lg hover:border-primary/50 transition-colors text-sm bg-background/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <Badge variant={tx.type === "BUY" ? "default" : "destructive"}>{tx.type}</Badge>
                                            <Button size="sm" variant="secondary" onClick={() => handleLink(tx.id, tx.quantity)} className="h-7 text-xs gap-1">
                                                <LinkIcon className="h-3 w-3" /> Link 100%
                                            </Button>
                                        </div>
                                        <p className="font-mono text-muted-foreground">${tx.price} × {tx.quantity}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
