import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, LineChart, Layers, User, TrendingUp, ChevronsLeft, ChevronsRight } from "lucide-react"

const SIDEBAR_KEY = "folio-sidebar-collapsed"

export function Sidebar() {
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(SIDEBAR_KEY) === "true" } catch { return false }
    })

    const toggle = () => {
        const next = !collapsed
        setCollapsed(next)
        try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* noop */ }
    }

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Funds", href: "/funds", icon: Layers },
        { name: "Positions", href: "/positions", icon: LineChart },
        { name: "Profile", href: "/profile", icon: User },
    ]

    return (
        <div className={`hidden md:flex h-full flex-col border-r border-border/20 bg-gradient-to-b from-[hsl(var(--primary)/0.04)] via-card to-card/90 relative overflow-hidden transition-[width] duration-300 ease-out ${collapsed ? 'w-[68px]' : 'w-60'}`}>
            {/* Impressionist ambient light wash on sidebar */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[hsl(var(--primary)/0.06)] via-transparent to-[hsl(38_70%_65%/0.03)]" />

            {/* Logo */}
            <div className={`relative flex h-16 items-center border-b border-border/20 gap-3 ${collapsed ? 'px-0 justify-center' : 'px-5'}`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 shadow-glow shrink-0 shimmer-accent">
                    <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                {!collapsed && (
                    <span className="text-[15px] font-bold tracking-tight text-foreground whitespace-nowrap">
                        Folio
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className={`relative flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = link.href === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(link.href)
                    return (
                        <Link
                            key={link.name}
                            to={link.href}
                            title={collapsed ? link.name : undefined}
                            className={`flex items-center rounded-xl text-sm font-medium transition-all duration-300 ease-out relative ${
                                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                            } ${
                                isActive
                                    ? "bg-primary/12 text-primary shadow-[inset_0_0_20px_hsl(var(--primary)/0.12)] border border-primary/15"
                                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                            }`}
                        >
                            {isActive && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />}
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'drop-shadow-[0_0_4px_hsl(var(--primary)/0.4)]' : ''}`} />
                            {!collapsed && <span className="whitespace-nowrap">{link.name}</span>}
                        </Link>
                    )
                })}
            </nav>

            {/* Collapse toggle + footer */}
            <div className="relative border-t border-border/20">
                <button
                    onClick={toggle}
                    className="flex items-center justify-center w-full py-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed
                        ? <ChevronsRight className="h-4 w-4" />
                        : <ChevronsLeft className="h-4 w-4" />
                    }
                </button>
            </div>
        </div>
    )
}
