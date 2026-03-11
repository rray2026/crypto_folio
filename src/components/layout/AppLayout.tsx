import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"

export function AppLayout() {
    return (
        <div className="flex h-screen w-full bg-background text-foreground font-sans antialiased overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
                <Outlet />
            </main>
            <MobileNav />
        </div>
    )
}
