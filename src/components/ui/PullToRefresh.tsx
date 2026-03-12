import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pullIndicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  
  const startY = useRef(0);
  const currentPull = useRef(0);
  const isPulling = useRef(false);
  const hasVibrated = useRef(false);
  
  const PULL_THRESHOLD = 50;
  const MAX_PULL = 90;

  useEffect(() => {
    const container = scrollContainerRef.current;
    const indicator = pullIndicatorRef.current;
    const content = contentRef.current;
    const icon = iconRef.current;

    if (!container || !indicator || !content || !icon) return;

    const updateStyles = (y: number) => {
      const opacity = Math.min(y / PULL_THRESHOLD, 1);
      const rotation = y * 6;
      const isOverThreshold = y >= PULL_THRESHOLD;
      
      indicator.style.height = `${y}px`;
      indicator.style.opacity = `${opacity}`;
      content.style.transform = `translateY(${y}px)`;
      
      if (!isRefreshing) {
        icon.style.transform = `rotate(${rotation}deg) scale(${isOverThreshold ? 1.25 : 1})`;
        icon.style.color = isOverThreshold ? 'var(--primary)' : 'currentColor';
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].pageY;
        isPulling.current = true;
        hasVibrated.current = false;
        
        indicator.style.transition = 'none';
        content.style.transition = 'none';
        icon.style.transition = 'transform 0.1s ease-out, color 0.1s ease-out';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const diff = e.touches[0].pageY - startY.current;

      if (diff > 0) {
        if (e.cancelable) e.preventDefault();
        
        // Very direct response: 1.0 coeff and 0.9 power
        const resistance = 1.0;
        currentPull.current = Math.min(Math.pow(diff, 0.9) * resistance, MAX_PULL);
        
        // Haptic feedback when threshold is crossed
        if (currentPull.current >= PULL_THRESHOLD && !hasVibrated.current) {
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }
          hasVibrated.current = true;
        } else if (currentPull.current < PULL_THRESHOLD) {
          hasVibrated.current = false;
        }

        requestAnimationFrame(() => updateStyles(currentPull.current));
      } else {
        isPulling.current = false;
        currentPull.current = 0;
        requestAnimationFrame(() => updateStyles(0));
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      // Premium spring-like snapback curve
      const snapbackTransition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      indicator.style.transition = snapbackTransition;
      content.style.transition = snapbackTransition;

      if (currentPull.current >= PULL_THRESHOLD) {
        // Fire-and-forget: Trigger refresh without blocks
        onRefresh().catch(console.error);
        
        // Show brief "refreshing" state before immediate snapback
        setIsRefreshing(true);
        setTimeout(() => {
          setIsRefreshing(false);
          currentPull.current = 0;
          updateStyles(0);
        }, 600);
      } else {
        currentPull.current = 0;
        updateStyles(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing]);

  return (
    <div 
      ref={scrollContainerRef}
      className="relative h-full overflow-y-auto overscroll-none scroll-smooth touch-pan-y"
      style={{ overscrollBehaviorY: 'none' }}
    >
      <div 
        ref={pullIndicatorRef}
        className="absolute left-0 right-0 flex justify-center overflow-hidden pointer-events-none z-50 h-0 opacity-0"
        style={{ top: 0 }}
      >
        <div className="flex items-center justify-center p-4">
          <RefreshCw 
            ref={iconRef}
            className={`w-6 h-6 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>
      <div 
        ref={contentRef}
        className="will-change-transform h-full"
      >
        {children}
      </div>
    </div>
  );
}
