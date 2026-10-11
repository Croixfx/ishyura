import React, { useState, useEffect, useRef } from "react";

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
  children,
  threshold = 0.01,
  rootMargin = "300px 0px",
}: ScrollProgressiveSectionProps) {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    <div
      id={id}
      ref={containerRef}
      className={`w-full transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-1"
      } ${className}`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "0 400px",
      }}
    >
      {children}
    </div>
  );
}
