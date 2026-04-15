import { useEffect, useRef, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMobileHeader } from "@/hooks/useMobileHeader"
import { useSettingsStore } from "@/store/useSettingsStore"
import { Button } from "@/components/ui/button"
import { Settings, TrendingUp, ReceiptText, Lightbulb, ChevronRight } from "lucide-react"
import { version } from "../../package.json"

declare const __BUILD_DATE__: string

const DEBUG_TAP_COUNT = 5
const DEBUG_TAP_TIMEOUT = 3000

export default function Profile() {
    const navigate = useNavigate()
    const { predefinedPairs } = useSettingsStore()
    const { setMobileHeader } = useMobileHeader()

    useEffect(() => {
        setMobileHeader({
            title: "Profile",
            rightActions: (
                <button
                    onClick={() => navigate("/settings")}
                    className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
                    aria-label="Settings"
                >
                    <Settings className="h-5 w-5" />
                </button>
            ),
        })
    }, [setMobileHeader, navigate])

    // Debug mode Easter egg
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

    const menuItems = [
        {
            name: "Trading Pairs",
            description: `${predefinedPairs.length} ${predefinedPairs.length === 1 ? 'pair' : 'pairs'} configured`,
            href: "/settings/trading-pairs",
            icon: TrendingUp,
        },
        {
            name: "Strategies",
            description: "Define and track trading strategies",
            href: "/strategies",
            icon: Lightbulb,
        },
        {
            name: "Transactions",
            description: "View and manage all trades",
            href: "/transactions",
            icon: ReceiptText,
        },
    ]

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="hidden md:flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Quick access and app info.</p>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/settings")}>
                    <Settings className="h-5 w-5 text-muted-foreground" />
                </Button>
            </div>

            <div className="rounded-2xl border border-border/20 overflow-hidden bg-card shadow-ambient impressionist-card">
                {menuItems.map((item, i) => {
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={`flex items-center justify-between p-4 group hover:bg-primary/5 transition-all duration-300 ease-out ${
                                i < menuItems.length - 1 ? 'border-b border-border/15' : ''
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.1)]">
                                    <Icon className="h-4.5 w-4.5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                    )
                })}
            </div>

            <div className="pt-4 pb-4 text-center">
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
