import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { LandingSectionProps } from "./types";

interface LazySectionProps {
  /** Anchor id, so in-page links still land on the right spot before the section has loaded. */
  id?: string;
  /** Approximate height reserved while the section is not loaded, to avoid the page jumping. */
  minHeight: number;
  /** Dynamic import of the section module (kept at module level so it stays stable). */
  loader: () => Promise<{ default: ComponentType<LandingSectionProps> }>;
  sectionProps: LandingSectionProps;
  /** How far ahead of the viewport to start loading. */
  rootMargin?: string;
}

function Placeholder({ minHeight }: { minHeight: number }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 space-y-4 animate-pulse"
      style={{ minHeight }}
    >
      <div className="h-6 w-48 bg-muted rounded-lg mx-auto" />
      <div className="h-3 w-80 max-w-full bg-muted/70 rounded mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
        <div className="h-40 bg-muted/50 rounded-2xl" />
        <div className="h-40 bg-muted/50 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Renders a landing-page section only when it is about to scroll into view. Its code is a
 * separate download too, so the first paint only carries the hero. Without IntersectionObserver
 * (very old browsers) it loads straight away.
 */
export function LazySection({
  id,
  minHeight,
  loader,
  sectionProps,
  rootMargin = "600px 0px",
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const Section = useMemo(() => lazy(loader), [loader]);

  useEffect(() => {
    if (near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  // An in-page link (#pricing) to a section that has not loaded yet: load it right away.
  useEffect(() => {
    if (near || !id || typeof window === "undefined") return;
    const onHash = () => {
      if (window.location.hash === `#${id}`) setNear(true);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [near, id]);

  return (
    <div ref={ref} id={near ? undefined : id} className="w-full">
      {near ? (
        <Suspense fallback={<Placeholder minHeight={minHeight} />}>
          <div className="animate-in fade-in duration-500">
            <Section {...sectionProps} />
          </div>
        </Suspense>
      ) : (
        <Placeholder minHeight={minHeight} />
      )}
    </div>
  );
}
