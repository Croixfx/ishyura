import React from "react";
import {
  QrCode,
  Radio,
  Store,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Sparkles,
  Zap,
  Package,
  Layers,
  ExternalLink,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MONETIZATION_PRICES } from "@/lib/payment";

interface PublicLandingViewProps {
  onGetStarted: (targetProduct?: "offline" | "online") => void;
  onOpenStore?: () => void;
  onOpenInquiry?: () => void;
}

export function PublicLandingView({
  onGetStarted,
  onOpenStore,
  onOpenInquiry,
}: PublicLandingViewProps) {
  return (
    <div className="min-h-full w-full bg-background text-foreground flex flex-col">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-border/60 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/80 bg-muted/40 text-xs font-semibold tracking-wide">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Rwanda Counter Payments · Instant USSD &amp; Smart Stands</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
            Get Paid Instantly at Your Counter. <br className="hidden sm:inline" />
            <span className="text-muted-foreground font-extrabold">Zero Friction.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Professional payment QR codes, laser-cut acrylic stands, and NFC tap points for merchants in Rwanda.
            Works natively with MTN MoMo, Airtel Money, and Equity Bank eKash.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => onGetStarted()}
              className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
            >
              <span>Sign In / Get Started</span>
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                const el = document.getElementById("hardware-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto h-12 px-6 rounded-xl font-semibold text-sm border-border/80 hover:bg-muted/40"
            >
              <Store className="size-4 mr-2" />
              <span>Explore Stands &amp; Hardware</span>
            </Button>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>1st Offline QR &amp; PDF Included</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>Direct Rwanda Telecom USSD</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>Kigali Moto Delivery Available</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Product Comparison: Ishyura Offline vs Ishyura Online */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/10">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Product Offerings
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Two Tailored Products for Rwanda Merchants
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Choose the exact payment experience suited to your shop, cooperative, or restaurant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* Ishyura Offline Card */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs hover:border-foreground/40 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                    <QrCode className="size-6" />
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    Direct USSD
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-black text-foreground">Ishyura Offline</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed font-medium">
                    Accept payments directly through USSD. No Ishyura webpage required.
                  </p>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Direct USSD QR Generation:</strong> Encodes instant telecom dial string (<code className="text-[11px] bg-muted px-1 py-0.5 rounded">*182*8*1*...#</code>).
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Amount Flexibility:</strong> Predefined fixed amount or customer-entered amount through the provider menu.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">1 Included Output:</strong> Free initial QR &amp; PDF download for registered merchants; additional outputs require a modest top-up.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Hardware Ready:</strong> Works seamlessly with laser-cut acrylic stands and NFC counter tags.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-2">
                <Button
                  onClick={() => onGetStarted("offline")}
                  className="w-full h-11 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                >
                  <span>Select Ishyura Offline</span>
                  <ChevronRight className="size-4" />
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  No subscription required for basic offline generation
                </p>
              </div>
            </div>

            {/* Ishyura Online Card */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs hover:border-foreground/40 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                    <Radio className="size-6" />
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    Dynamic Edge Page
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-black text-foreground">Ishyura Online</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed font-medium">
                    Use a payment page with flexible configuration and online engagement analytics.
                  </p>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Secure Payment Link:</strong> Encodes an Ishyura HTTPS pay URL hosted on Cloudflare edge.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Remote Bill Updates:</strong> Change price or item name instantly from your phone without reprinting physical stands.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Engagement Analytics:</strong> Track page visits and customer engagement. <em>(Note: visits do not prove payment).</em>
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-foreground shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">PRO Subscriptions:</strong> Verified PRO entitlement for {MONETIZATION_PRICES.pro_monthly.toLocaleString()} RWF/month.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-2">
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

      {/* 3. How QR and NFC Tap Work */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/60">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Payment Flow
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              How Payment Initiation Works
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Simple 3-step checkout at your counter using any customer phone.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-3">
              <div className="size-9 rounded-lg bg-foreground/5 text-foreground flex items-center justify-center font-black text-sm">
                1
              </div>
              <h3 className="font-bold text-sm text-foreground">Scan or Tap</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customer aims their smartphone camera at the high-contrast QR code or taps their phone against your Ishyura NFC counter stand.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-3">
              <div className="size-9 rounded-lg bg-foreground/5 text-foreground flex items-center justify-center font-black text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-foreground">Instant Launch</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Offline:</strong> Phone immediately launches telecom USSD dialer. <br />
                <strong>Online:</strong> Phone opens high-speed payment page with your live counter bill.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-3">
              <div className="size-9 rounded-lg bg-foreground/5 text-foreground flex items-center justify-center font-black text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-foreground">Confirm with PIN</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customer confirms the payment with their private telecom PIN. Funds transfer immediately to your registered merchant account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Physical Stands & Hardware */}
      <section id="hardware-section" className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/10">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Hardware
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Physical Stands &amp; Counter Hardware
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Heavy-duty tabletop acrylic stands and vinyl stickers engineered for busy Kigali shops and markets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="size-10 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Store className="size-5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">A6 Tabletop Acrylic Stand</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Laser-cut crystal-clear L-stand. Protects your payment card from spills, grease, and wear on busy retail counters.
                </p>
              </div>
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-base font-black text-foreground">5,000 RWF</span>
                <span className="text-[11px] text-muted-foreground">Kigali Delivery</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="size-10 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Package className="size-5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Pack of 5 Vinyl Stickers</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Heavy-duty waterproof laminated stickers. Ideal for cash registers, entrance doors, and takeaway service points.
                </p>
              </div>
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-base font-black text-foreground">3,000 RWF</span>
                <span className="text-[11px] text-muted-foreground">Pack of 5</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="size-10 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Sparkles className="size-5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Engraved Wooden Stand</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Solid hardwood stand with your custom business branding. Perfect for boutique cafes, hotels, and upscale restaurants.
                </p>
              </div>
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-base font-black text-foreground">12,000 RWF</span>
                <span className="text-[11px] text-muted-foreground">Custom Engraved</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-card/80 text-center max-w-xl mx-auto space-y-1">
            <p className="text-xs font-semibold text-foreground">
              📦 Physical stands can be ordered directly upon registration
            </p>
            <p className="text-[11px] text-muted-foreground">
              Delivered within Kigali within 24-48 hours. Payment on delivery or via Mobile Money.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Clear Pricing */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-border/60">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Transparent Pricing
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Clear, Predictable Merchant Pricing
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              No hidden fees, no forced monthly commitments for basic offline stands.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-muted/30">
                <tr>
                  <th className="p-3.5 sm:p-4 font-bold text-foreground">Product / Service</th>
                  <th className="p-3.5 sm:p-4 font-bold text-foreground">Price</th>
                  <th className="p-3.5 sm:p-4 font-bold text-foreground hidden sm:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="p-3.5 sm:p-4 font-semibold text-foreground">
                    Initial Offline QR &amp; PDF Download
                  </td>
                  <td className="p-3.5 sm:p-4 font-black text-foreground">Included</td>
                  <td className="p-3.5 sm:p-4 text-muted-foreground hidden sm:table-cell">
                    1 initial generation &amp; high-res PDF included for registered merchants
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 sm:p-4 font-semibold text-foreground">
                    Additional Offline QR Generation
                  </td>
                  <td className="p-3.5 sm:p-4 font-black text-foreground">
                    {MONETIZATION_PRICES.extra_offline_generation.toLocaleString()} RWF
                  </td>
                  <td className="p-3.5 sm:p-4 text-muted-foreground hidden sm:table-cell">
                    Per additional offline payment card generation
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 sm:p-4 font-semibold text-foreground">
                    High-Resolution PDF Card Download
                  </td>
                  <td className="p-3.5 sm:p-4 font-black text-foreground">
                    {MONETIZATION_PRICES.pdf_download.toLocaleString()} RWF
                  </td>
                  <td className="p-3.5 sm:p-4 text-muted-foreground hidden sm:table-cell">
                    Per additional print-ready high-resolution PDF export
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 sm:p-4 font-semibold text-foreground">
                    Ishyura Online Dynamic PRO
                  </td>
                  <td className="p-3.5 sm:p-4 font-black text-foreground">
                    {MONETIZATION_PRICES.pro_monthly.toLocaleString()} RWF / mo
                  </td>
                  <td className="p-3.5 sm:p-4 text-muted-foreground hidden sm:table-cell">
                    Remotely editable counter bill, edge pay page &amp; engagement analytics
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 sm:p-4 font-semibold text-foreground">
                    A6 Tabletop Acrylic Stand
                  </td>
                  <td className="p-3.5 sm:p-4 font-black text-foreground">5,000 RWF</td>
                  <td className="p-3.5 sm:p-4 text-muted-foreground hidden sm:table-cell">
                    Laser-cut acrylic hardware delivered to your shop
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. Bottom Call to Action */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground">
          Ready to Modernize Your Counter?
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Sign in or create your merchant account to select your product and generate your official payment card.
        </p>
        <div className="pt-2">
          <Button
            size="lg"
            onClick={() => onGetStarted()}
            className="h-12 px-8 rounded-xl font-bold text-sm bg-foreground text-background hover:bg-foreground/90 gap-2"
          >
            <span>Create Account / Sign In</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
