import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, ReceiptText, LineChart, Settings, Layers, TrendingUp } from "lucide-react"

export function Sidebar() {
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Funds", href: "/funds", icon: Layers },
        { name: "Strategies", href: "/positions", icon: LineChart },
        { name: "Transactions", href: "/transactions", icon: ReceiptText },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <div className="hidden md:flex h-full w-60 flex-col border-r bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center border-b px-5 gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-foreground">
                    Folio
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = link.href === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(link.href)
                    return (
                        <Link
                            key={link.name}
                            to={link.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t">
                <p className="text-[10px] text-muted-foreground/50 text-center tracking-widest uppercase font-medium">
                    Privacy-First
                </p>
            </div>
        </div>
    )
}
