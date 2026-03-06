import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, ReceiptText, LineChart, Settings } from "lucide-react"

export function Sidebar() {
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Positions", href: "/positions", icon: LineChart },
        { name: "Transactions", href: "/transactions", icon: ReceiptText },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card">
            <div className="flex h-16 items-center border-b px-6">
                <h2 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                    CryptoFolio
                </h2>
            </div>
            <div className="flex-1 py-6">
                <nav className="space-y-2 px-4">
                    {links.map((link) => {
                        const Icon = link.icon
                        const isActive = location.pathname === link.href
                        return (
                            <Link
                                key={link.name}
                                to={link.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {link.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}
