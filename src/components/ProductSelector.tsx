import React from "react";
import {
  QrCode,
  Radio,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type MerchantEntitlementsResponse } from "@/lib/ishyura-client";

interface ProductSelectorProps {
  merchantName?: string | null;
  entitlements?: MerchantEntitlementsResponse | null;
  onSelectProduct: (product: "offline" | "online") => void;
}

export function ProductSelector({
  merchantName,
  entitlements,
  onSelectProduct,
}: ProductSelectorProps) {
  const offlineAvailable = entitlements?.offline_generations?.available ?? 1;
  const isPro = Boolean(entitlements?.is_pro);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:pt-14 pb-20 sm:px-6 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
          Select Your Product
        </Badge>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
          Choose Your Payment Setup
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {merchantName ? `Welcome, ${merchantName}. ` : ""}
          Select how you would like customer phones to initiate payments at your counter.
        </p>

        {/* Entitlements Status Pill */}
        {entitlements && (
          <div className="inline-flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground bg-muted/30 border border-border/60 px-4 py-2 rounded-xl">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>
                Offline Quota: <strong>{offlineAvailable}</strong> available
              </span>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${isPro ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              <span>
                PRO Plan: <strong>{isPro ? "Active" : "Standard"}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* The Two Minimal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch max-w-3xl mx-auto">
        {/* Card 1: Ishyura Offline */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs hover:border-foreground/50 transition-all">
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
              <h2 className="text-xl font-black text-foreground">Ishyura Offline</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Accept payments directly through USSD. No Ishyura webpage required.
              </p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>Direct telecom USSD dial codes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>Fixed or customer-entered amounts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>1 included initial QR &amp; PDF download</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => onSelectProduct("offline")}
              className="w-full h-11 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
            >
              <span>Select Ishyura Offline</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Card 2: Ishyura Online */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs hover:border-foreground/50 transition-all">
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
              <h2 className="text-xl font-black text-foreground">Ishyura Online</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Use a payment page with flexible configuration and online engagement analytics.
              </p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>HTTPS payment page hosted on edge</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>Remotely editable bill without reprinting</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-foreground shrink-0" />
                <span>Online counter visit and engagement analytics</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => onSelectProduct("online")}
              className="w-full h-11 rounded-xl font-bold text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
            >
              <span>Select Ishyura Online</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
