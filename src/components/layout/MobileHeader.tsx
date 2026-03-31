import { useMobileHeader } from "@/contexts/MobileHeaderContext"

export function MobileHeader() {
    const { title, leftAction, rightActions } = useMobileHeader()

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-2 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
            <div className="w-10 shrink-0 flex items-center justify-start">
                {leftAction}
            </div>
            <h1 className="flex-1 text-center text-base font-semibold tracking-tight truncate px-2">
                {title}
            </h1>
            <div className="shrink-0 flex items-center justify-end gap-0.5 min-w-10">
                {rightActions}
            </div>
        </header>
    )
}
