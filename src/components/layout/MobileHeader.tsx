import { useMobileHeader } from "@/hooks/useMobileHeader"

export function MobileHeader() {
    const { title, leftAction, rightActions } = useMobileHeader()

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-2 border-b border-primary/10 bg-card/90 backdrop-blur-xl backdrop-saturate-[1.8] md:hidden shadow-[0_1px_12px_hsl(var(--primary)/0.06)]">
            <div className="w-10 shrink-0 flex items-center justify-start">
                {leftAction}
            </div>
            <h1 className="flex-1 text-center text-[15px] font-semibold tracking-tight truncate px-2">
                {title}
            </h1>
            <div className="shrink-0 flex items-center justify-end gap-0.5 min-w-10">
                {rightActions}
            </div>
        </header>
    )
}
