import React, { useState, useEffect } from "react";
import { WifiOff, Info, X, PhoneCall, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Sticky Top or Bottom Notification Bar when Offline */}
      {!isOnline && (
        <div className="bg-amber-500/90 text-amber-950 dark:bg-amber-600 dark:text-amber-50 text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md transition-all animate-in slide-in-from-top sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 animate-pulse shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> You have no active internet. You can still
              create, display, download, and print your payment cards!
            </span>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="ml-3 shrink-0 underline text-xs font-bold hover:text-white"
          >
            How it works offline &rarr;
          </button>
        </div>
      )}

      {/* Floating Offline / Bad Internet Help Trigger for quick access anytime */}
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-card/90 border border-border px-3 py-1.5 text-xs font-bold shadow-lg backdrop-blur-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all group"
        title="Offline & USSD Payments without Internet"
      >
        {isOnline ? (
          <span className="flex size-2 rounded-full bg-emerald-500" />
        ) : (
          <span className="flex size-2 rounded-full bg-amber-500 animate-ping" />
        )}
        <span className="text-[11px] group-hover:text-primary transition-colors">
          {isOnline ? "Works Without Internet" : "Offline Mode"}
        </span>
        <Info className="size-3.5 text-muted-foreground" />
      </button>

      {/* Modal: Client Has No Internet / Bad Internet Guide */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl text-card-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Zero Internet? No Problem!
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    How Mobile Money &amp; Ishyura work without data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
              {/* Point 1: USSD GSM Network */}
              <div className="rounded-xl bg-muted/50 border border-border/80 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                  <PhoneCall className="size-4 text-emerald-500" />
                  <span>USSD Payments Require Zero Mobile Data</span>
                </div>
                <p>
                  In Rwanda, MTN MoMo (
                  <code className="font-mono text-primary font-bold">*182#</code>) and Airtel Money
                  operate via cellular voice signaling (GSM), <strong>not internet data</strong>.
                  Even if clients have zero airtime bundle, no Wi-Fi, or no 4G signal, their phone
                  will process the payment instantly.
                </p>
              </div>

              {/* Point 2: Camera Scan vs Manual Dial */}
              <div className="rounded-xl bg-muted/50 border border-border/80 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>How Clients Pay When Network is Weak</span>
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    <strong>Static QR Scan:</strong> Scanning opens the native phone dialer with the
                    USSD code already loaded — no web page needed!
                  </li>
                  <li>
                    <strong>Merchant Code Dial:</strong> If the client has no smartphone camera or
                    no internet, they just read the big <strong>Merchant Code</strong> on your
                    counter tent card and dial{" "}
                    <code className="font-mono text-primary font-bold">*182*8*1*CODE#</code>.
                  </li>
                </ul>
              </div>

              {/* Point 3: Ishyura Works Offline */}
              <div className="rounded-xl bg-muted/50 border border-border/80 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span>Ishyura PWA Caching</span>
                </div>
                <p>
                  All your saved payment tent cards are securely cached in your device’s local
                  memory. You can open Ishyura, display your counter QR card, download PNGs, and
                  print tent cards even if your shop loses internet connectivity entirely.
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => setShowGuide(false)}
                className="w-full rounded-xl text-xs font-bold"
              >
                Understood, Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
