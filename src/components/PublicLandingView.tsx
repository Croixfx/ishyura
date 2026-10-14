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
import { LazySection } from "@/components/landing/LazySection";

const loadProductsSection = () => import("./landing/ProductsSection");
const loadHowItWorksSection = () => import("./landing/HowItWorksSection");
const loadHardwareSection = () => import("./landing/HardwareSection");
const loadPricingSection = () => import("./landing/PricingSection");
const loadFaqSection = () => import("./landing/FaqSection");
const loadFinalCtaSection = () => import("./landing/FinalCtaSection");

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
  const sectionProps = { onGetStarted, onOpenStore, onOpenInquiry };
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
                Professional payment QR codes, laser-cut acrylic tabletop stands, and contactless
                NFC tap points for Rwandan merchants. Works natively with MTN MoMo, Airtel Money,
                and Equity Bank eKash.
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
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById("hardware-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-6 rounded-xl font-semibold text-sm border border-border/80 bg-card hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <Store className="size-4 mr-2 text-muted-foreground" />
                  <span>Explore Stands &amp; Hardware</span>
                </button>
              </div>

              {/* Supported Rwanda Networks */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                  Works with:
                </span>
                <div className="h-7 px-2.5 rounded-lg bg-[#FFCC00] text-slate-950 flex items-center gap-1.5 font-black text-[11px] shadow-2xs border border-amber-400/50 select-none">
                  <span className="bg-slate-950 text-[#FFCC00] text-[8px] font-black px-1 py-0.5 rounded-xs leading-none">
                    MTN
                  </span>
                  <span className="font-black tracking-tight leading-none">MoMo</span>
                </div>
                <div className="h-7 px-2.5 rounded-lg bg-[#E40000] text-white flex items-center gap-1 font-bold text-[11px] shadow-2xs border border-red-600/50 select-none">
                  <span className="font-extrabold lowercase tracking-tight leading-none">
                    airtel
                  </span>
                  <span className="text-[9px] font-semibold text-white/90 leading-none">
                    money
                  </span>
                </div>
                <div className="h-7 px-2.5 rounded-lg bg-[#990000] text-white flex items-center gap-1 font-bold text-[11px] shadow-2xs border border-red-900/50 select-none">
                  <span className="font-black tracking-tight leading-none">Equity</span>
                  <span className="text-[9px] font-semibold text-white/90 leading-none">
                    eKash
                  </span>
                </div>
              </div>

              {/* Trust & Policy Highlights */}
              <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-muted-foreground">
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
                      <div className="h-8 px-2.5 rounded-lg bg-[#FFCC00] text-slate-950 flex items-center gap-1.5 font-black text-xs shadow-xs border border-amber-400/50 select-none">
                        <span className="bg-slate-950 text-[#FFCC00] text-[9px] font-black px-1.5 py-0.5 rounded-xs leading-none">
                          MTN
                        </span>
                        <span className="font-black text-xs tracking-tight leading-none">MoMo</span>
                      </div>
                      <div className="h-8 px-2.5 rounded-lg bg-[#E40000] text-white flex items-center gap-1 font-bold text-xs shadow-xs border border-red-600/50 select-none">
                        <span className="font-extrabold text-xs lowercase tracking-tight leading-none">
                          airtel
                        </span>
                        <span className="text-[10px] font-semibold text-white/90 leading-none">
                          money
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold tracking-wider uppercase"
                    >
                      Sample Stand Preview
                    </Badge>
                  </div>

                  {/* Merchant Identity on Card */}
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Sample Stand Preview · Counter Card
                    </span>
                    <h3 className="text-lg font-black tracking-tight text-foreground">
                      Your Store Name Here
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
                      Sample Telecom USSD Dial String
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
                <p className="text-center text-[11px] text-muted-foreground mt-2.5">
                  ✨ When you create your stand, it will feature your real merchant name and code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Product Offerings: Ishyura Offline vs. Ishyura Online */}
      <LazySection
        id="products"
        minHeight={900}
        loader={loadProductsSection}
        sectionProps={sectionProps}
      />

      {/* 3. How Payment Initiation Works */}
      <LazySection
        id="how-it-works"
        minHeight={600}
        loader={loadHowItWorksSection}
        sectionProps={sectionProps}
      />

      {/* 4. Physical Stands & Counter Hardware */}
      <LazySection
        id="hardware-section"
        minHeight={700}
        loader={loadHardwareSection}
        sectionProps={sectionProps}
      />

      {/* 5. Clear, Transparent Pricing */}
      <LazySection
        id="pricing"
        minHeight={900}
        loader={loadPricingSection}
        sectionProps={sectionProps}
      />

      {/* 6. Frequently Asked Questions (FAQ) */}
      <LazySection id="faq" minHeight={700} loader={loadFaqSection} sectionProps={sectionProps} />

      {/* 7. Bottom Call to Action */}
      <LazySection
        id={undefined}
        minHeight={320}
        loader={loadFinalCtaSection}
        sectionProps={sectionProps}
      />

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
            <button
              type="button"
              onClick={() =>
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("hardware-section")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Hardware
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })
              }
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              FAQ
            </button>
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
