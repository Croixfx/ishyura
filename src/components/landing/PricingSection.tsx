import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MONETIZATION_PRICES } from "@/lib/payment";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function PricingSection({ onGetStarted }: LandingSectionProps) {
  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
            Transparent Pricing
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            Clear, Predictable Merchant Pricing
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            No hidden fees, no forced monthly commitments for basic offline stands.
          </p>
        </div>

        {/* Pricing Tiers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Starter Tier */}
          <div className="rounded-2xl border-2 border-border/80 bg-card p-6 flex flex-col justify-between space-y-5 shadow-2xs">
            <div className="space-y-3">
              <Badge variant="secondary" className="text-[10px] font-bold">
                Included
              </Badge>
              <h3 className="font-extrabold text-base text-foreground">Starter Merchant</h3>
              <div className="pt-1">
                <span className="text-2xl font-black text-foreground">0 RWF</span>
                <span className="text-xs text-muted-foreground block">Free upon registration</span>
              </div>
              <div className="pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>1st Offline USSD QR code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>1st High-res PDF tent card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  <span>Merchant dashboard access</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => onGetStarted("offline")}
              className="w-full text-xs font-bold rounded-xl h-9"
            >
              Get Started Free
            </Button>
          </div>

          {/* 2. Extra QR Quota */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 flex flex-col justify-between space-y-5 shadow-2xs">
            <div className="space-y-3">
              <Badge variant="outline" className="text-[10px] font-bold">
                Top-up
              </Badge>
              <h3 className="font-extrabold text-base text-foreground">Additional QR</h3>
              <div className="pt-1">
                <span className="text-2xl font-black text-foreground">
                  {MONETIZATION_PRICES.extra_offline_generation.toLocaleString()} RWF
                </span>
                <span className="text-xs text-muted-foreground block">
                  Per extra card generation
                </span>
              </div>
              <div className="pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>Add new counters or staff</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>Direct telecom dial code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>Permanent merchant record</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => onGetStarted("offline")}
              className="w-full text-xs font-bold rounded-xl h-9"
            >
              Learn More
            </Button>
          </div>

          {/* 3. PDF Downloads */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 flex flex-col justify-between space-y-5 shadow-2xs">
            <div className="space-y-3">
              <Badge variant="outline" className="text-[10px] font-bold">
                Export
              </Badge>
              <h3 className="font-extrabold text-base text-foreground">PDF Tent Card</h3>
              <div className="pt-1">
                <span className="text-2xl font-black text-foreground">
                  {MONETIZATION_PRICES.pdf_download.toLocaleString()} RWF
                </span>
                <span className="text-xs text-muted-foreground block">
                  Per print-ready PDF export
                </span>
              </div>
              <div className="pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>Vector-sharp 300 DPI output</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>A6 tabletop folding guides</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                  <span>Commercial print ready</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => onGetStarted("offline")}
              className="w-full text-xs font-bold rounded-xl h-9"
            >
              Learn More
            </Button>
          </div>

          {/* 4. PRO Monthly */}
          <div className="rounded-2xl border-2 border-primary/50 bg-primary/5 p-6 flex flex-col justify-between space-y-5 shadow-md">
            <div className="space-y-3">
              <Badge
                variant="default"
                className="text-[10px] font-bold bg-primary text-primary-foreground"
              >
                PRO Plan
              </Badge>
              <h3 className="font-extrabold text-base text-foreground">Ishyura Online PRO</h3>
              <div className="pt-1">
                <span className="text-2xl font-black text-foreground">
                  {MONETIZATION_PRICES.pro_monthly.toLocaleString()} RWF
                </span>
                <span className="text-xs text-muted-foreground block">Monthly subscription</span>
              </div>
              <div className="pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Remotely editable pay link</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Real-time visit analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Change prices without reprinting</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => onGetStarted("online")}
              className="w-full text-xs font-bold rounded-xl h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Get Online PRO
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
