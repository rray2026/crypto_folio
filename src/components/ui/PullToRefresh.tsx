import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull if we are at the top of the scroll container
      if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
        startY.current = e.touches[0].pageY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Prevent default scroll behavior when pulling down at the top
        if (e.cancelable) e.preventDefault();
        
        // Resistance factor
        const progress = Math.min(diff / 2.5, PULL_THRESHOLD + 20);
        setPullProgress(progress);
      } else {
        setIsPulling(false);
        setPullProgress(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;

      if (pullProgress >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullProgress(PULL_THRESHOLD);
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullProgress(0);
          setIsPulling(false);
        }
      } else {
        setPullProgress(0);
        setIsPulling(false);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isPulling, isRefreshing, pullProgress, onRefresh]);

  return (
    <div 
      ref={scrollContainerRef}
      className="relative h-full overflow-y-auto"
    >
      <div 
        className="absolute left-0 right-0 flex justify-center overflow-hidden transition-all duration-200 pointer-events-none"
        style={{ 
          height: `${pullProgress}px`,
          opacity: pullProgress / PULL_THRESHOLD,
          top: 0,
          zIndex: 50
        }}
      >
        <div className="flex items-center justify-center p-4">
          <RefreshCw 
            className={`w-6 h-6 text-primary transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ 
              transform: isRefreshing ? undefined : `rotate(${pullProgress * 4}deg)` 
            }}
          />
        </div>
      </div>
      <div 
        className="transition-transform duration-200"
        style={{ transform: `translateY(${pullProgress}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
