import React, { useState, useEffect } from "react";
import { Download, Share2, X, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

export const PWAInstallButton: React.FC<{
  className?: string;
  variant?: "default" | "outline" | "ghost";
}> = ({ className = "", variant = "outline" }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
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

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        onClick={install}
        variant={variant}
        size="sm"
        className={`flex items-center gap-1.5 rounded-full text-xs font-bold shadow-sm transition ${className}`}
      >
        <Download className="size-3.5 text-primary animate-bounce" />
        <span>Install App</span>
      </Button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <Button
          onClick={() => setShowIOSGuide(true)}
          variant={variant}
          size="sm"
          className={`flex items-center gap-1.5 rounded-full text-xs font-bold shadow-sm transition ${className}`}
        >
          <Smartphone className="size-3.5 text-primary" />
          <span>Install on iPhone</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl text-card-foreground">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Share2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Install Ishyura on iOS</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Works 100% offline from home screen
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-foreground">Share</strong> icon at the bottom of
                    Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    2
                  </span>
                  <p>
                    Scroll down and tap{" "}
                    <strong className="text-foreground">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    3
                  </span>
                  <p>
                    Tap <strong className="text-foreground">Add</strong> in the top right. Ishyura
                    will appear on your home screen ready for offline use!
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl text-xs font-bold"
              >
                Got It
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
