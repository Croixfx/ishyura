import { Store, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_UNIT_PRICES } from "@/lib/order-catalog";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function FaqSection(_props: LandingSectionProps) {
  return (
    <section
      id="faq"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15"
    >
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
              <strong>No!</strong> Ishyura Offline encodes the telecom USSD dial string (
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                *182*8*1*...#
              </code>
              ) directly into the QR pattern. When a customer scans with an iPhone or Android
              camera, it opens their phone dialer instantly without connecting to any webpage or
              using mobile data.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
            <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary shrink-0" />
              <span>Which payment networks in Rwanda are supported?</span>
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              Ishyura supports <strong>MTN Mobile Money (MoMo Pay)</strong>,{" "}
              <strong>Airtel Money</strong>, and <strong>Equity Bank eKash</strong>. You can
              generate dedicated counter cards for any of these providers.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
            <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary shrink-0" />
              <span>How do I order tabletop acrylic stands in Kigali?</span>
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              Simply sign in or create a merchant account. In the Hardware Store section, select
              your desired stand (A6 Acrylic Stand for{" "}
              {ORDER_UNIT_PRICES.acrylic_stand.toLocaleString()} RWF or Vinyl Stickers for{" "}
              {ORDER_UNIT_PRICES.vinyl_stickers.toLocaleString()} RWF). We deliver directly to your
              shop in Kigali via moto courier within 24 to 48 hours.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
            <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary shrink-0" />
              <span>Can I change my price after printing the card?</span>
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              With <strong>Ishyura Online (PRO)</strong>, yes! The QR code points to your Cloudflare
              edge pay page which you can edit remotely from your phone anytime without reprinting
              your physical stand. For <strong>Ishyura Offline</strong>, you can create a card with
              a customer-entered amount where the customer enters the amount on their phone keypad.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-2">
            <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary shrink-0" />
              <span>Is the first QR code and PDF really included?</span>
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              Yes! Every registered merchant receives one included initial offline USSD QR card and
              high-resolution PDF download to get started right away.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
