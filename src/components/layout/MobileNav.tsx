import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, LineChart, Layers, User } from "lucide-react"

export function MobileNav() {
    const location = useLocation()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Funds", href: "/funds", icon: Layers },
        { name: "Positions", href: "/positions", icon: LineChart },
        { name: "Profile", href: "/profile", icon: User },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t border-border/30 bg-card/95 backdrop-blur-lg backdrop-saturate-150 md:hidden pb-safe">
            {links.map((link) => {
                const Icon = link.icon
                const isActive = link.href === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(link.href)
                return (
                    <Link
                        key={link.name}
                        to={link.href}
                        className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                            isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium leading-none">{link.name}</span>
                    </Link>
                )
            })}
        </div>
    )
}
