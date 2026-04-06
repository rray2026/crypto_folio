import { useState, useEffect } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useLiveQuery } from "dexie-react-hooks"
import { db, DB_VERSION } from "@/lib/db"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Bug, Database } from "lucide-react"

export default function Debug() {
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => { setMobileHeader({ title: "Debug" }) }, [setMobileHeader])

    const txCount = useLiveQuery(() => db.transactions.count(), [])
    const posCount = useLiveQuery(() => db.positions.count(), [])
    const fundCount = useLiveQuery(() => db.funds.count(), [])

    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isClearing, setIsClearing] = useState(false)

    const handleClearAllData = async () => {
        setIsClearing(true)
        setIsConfirmOpen(false)
        try {
            await db.transaction('rw', db.transactions, db.positions, db.funds, async () => {
                await db.transactions.clear()
                await db.positions.clear()
                await db.funds.clear()
            })
            // Clear localStorage (settings, zustand persisted state)
            localStorage.clear()
            // Hard reload to reset all in-memory state
            window.location.href = "/"
        } catch (error) {
            console.error("Failed to clear data:", error)
            setIsClearing(false)
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="hidden md:block">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Bug className="h-7 w-7" />
                    Debug
                </h1>
                <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
                    Developer tools for testing and diagnostics. Available in nightly and dev builds only.
                </p>
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    Current Data
                </h2>
                <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-muted/40 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                        <p className="text-2xl font-bold font-mono">{txCount ?? '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Positions</p>
                        <p className="text-2xl font-bold font-mono">{posCount ?? '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Funds</p>
                        <p className="text-2xl font-bold font-mono">{fundCount ?? '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Schema</p>
                        <p className="text-2xl font-bold font-mono">v{DB_VERSION}</p>
                    </div>
                </div>
            </div>

            <div className="bg-card p-6 rounded-xl border border-destructive/20 shadow-sm">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
                    <Trash2 className="h-5 w-5 text-destructive" />
                    Factory Reset
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Delete all transactions, positions, funds, and settings. The app will return to its initial state as if freshly installed.
                </p>
                <Button
                    variant="destructive"
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={isClearing}
                    className="gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    {isClearing ? "Clearing..." : "Clear All Data"}
                </Button>
            </div>

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Factory Reset
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-base text-foreground/90 leading-relaxed">
                            This will <strong>permanently delete</strong> all your data including transactions, positions, funds, and app settings.<br /><br />
                            This action cannot be undone. Are you sure?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 sm:justify-between">
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleClearAllData}>Yes, Delete Everything</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
