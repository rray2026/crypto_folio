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
  
  const PULL_THRESHOLD = 80;
  const RESISTANCE = 2.5;

  useEffect(() => {
    const container = scrollContainerRef.current;
    const indicator = pullIndicatorRef.current;
    const content = contentRef.current;
    const icon = iconRef.current;

    if (!container || !indicator || !content || !icon) return;

    const updateStyles = (y: number) => {
      const opacity = Math.min(y / PULL_THRESHOLD, 1);
      const rotation = y * 4;
      
      indicator.style.height = `${y}px`;
      indicator.style.opacity = `${opacity}`;
      content.style.transform = `translateY(${y}px)`;
      
      if (!isRefreshing) {
        icon.style.transform = `rotate(${rotation}deg)`;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].pageY;
        isPulling.current = true;
        
        // Remove transitions during manual pull
        indicator.style.transition = 'none';
        content.style.transition = 'none';
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const diff = e.touches[0].pageY - startY.current;

      if (diff > 0) {
        if (e.cancelable) e.preventDefault();
        
        // Apply resistance and limit maximum pull
        currentPull.current = Math.min(diff / RESISTANCE, PULL_THRESHOLD + 30);
        
        // Use RequestAnimationFrame for smooth updates
        requestAnimationFrame(() => updateStyles(currentPull.current));
      } else {
        isPulling.current = false;
        currentPull.current = 0;
        requestAnimationFrame(() => updateStyles(0));
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      // Add smooth transitions for snapping back or showing refresh state
      indicator.style.transition = 'all 0.3s cubic-bezier(0.2, 0, 0, 1)';
      content.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';

      if (currentPull.current >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        currentPull.current = PULL_THRESHOLD;
        updateStyles(PULL_THRESHOLD);
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          currentPull.current = 0;
          updateStyles(0);
        }
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
      className="relative h-full overflow-y-auto overscroll-none"
    >
      <div 
        ref={pullIndicatorRef}
        className="absolute left-0 right-0 flex justify-center overflow-hidden pointer-events-none z-50 h-0 opacity-0"
        style={{ top: 0 }}
      >
        <div className="flex items-center justify-center p-4">
          <RefreshCw 
            ref={iconRef}
            className={`w-6 h-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>
      <div 
        ref={contentRef}
        className="will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
