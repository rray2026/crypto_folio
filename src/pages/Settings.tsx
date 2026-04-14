import { useState, useEffect, useRef, useCallback } from "react"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { Link, useNavigate } from "react-router-dom"
import { useSettingsStore } from "@/store/useSettingsStore"
import type { Theme } from "@/store/useSettingsStore"
import { THEME_COLORS } from "@/lib/themeColors"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
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
import { Palette, BookOpen, Download, Upload, Database, AlertTriangle, ArrowLeft, XCircle, Check } from "lucide-react"

import { exportData, importData } from "@/lib/backup"
import { DB_VERSION } from "@/lib/db"
import { version } from "../../package.json"

const DEBUG_TAP_COUNT = 5
const DEBUG_TAP_TIMEOUT = 3000

export default function Settings() {
    const navigate = useNavigate()
    const { theme, setTheme, themeColor, setThemeColor } = useSettingsStore()

    const txCount   = useLiveQuery(() => db.transactions.count(), [])
    const posCount  = useLiveQuery(() => db.positions.count(), [])
    const fundCount = useLiveQuery(() => db.funds.count(), [])
    const { setMobileHeader } = useMobileHeader()
    useEffect(() => { setMobileHeader({ title: "Settings" }) }, [setMobileHeader])

    // Debug mode Easter egg: tap version text N times to enter debug page
    const tapCountRef = useRef(0)
    const tapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const handleVersionTap = useCallback(() => {
        tapCountRef.current += 1
        clearTimeout(tapTimerRef.current)

        if (tapCountRef.current >= DEBUG_TAP_COUNT) {
            tapCountRef.current = 0
            navigate("/debug")
            return
        }

        tapTimerRef.current = setTimeout(() => {
            tapCountRef.current = 0
        }, DEBUG_TAP_TIMEOUT)
    }, [navigate])

    // Backup State
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
    const [isProcessingBackup, setIsProcessingBackup] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)

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
            setImportError("Failed to import backup file. Ensure it is a valid Folio backup.")
        } finally {
            setIsProcessingBackup(false)
            setPendingImportFile(null)
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="hidden md:block">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">Manage your app preferences and defaults.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border shadow-sm">
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

                <div className="space-y-5">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Mode</p>
                        <div className="max-w-[200px]">
                            <Select value={theme} onValueChange={(val: Theme) => setTheme(val)}>
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

                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3">Accent Color</p>
                        <div className="flex flex-wrap gap-3">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color.id}
                                    onClick={() => setThemeColor(color.id)}
                                    className="group flex flex-col items-center gap-1.5"
                                    title={color.name}
                                >
                                    <div
                                        className={`relative w-9 h-9 rounded-full transition-all ${
                                            themeColor === color.id
                                                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                                                : "hover:scale-105 opacity-80 hover:opacity-100"
                                        }`}
                                        style={{ backgroundColor: color.swatch }}
                                    >
                                        {themeColor === color.id && (
                                            <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                                        )}
                                    </div>
                                    <span className={`text-[10px] transition-colors ${
                                        themeColor === color.id ? "text-foreground font-medium" : "text-muted-foreground/60"
                                    }`}>
                                        {color.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
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
                    <Button onClick={handleExport} disabled={isProcessingBackup} variant="outline" className="gap-2">
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

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    Data Integrity & Upgrade
                </h2>

                <div className="grid grid-cols-4 gap-3">
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

                <div className="flex items-center gap-2 mt-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <p className="text-xs text-muted-foreground">Schema is up to date. Migrations run automatically on startup.</p>
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

            <Dialog open={!!importError} onOpenChange={() => setImportError(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <XCircle className="h-5 w-5" />
                            Import Failed
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {importError}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <Button onClick={() => setImportError(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="bg-card p-6 rounded-xl border shadow-sm mt-8 group hover:border-border transition-all">
                <Link to="/glossary" className="flex items-center justify-between group">
                    <div>
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            Investment Glossary
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Common terminology and formulas used throughout this application.
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                        <ArrowLeft className="h-5 w-5 rotate-180" />
                    </Button>
                </Link>
            </div>

            <div className="pt-8 pb-4 text-center">
                <p
                    className="text-[10px] md:text-xs text-muted-foreground/40 font-mono tracking-widest uppercase select-none cursor-default"
                    onClick={handleVersionTap}
                >
                    Folio v{version} · Built {__BUILD_DATE__}
                </p>
            </div>
        </div>
    )
}
