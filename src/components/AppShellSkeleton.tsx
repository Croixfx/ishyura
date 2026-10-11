import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton() {
  return (
    <div className="fixed inset-0 w-full h-full bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* 1. Sleek Top Navbar Skeleton */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="space-y-1.5 hidden sm:block">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-3.5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        </div>

        {/* Right Nav Action Skeletons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Skeleton className="h-8 w-24 rounded-xl hidden sm:block" />
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      </header>

      {/* 2. Body: Sidebar + Main Content Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Skeleton (Desktop) */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 bg-card/40 p-4 space-y-6 shrink-0">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 mb-2 rounded" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>

          <div className="space-y-1 pt-4 border-t border-border/40">
            <Skeleton className="h-3 w-20 mb-2 rounded" />
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>

          <div className="mt-auto pt-4 border-t border-border/40 space-y-2">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/30">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Workspace Skeleton */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
          {/* Top Bar / Product Mode Indicator Skeleton */}
          <div className="p-4 rounded-2xl border border-border/60 bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-xl" />
            </div>
          </div>

          {/* Form & Stand Preview Dual-Column Layout Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-5 rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6 shadow-xs">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>

              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-2">
                <Skeleton className="h-4 w-44 rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>

              <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            {/* Stand Mockup Preview Column */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4 shadow-sm text-center">
                <Skeleton className="h-4 w-32 mx-auto rounded" />
                <Skeleton className="size-52 mx-auto rounded-2xl" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-4 w-40 mx-auto rounded" />
                  <Skeleton className="h-3 w-48 mx-auto rounded" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
