import React, { useState, useEffect } from "react";
import { Download, Share2, X, Smartphone, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

export const PWAInstallButton: React.FC<{
  className?: string;
  variant?: "default" | "outline" | "ghost";
}> = ({ className = "", variant = "outline" }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant={variant}
        size="sm"
        className={`flex items-center gap-1.5 rounded-full text-xs font-bold shadow-xs transition hover:scale-105 active:scale-95 ${className}`}
      >
        <Download className="size-3.5 text-primary" />
        <span>Install App</span>
      </Button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl text-card-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Install Ishyura App</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Works offline directly on your home screen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {isIOS ? (
              /* iOS Safari Instructions */
              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-foreground">Share</strong> icon (
                    <Share2 className="inline size-3 text-primary mx-0.5" />) at the bottom of Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    2
                  </span>
                  <p>
                    Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    3
                  </span>
                  <p>
                    Tap <strong className="text-foreground">Add</strong> in the top right. Ishyura will appear on your home screen!
                  </p>
                </div>
              </div>
            ) : (
              /* Android / Chrome / Edge Instructions */
              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-foreground">Menu icon (⋮)</strong> in your browser's top-right corner.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    2
                  </span>
                  <p>
                    Select <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    3
                  </span>
                  <p>
                    Confirm <strong className="text-foreground">Install</strong>. Ishyura will open as a full standalone app.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="size-3.5" />
                <span>Zero download fee</span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowGuide(false)}
                className="h-8 rounded-xl px-4 text-xs font-bold"
              >
                Got It
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
