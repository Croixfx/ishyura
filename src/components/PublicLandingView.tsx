import React from "react";
import {
  QrCode,
  Radio,
  Store,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Sparkles,
  Zap,
  Package,
  ChevronRight,
  HelpCircle,
  WifiOff,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
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
    <div className="w-full bg-background text-foreground flex flex-col">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-border/60 py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headline & Action */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/80 bg-muted/60 text-xs font-semibold tracking-wide">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Rwanda Counter Payments · Instant USSD &amp; Smart Stands</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
                Get Paid Instantly at Your Counter.{" "}
                <span className="text-muted-foreground font-extrabold block sm:inline">
                  Zero Friction.
                </span>
              </h1>

              <p className="max-w-2xl mx-auto lg:mx-0 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Professional payment QR codes, laser-cut acrylic tabletop stands, and contactless NFC
                tap points for Rwandan merchants. Works natively with MTN MoMo, Airtel Money, and
                Equity Bank eKash.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => onGetStarted()}
                  className="w-full sm:w-auto h-12 px-7 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
                >
                  <span>Create Free Merchant QR</span>
                  <ArrowRight className="size-4" />
                </Button>
                <a
                  href="#hardware-section"
                  className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-6 rounded-xl font-semibold text-sm border border-border/80 bg-card hover:bg-muted/60 transition-colors"
                >
                  <Store className="size-4 mr-2 text-muted-foreground" />
                  <span>Explore Stands &amp; Hardware</span>
                </a>
              </div>

              {/* Trust & Policy Highlights */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>1st Offline QR &amp; PDF Included</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>Direct USSD (*182*8*1*...)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>Kigali Moto Delivery (24-48h)</span>
                </div>
              </div>
            </div>

            {/* Right Column: Realistic Stand & QR Tent Card Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm">
                {/* Stand Outline Background representing laser-cut acrylic */}
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-border/80 via-border/30 to-border/10 blur-xs -z-10" />

                {/* Counter Tent Card Body */}
                <div className="rounded-2xl border-2 border-border/90 bg-card p-6 shadow-xl space-y-5 text-foreground">
                  {/* Card Header with Rwanda Telecom Indicators */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center font-black text-xs">
                        MoMo
                      </div>
                      <div className="size-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-[10px]">
                        airtel
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase">
                      Official Tent Card
                    </Badge>
                  </div>

                  {/* Merchant Identity on Card */}
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Pay Merchant / Ishyura
                    </span>
                    <h3 className="text-lg font-black tracking-tight text-foreground">
                      Kigali Fresh Market
                    </h3>
                  </div>

                  {/* High-Contrast SVG QR Code Preview */}
                  <div className="p-4 rounded-xl bg-white border border-border/40 flex flex-col items-center justify-center space-y-2 shadow-inner">
                    <div className="relative size-40 bg-white flex items-center justify-center">
                      {/* Realistic Styled QR Pattern */}
                      <svg
                        viewBox="0 0 120 120"
                        className="size-full text-slate-900"
                        fill="currentColor"
                      >
                        {/* Finder pattern Top-Left */}
                        <rect x="10" y="10" width="30" height="30" rx="4" />
                        <rect x="16" y="16" width="18" height="18" fill="white" />
                        <rect x="20" y="20" width="10" height="10" />

                        {/* Finder pattern Top-Right */}
                        <rect x="80" y="10" width="30" height="30" rx="4" />
                        <rect x="86" y="16" width="18" height="18" fill="white" />
                        <rect x="90" y="20" width="10" height="10" />

                        {/* Finder pattern Bottom-Left */}
                        <rect x="10" y="80" width="30" height="30" rx="4" />
                        <rect x="16" y="86" width="18" height="18" fill="white" />
                        <rect x="20" y="90" width="10" height="10" />

                        {/* Alignment & Data modules */}
                        <rect x="48" y="15" width="6" height="6" />
                        <rect x="58" y="15" width="6" height="6" />
                        <rect x="68" y="15" width="6" height="6" />
                        <rect x="48" y="27" width="6" height="6" />
                        <rect x="58" y="35" width="6" height="6" />
                        <rect x="15" y="48" width="6" height="6" />
                        <rect x="25" y="58" width="6" height="6" />
                        <rect x="35" y="48" width="6" height="6" />
                        <rect x="48" y="48" width="8" height="8" rx="2" />
                        <rect x="64" y="48" width="8" height="8" rx="2" />
                        <rect x="48" y="64" width="8" height="8" rx="2" />
                        <rect x="64" y="64" width="8" height="8" rx="2" />
                        <rect x="80" y="48" width="6" height="6" />
                        <rect x="92" y="58" width="6" height="6" />
                        <rect x="80" y="68" width="6" height="6" />
                        <rect x="48" y="80" width="6" height="6" />
                        <rect x="58" y="92" width="6" height="6" />
                        <rect x="68" y="80" width="6" height="6" />
                        <rect x="80" y="80" width="8" height="8" />
                        <rect x="98" y="80" width="8" height="8" />
                        <rect x="90" y="95" width="8" height="8" />
                      </svg>

                      {/* Center Ishyura Token */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="size-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-[11px] shadow-md border-2 border-white">
                          I
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Scan with Camera to Pay
                    </span>
                  </div>

                  {/* MoMo Pay Code Banner */}
                  <div className="rounded-xl bg-muted/80 p-2.5 text-center space-y-0.5 border border-border/60">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">
                      Direct Telecom USSD Dial String
                    </p>
                    <code className="text-sm font-black tracking-wide text-foreground font-mono">
                      *182*8*1*042189#
                    </code>
                  </div>

                  {/* NFC Touchpoint Note */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Zap className="size-3.5 text-amber-500" />
                      <span>NFC Tap-to-Pay Capable</span>
                    </div>
                    <span className="font-semibold text-foreground">A6 Tabletop Acrylic</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Product Offerings: Ishyura Offline vs. Ishyura Online */}
      <section id="products" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Product Offerings
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              Two Tailored Products for Rwanda Merchants
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Choose between direct offline telecom USSD or a flexible, dynamic Cloudflare edge payment page.
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
                      <strong className="text-foreground">Direct USSD QR Generation:</strong> Encodes an instant telecom dial string (<code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">*182*8*1*...#</code>) that opens the phone dialer directly.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Zero Customer Internet:</strong> Customers can pay without mobile data or internet access.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Amount Flexibility:</strong> Predefined fixed amount or customer-entered amount through the provider menu.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">1 Included Output:</strong> Free initial QR &amp; PDF download for registered merchants; additional outputs require a modest top-up.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Hardware &amp; NFC Ready:</strong> Optional laser-cut acrylic stands and NFC rewrite cards.
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
                      <strong className="text-foreground">HTTPS Edge Payment URL:</strong> QR code opens an instant Ishyura payment sheet hosted on Cloudflare edge.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Remotely Editable Bills:</strong> Update prices or item names anytime from your phone without reprinting your counter stands.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Web-Based Amount Entry:</strong> Customer can enter the bill amount directly on your store checkout page.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Engagement Analytics:</strong> Track page visits and scan trends over time. <em>(Note: visits do not prove payment).</em>
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">PRO Subscriptions:</strong> Verified PRO entitlement for {MONETIZATION_PRICES.pro_monthly.toLocaleString()} RWF/month.
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

      {/* 3. How Payment Initiation Works */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Payment Flow
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              How Payment Initiation Works
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Fast, frictionless 3-step checkout at your store counter with any phone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
              <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-black text-base">
                1
              </div>
              <h3 className="font-extrabold text-base text-foreground">Scan or Tap</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customer aims their smartphone camera at your high-contrast QR code or taps their NFC-enabled smartphone against your acrylic counter stand.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
              <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-black text-base">
                2
              </div>
              <h3 className="font-extrabold text-base text-foreground">Instant Launch</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Offline:</strong> Phone immediately launches the telecom USSD dialer (<code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono">*182*8*1*...#</code>). <br />
                <strong>Online:</strong> Phone opens high-speed payment page with your live counter bill.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
              <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-black text-base">
                3
              </div>
              <h3 className="font-extrabold text-base text-foreground">Confirm with PIN</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customer reviews the merchant name and confirms the payment with their private MoMo or Airtel PIN. Funds transfer immediately to your account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Physical Stands & Counter Hardware */}
      <section id="hardware-section" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              Hardware
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              Physical Stands &amp; Counter Hardware
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Laser-cut acrylic tabletop stands and waterproof vinyl stickers engineered for busy Kigali shops and restaurants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stand */}
            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-5 shadow-sm">
              <div className="space-y-3.5">
                <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Store className="size-6" />
                </div>
                <h3 className="font-extrabold text-base text-foreground">A6 Tabletop Acrylic Stand</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Laser-cut crystal-clear acrylic L-stand. Protects your payment card from spills, grease, and wear on busy retail counters.
                </p>
              </div>
              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-foreground">5,000 RWF</span>
                  <span className="text-[10px] text-muted-foreground block">Delivered in Kigali</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  Popular
                </Badge>
              </div>
            </div>

            {/* Stickers */}
            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-5 shadow-sm">
              <div className="space-y-3.5">
                <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Package className="size-6" />
                </div>
                <h3 className="font-extrabold text-base text-foreground">Pack of 5 Vinyl Stickers</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Heavy-duty laminated vinyl stickers. Waterproof and weather-resistant for windows, cash registers, and takeaway counters.
                </p>
              </div>
              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-foreground">3,000 RWF</span>
                  <span className="text-[10px] text-muted-foreground block">Pack of 5 units</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  Multi-Pack
                </Badge>
              </div>
            </div>

            {/* Wooden Stand */}
            <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-5 shadow-sm">
              <div className="space-y-3.5">
                <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="font-extrabold text-base text-foreground">Engraved Hardwood Stand</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Solid polished hardwood stand with laser-engraved business branding. Ideal for boutique cafes, hotels, and upscale dining.
                </p>
              </div>
              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-foreground">12,000 RWF</span>
                  <span className="text-[10px] text-muted-foreground block">Custom Engraved</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  Premium
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-card/80 text-center max-w-xl mx-auto space-y-1 shadow-2xs">
            <p className="text-xs font-semibold text-foreground">
              📦 Physical stands can be ordered directly from your merchant studio
            </p>
            <p className="text-[11px] text-muted-foreground">
              Delivered within Kigali in 24-48 hours via fast moto courier. Payment on delivery or via Mobile Money.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Clear, Transparent Pricing */}
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
                  <span className="text-xs text-muted-foreground block">Per extra card generation</span>
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
                  <span className="text-xs text-muted-foreground block">Per print-ready PDF export</span>
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
                <Badge variant="default" className="text-[10px] font-bold bg-primary text-primary-foreground">
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

      {/* 6. Frequently Asked Questions (FAQ) */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15">
        <div className="mx-auto max-w-4xl space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              FAQ
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Everything you need to know about Ishyura payment cards and hardware in Rwanda.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>Does a customer need an internet connection to pay with Ishyura Offline?</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                <strong>No!</strong> Ishyura Offline encodes the telecom USSD dial string (<code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">*182*8*1*...#</code>) directly into the QR pattern. When a customer scans with an iPhone or Android camera, it opens their phone dialer instantly without connecting to any webpage or using mobile data.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>Which payment networks in Rwanda are supported?</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                Ishyura supports <strong>MTN Mobile Money (MoMo Pay)</strong>, <strong>Airtel Money</strong>, and <strong>Equity Bank eKash</strong>. You can generate dedicated counter cards for any of these providers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>How do I order tabletop acrylic stands in Kigali?</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                Simply sign in or create a merchant account. In the Hardware Store section, select your desired stand (A6 Acrylic Stand for 5,000 RWF or Vinyl Stickers for 3,000 RWF). We deliver directly to your shop in Kigali via moto courier within 24 to 48 hours.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>Can I change my price after printing the card?</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                With <strong>Ishyura Online (PRO)</strong>, yes! The QR code points to your Cloudflare edge pay page which you can edit remotely from your phone anytime without reprinting your physical stand. For <strong>Ishyura Offline</strong>, you can create a card with a customer-entered amount where the customer enters the amount on their phone keypad.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                <HelpCircle className="size-4 text-primary shrink-0" />
                <span>Is the first QR code and PDF really included?</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
                Yes! Every registered merchant receives one included initial offline USSD QR card and high-resolution PDF download to get started right away.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bottom Call to Action */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
            Ready to Modernize Your Counter?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Create your merchant account to select your product and generate your official Rwandan payment tent card today.
          </p>
        </div>
        <div className="pt-2">
          <Button
            size="lg"
            onClick={() => onGetStarted()}
            className="h-12 px-8 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm"
          >
            <span>Create Account / Sign In</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      {/* 8. Polished Footer */}
      <footer className="border-t border-border/60 bg-muted/20 pt-12 pb-20 sm:pb-14 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-xs">
              <QrCode className="size-4" />
            </div>
            <div>
              <p className="font-black text-foreground">Ishyura Rwanda</p>
              <p className="text-[11px] text-muted-foreground">
                Payment QR Codes &amp; Smart Stands · Kigali 🇷🇼
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
            <a href="#products" className="hover:text-foreground transition-colors">
              Products
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#hardware-section" className="hover:text-foreground transition-colors">
              Hardware
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
            {onOpenInquiry && (
              <button
                type="button"
                onClick={onOpenInquiry}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Contact Support
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground text-center sm:text-right">
            © {new Date().getFullYear()} Ishyura. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
