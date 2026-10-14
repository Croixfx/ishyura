import { QrCode, Radio, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MONETIZATION_PRICES } from "@/lib/payment";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function ProductsSection({ onGetStarted }: LandingSectionProps) {
  return (
    <section
      id="products"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15"
    >
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
            Product Offerings
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            Two Tailored Products for Rwanda Merchants
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Choose between direct offline telecom USSD or a flexible, dynamic Cloudflare edge
            payment page.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Ishyura Offline Card */}
          <div className="rounded-2xl border-2 border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm hover:border-foreground/40 transition-colors">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <QrCode className="size-6" />
                </div>
                <Badge variant="secondary" className="text-[11px] font-bold">
                  Direct Telecom USSD
                </Badge>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">Ishyura Offline</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed font-medium">
                  Accept payments directly through USSD. No Ishyura webpage required.
                </p>
              </div>

              <div className="border-t border-border/60 pt-5 space-y-3.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Direct USSD QR Generation:</strong> Encodes
                    an instant telecom dial string (
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                      *182*8*1*...#
                    </code>
                    ) that opens the phone dialer directly.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Zero Customer Internet:</strong> Customers
                    can pay without mobile data or internet access.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Amount Flexibility:</strong> Predefined
                    fixed amount or customer-entered amount through the provider menu.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">1 Included Output:</strong> Free initial QR
                    &amp; PDF download for registered merchants; additional outputs require a modest
                    top-up.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Hardware &amp; NFC Ready:</strong> Optional
                    laser-cut acrylic stands and NFC rewrite cards.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 space-y-2">
              <Button
                onClick={() => onGetStarted("offline")}
                className="w-full h-11 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
              >
                <span>Select Ishyura Offline</span>
                <ChevronRight className="size-4" />
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                No subscription required for basic offline QR generation
              </p>
            </div>
          </div>

          {/* Ishyura Online Card */}
          <div className="rounded-2xl border-2 border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm hover:border-foreground/40 transition-colors">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Radio className="size-6" />
                </div>
                <Badge variant="secondary" className="text-[11px] font-bold">
                  Edge Payment Page
                </Badge>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-foreground">Ishyura Online</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed font-medium">
                  Use a payment page with flexible configuration and online engagement analytics.
                </p>
              </div>

              <div className="border-t border-border/60 pt-5 space-y-3.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">HTTPS Edge Payment URL:</strong> QR code
                    opens an instant Ishyura payment sheet hosted on Cloudflare edge.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Remotely Editable Bills:</strong> Update
                    prices or item names anytime from your phone without reprinting your counter
                    stands.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Web-Based Amount Entry:</strong> Customer
                    can enter the bill amount directly on your store checkout page.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Engagement Analytics:</strong> Track page
                    visits and scan trends over time. <em>(Note: visits do not prove payment).</em>
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">PRO Subscriptions:</strong> Verified PRO
                    entitlement for {MONETIZATION_PRICES.pro_monthly.toLocaleString()} RWF/month.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 space-y-2">
              <Button
                onClick={() => onGetStarted("online")}
                className="w-full h-11 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
              >
                <span>Select Ishyura Online</span>
                <ChevronRight className="size-4" />
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Dynamic PRO features require active entitlement
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
