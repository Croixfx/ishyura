import React, { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ScrollProgressiveSectionProps {
  id?: string;
  className?: string;
  skeletonHeight?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export function ScrollProgressiveSection({
  id,
  className = "",
  skeletonHeight = "min-h-[360px]",
  children,
  fallback,
  threshold = 0.05,
  rootMargin = "250px 0px",
}: ScrollProgressiveSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If IntersectionObserver is unavailable or SSR, reveal immediately
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div id={id} ref={containerRef} className={className}>
      {isVisible ? (
        <div className="animate-in fade-in duration-500 fill-mode-both">{children}</div>
      ) : (
        fallback || (
          <div className={`w-full ${skeletonHeight} p-6 sm:p-12 space-y-6 flex flex-col justify-center`}>
            <div className="space-y-3 max-w-md mx-auto text-center">
              <Skeleton className="h-4 w-32 mx-auto rounded-full" />
              <Skeleton className="h-8 w-64 mx-auto rounded-xl" />
              <Skeleton className="h-4 w-48 mx-auto rounded-md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full pt-4">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl hidden md:block" />
            </div>
          </div>
        )
      )}
    </div>
  );
}
