import { useState } from "react"
import { Link } from "react-router-dom"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { usePositionStore } from "@/store/usePositionStore"
import { PositionForm } from "@/components/positions/PositionForm"
import { Plus, Trash2, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export default function Positions() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const deletePosition = usePositionStore((state) => state.deletePosition)

    const positions = useLiveQuery(() => db.positions.toArray())

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this position? Linkings to transactions will be removed (but transactions are kept).")) {
            await deletePosition(id)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Positions</h1>
                    <p className="text-muted-foreground mt-2">Manage your trading strategies and group trades.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Position
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create Position</DialogTitle>
                            <DialogDescription>
                                Group your trades under a strategy to view its performance.
                            </DialogDescription>
                        </DialogHeader>
                        <PositionForm onSuccess={() => setIsDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {!positions?.length ? (
                <Card className="border-dashed shadow-none">
                    <CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                        <p>No positions created yet.</p>
                        <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="mt-4">
                            Create Your First Strategy
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {positions.map((pos) => (
                        <Link to={`/positions/${pos.id}`} key={pos.id} className="block transition-transform hover:-translate-y-1">
                            <Card className="h-full flex flex-col relative group overflow-hidden bg-card/60 hover:bg-card/100 border-border/40 hover:border-border transition-colors">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-bold tracking-tight">
                                            {pos.strategyName}
                                        </CardTitle>
                                        <Badge variant={pos.status === 'OPEN' ? 'default' : 'secondary'} className="ml-2">
                                            {pos.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-foreground/60 font-mono font-medium">{pos.symbol}</p>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-sm flex flex-col gap-1 text-muted-foreground">
                                        <p>Associations: <span className="text-foreground font-medium">{pos.entries.length} trades</span></p>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0 flex justify-between items-center opacity-80 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive z-10 -ml-2" onClick={(e) => handleDelete(pos.id, e)}>
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </Button>
                                    <Button variant="ghost" size="sm" className="gap-1 text-primary">
                                        Details <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
