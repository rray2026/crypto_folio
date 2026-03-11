import { useState, useEffect, useRef } from "react"
import { useSettingsStore } from "@/store/useSettingsStore"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, Plus, RefreshCw, Clock, Palette, BookOpen, Download, Upload, Database, AlertTriangle, Pin } from "lucide-react"
import { exportData, importData } from "@/lib/backup"

export default function Settings() {
    const { predefinedPairs, pinnedPairs, prices, addPair, removePair, togglePinPair, fetchPrices, dashboardTimeRange, setDashboardTimeRange, theme, setTheme } = useSettingsStore()
    const [newPair, setNewPair] = useState("")
    const [syncingPairs, setSyncingPairs] = useState<Record<string, boolean>>({})
    const [isSyncingAll, setIsSyncingAll] = useState(false)

    // Backup State
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
    const [isProcessingBackup, setIsProcessingBackup] = useState(false)

    useEffect(() => {
        fetchPrices();
        // automatically refresh every 5 minutes
        const interval = setInterval(fetchPrices, 300000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPair.trim()) return
        addPair(newPair.trim())
        setNewPair("")
    }

    const handleManualSync = async (pair: string) => {
        setSyncingPairs(prev => ({ ...prev, [pair]: true }))
        await fetchPrices([pair], true, true)
        setSyncingPairs(prev => ({ ...prev, [pair]: false }))
    }

    const handleExport = async () => {
        setIsProcessingBackup(true)
        try {
            await exportData()
        } catch (error) {
            console.error("Export failed:", error)
        } finally {
            setIsProcessingBackup(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPendingImportFile(e.target.files[0])
            setIsImportConfirmOpen(true)
            // Reset input so selecting the same file again triggers onChange
            e.target.value = ""
        }
    }

    const handleConfirmImport = async () => {
        if (!pendingImportFile) return

        setIsProcessingBackup(true)
        setIsImportConfirmOpen(false)
        try {
            await importData(pendingImportFile)
            window.location.reload() // Hard reload to hydrate the entire React tree immediately
        } catch (error) {
            console.error("Import failed:", error)
            alert("Failed to import backup file. Ensure it is a valid CryptoFolio backup.")
        } finally {
            setIsProcessingBackup(false)
            setPendingImportFile(null)
        }
    }

    const handleSyncAll = async () => {
        setIsSyncingAll(true);
        await fetchPrices(undefined, true, false);
        setIsSyncingAll(false);
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your app preferences and defaults.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Pre-defined Trading Pairs</h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncAll}
                        disabled={isSyncingAll}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                        Sync All
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    These pairs will appear as quick-select options when recording new transactions or creating positions.
                </p>

                <form onSubmit={handleAdd} className="flex gap-3 mb-6">
                    <Input
                        placeholder="Add new pair (e.g. ADA/USDT)"
                        value={newPair}
                        onChange={(e) => setNewPair(e.target.value)}
                        className="max-w-xs"
                    />
                    <Button type="submit" variant="secondary" className="gap-2">
                        <Plus className="h-4 w-4" /> Add
                    </Button>
                </form>

                {predefinedPairs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pre-defined pairs.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                        {predefinedPairs.map(pair => {
                            const priceData = prices[pair];
                            const priceDisplay = priceData ? `$${parseFloat(priceData.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : '...';
                            const lastSync = priceData ? format(new Date(priceData.timestamp), "HH:mm:ss") : 'Never';

                            return (
                                <div key={pair} className="flex flex-col p-3.5 sm:p-3 border rounded-xl bg-background/50 group">
                                    <div className="flex items-start sm:items-center justify-between mb-2">
                                        <span className="font-mono text-sm md:text-base font-bold tracking-tight truncate pr-2">{pair}</span>
                                        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex shrink-0 gap-0.5 -mr-1 sm:mr-0 -mt-1 sm:mt-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => togglePinPair(pair)}
                                                className={`h-7 w-7 transition-colors ${pinnedPairs.includes(pair) ? 'text-primary opacity-100' : 'text-muted-foreground hover:text-primary'}`}
                                                title={pinnedPairs.includes(pair) ? "Unpin from Dashboard" : "Pin to Dashboard"}
                                            >
                                                <Pin className={`h-3.5 w-3.5 ${pinnedPairs.includes(pair) ? 'fill-current' : ''}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={syncingPairs[pair]}
                                                onClick={() => handleManualSync(pair)}
                                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                title="Sync Price"
                                            >
                                                <RefreshCw className={`h-3.5 w-3.5 ${syncingPairs[pair] ? 'animate-spin' : ''}`} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePair(pair)}
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                title="Remove Pair"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between mt-auto">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground mb-0.5">Price</span>
                                            <span className="text-sm font-mono text-foreground">{priceDisplay}</span>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-[10px] text-muted-foreground mb-0.5">Last Sync</span>
                                            <span className="text-xs font-mono text-muted-foreground">{lastSync}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            Dashboard Time Range
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Choose the historical lookback period for calculating metrics (ROI, PnL, Win Rate) on the global Dashboard.
                        </p>
                    </div>
                </div>

                <div className="max-w-[200px]">
                    <Select value={dashboardTimeRange} onValueChange={(val: any) => setDashboardTimeRange(val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1M">Last 1 Month</SelectItem>
                            <SelectItem value="3M">Last 3 Months</SelectItem>
                            <SelectItem value="6M">Last 6 Months</SelectItem>
                            <SelectItem value="1Y">Last 1 Year</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Palette className="h-5 w-5 text-muted-foreground" />
                            Appearance
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Customize the visual theme of the application.
                        </p>
                    </div>
                </div>

                <div className="max-w-[200px]">
                    <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Database className="h-5 w-5 text-muted-foreground" />
                            Data Backup & Restore
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Export your entire portfolio locally for safekeeping, or migrate it between devices.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                    <Button onClick={handleExport} disabled={isProcessingBackup} variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
                        <Download className="h-4 w-4" />
                        Export Backup
                    </Button>

                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingBackup}
                        variant="secondary"
                        className="gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        Import Data
                    </Button>
                </div>
            </div>

            <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Overwrite Warning
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-base text-foreground/90 leading-relaxed">
                            Importing this file will <strong>permanently erase</strong> all current positions, transactions, and settings on this device, and replace them entirely with the contents of the backup.<br /><br />
                            Are you absolutely sure you want to proceed?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 sm:justify-between">
                        <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleConfirmImport}>Yes, Overwrite Data</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                            Investment Glossary
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Common terminology and formulas used throughout this application.
                        </p>
                    </div>
                </div>

                <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/30 rounded-lg border">
                            <h3 className="font-semibold text-sm">Realized PnL (Profit and Loss)</h3>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">The actual profit or loss generated after closing a portion of or an entire position (e.g., selling previously bought assets, or buying back shorted assets). It excludes transaction fees.</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border">
                            <h3 className="font-semibold text-sm">Unrealized PnL</h3>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">The theoretical profit or loss of a currently open position based on the live market price. It becomes "Realized" only when you actively close the position.</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border">
                            <h3 className="font-semibold text-sm">ROI (Return on Investment)</h3>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Calculated as: <code className="bg-background px-1 py-0.5 rounded text-[10px] ml-1 border border-border/50">(Total Profit / Total Investment) × 100%</code>. It comprehensively measures the efficiency and profitability of your trades relative to the capital deployed.</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border">
                            <h3 className="font-semibold text-sm">Long vs. Short</h3>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed"><strong className="text-foreground">Long</strong>: Buying an asset expecting its price to rise. <br /><strong className="text-foreground">Short</strong>: Selling an asset expecting its price to fall, aiming to buy it back cheaper later.</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border md:col-span-2">
                            <h3 className="font-semibold text-sm">Average Entry Price</h3>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">The volume-weighted average cost of all your initial build-up transactions (Buys for Long, Sells for Short) for a specific strategy. Used as the mathematical baseline for calculating Unrealized and Realized PnL.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
