import { Badge } from "@/components/ui/badge";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function HowItWorksSection(_props: LandingSectionProps) {
  return (
    <section
      id="how-it-works"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60"
    >
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
              Customer aims their smartphone camera at your high-contrast QR code or taps their
              NFC-enabled smartphone against your acrylic counter stand.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
            <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-black text-base">
              2
            </div>
            <h3 className="font-extrabold text-base text-foreground">Instant Launch</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Offline:</strong> Phone immediately launches the telecom USSD dialer (
              <code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono">
                *182*8*1*...#
              </code>
              ). <br />
              <strong>Online:</strong> Phone opens high-speed payment page with your live counter
              bill.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 shadow-2xs">
            <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-black text-base">
              3
            </div>
            <h3 className="font-extrabold text-base text-foreground">Confirm with PIN</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Customer reviews the merchant name and confirms the payment with their private MoMo or
              Airtel PIN. Funds transfer immediately to your account.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
