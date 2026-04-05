import { useRef, useCallback, type ReactNode } from "react"

export interface SwipeAction {
    icon: ReactNode;
    bg: string;
    onAction: () => void;
}

interface SwipeActionsProps {
    actions: SwipeAction[];
    children: ReactNode;
    /** Width per action button in px (default 64) */
    actionWidth?: number;
    /** Disable swipe (e.g. in selection mode) */
    disabled?: boolean;
    /** Additional classes on the outer container (e.g. override rounding) */
    className?: string;
}

/**
 * Wraps a card and reveals action buttons when swiped left on touch devices.
 * Desktop is unaffected — the inner content renders normally.
 */
export function SwipeActions({ actions, children, actionWidth = 64, disabled = false, className = "rounded-xl" }: SwipeActionsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const startY = useRef(0);
    const currentX = useRef(0);
    const isTracking = useRef(false);
    const isOpen = useRef(false);
    const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);

    const totalWidth = actions.length * actionWidth;

    const setTranslate = useCallback((x: number, animate: boolean) => {
        const el = containerRef.current?.firstElementChild as HTMLElement | null;
        if (!el) return;
        el.style.transition = animate ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
        el.style.transform = `translateX(${x}px)`;
        // Dynamic rounding: full rounded when closed, square right side when offset
        el.style.borderRadius = x < 0 ? '0.75rem 0 0 0.75rem' : '';
    }, []);

    const snapTo = useCallback((open: boolean) => {
        isOpen.current = open;
        setTranslate(open ? -totalWidth : 0, true);
    }, [totalWidth, setTranslate]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled) return;
        const touch = e.touches[0];
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        currentX.current = isOpen.current ? -totalWidth : 0;
        isTracking.current = true;
        directionLocked.current = null;
    }, [disabled, totalWidth]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isTracking.current || disabled) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX.current;
        const dy = touch.clientY - startY.current;

        // Lock direction after 8px of movement
        if (!directionLocked.current) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            directionLocked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        }

        // If vertical scroll, bail out
        if (directionLocked.current === 'vertical') {
            isTracking.current = false;
            return;
        }

        const base = isOpen.current ? -totalWidth : 0;
        const raw = base + dx;
        // Clamp: no overswipe right of 0, rubber-band past totalWidth
        const clamped = Math.max(-totalWidth * 1.2, Math.min(0, raw));
        currentX.current = clamped;
        setTranslate(clamped, false);
    }, [disabled, totalWidth, setTranslate]);

    const handleTouchEnd = useCallback(() => {
        if (!isTracking.current || disabled) return;
        isTracking.current = false;

        if (directionLocked.current !== 'horizontal') {
            return;
        }

        const threshold = totalWidth * 0.35;
        if (isOpen.current) {
            // If swiped back right enough, close
            snapTo(currentX.current > -totalWidth + threshold ? false : true);
        } else {
            // If swiped left enough, open
            snapTo(currentX.current < -threshold ? true : false);
        }
    }, [disabled, totalWidth, snapTo]);

    // Close on outside click when open
    const handleContentClick = useCallback(() => {
        if (isOpen.current) {
            snapTo(false);
        }
    }, [snapTo]);

    return (
        <div
            ref={containerRef}
            className={`relative overflow-x-clip md:overflow-visible ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Foreground content — slides left, opaque bg prevents action bleed-through */}
            <div className="relative z-10 bg-background rounded-xl overflow-hidden" onClick={handleContentClick}>
                {children}
            </div>

            {/* Action buttons — revealed behind on the right */}
            <div
                className="absolute inset-y-0 right-0 flex md:hidden rounded-r-xl overflow-hidden"
                style={{ width: totalWidth }}
            >
                {actions.map((action, i) => (
                    <button
                        key={i}
                        className={`flex items-center justify-center ${action.bg} text-white active:brightness-90 transition-colors`}
                        style={{ width: actionWidth }}
                        onClick={(e) => {
                            e.stopPropagation();
                            snapTo(false);
                            action.onAction();
                        }}
                    >
                        {action.icon}
                    </button>
                ))}
            </div>
        </div>
    );
}
