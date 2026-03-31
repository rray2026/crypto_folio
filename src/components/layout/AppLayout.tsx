import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"
import { MobileHeader } from "./MobileHeader"
import { MobileHeaderProvider } from "@/contexts/MobileHeaderContext"

export function AppLayout() {
    return (
        <MobileHeaderProvider>
            <div className="flex h-screen w-full bg-background text-foreground font-sans antialiased overflow-hidden">
                <Sidebar />
                <MobileHeader />
                <main className="flex-1 overflow-y-auto pb-16 pt-14 md:pb-0 md:pt-0">
                    <Outlet />
                </main>
                <MobileNav />
            </div>
        </MobileHeaderProvider>
    )
}
