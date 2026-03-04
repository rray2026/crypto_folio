import { useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { useTransactionStore } from "@/store/useTransactionStore"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { format } from "date-fns"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function Transactions() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const deleteTransaction = useTransactionStore((state) => state.deleteTransaction)

    // Reactively fetch transactions sorted by newest
    const transactions = useLiveQuery(
        () => db.transactions.orderBy("date").reverse().toArray()
    )

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this transaction? It will be removed from all associated positions.")) {
            await deleteTransaction(id)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-muted-foreground mt-2">Manage your foundational trade records.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Transaction
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Record Transaction</DialogTitle>
                            <DialogDescription>
                                Enter the details of your spot trade. This will be available to link to positions.
                            </DialogDescription>
                        </DialogHeader>
                        <TransactionForm onSuccess={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Pair</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Fee</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!transactions?.length ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p>No transactions recorded yet.</p>
                                            <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="mt-2">
                                                Record Your First Trade
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((tx) => (
                                    <TableRow key={tx.id} className="group">
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {format(new Date(tx.date), "MMM d, yyyy HH:mm")}
                                        </TableCell>
                                        <TableCell className="font-bold">{tx.symbol}</TableCell>
                                        <TableCell>
                                            <Badge variant={tx.type === "BUY" ? "default" : "destructive"}>
                                                {tx.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">${tx.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">{tx.quantity.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">${tx.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">${tx.fee.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={(e) => handleDelete(tx.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
