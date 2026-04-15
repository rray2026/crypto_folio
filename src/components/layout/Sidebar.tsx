import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, LineChart, Layers, User, TrendingUp } from "lucide-react"

export function Sidebar() {
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Funds", href: "/funds", icon: Layers },
        { name: "Positions", href: "/positions", icon: LineChart },
        { name: "Profile", href: "/profile", icon: User },
    ]

    return (
        <div className="hidden md:flex h-full w-60 flex-col border-r border-border/20 bg-gradient-to-b from-[hsl(var(--primary)/0.04)] via-card to-card/90 relative overflow-hidden">
            {/* Impressionist ambient light wash on sidebar */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[hsl(var(--primary)/0.06)] via-transparent to-[hsl(38_70%_65%/0.03)]" />

            {/* Logo */}
            <div className="relative flex h-16 items-center border-b border-border/20 px-5 gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 shadow-glow shrink-0 shimmer-accent">
                    <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-foreground">
                    Folio
                </span>
            </div>

            {/* Navigation */}
            <nav className="relative flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = link.href === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(link.href)
                    return (
                        <Link
                            key={link.name}
                            to={link.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-out relative ${
                                isActive
                                    ? "bg-primary/12 text-primary shadow-[inset_0_0_20px_hsl(var(--primary)/0.12)] border border-primary/15"
                                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                            }`}
                        >
                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />}
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'drop-shadow-[0_0_4px_hsl(var(--primary)/0.4)]' : ''}`} />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="relative p-4 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/50 text-center tracking-widest uppercase font-medium">
                    Privacy-First
                </p>
            </div>
        </div>
    )
}
