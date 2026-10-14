import { Store, Sparkles, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_UNIT_PRICES } from "@/lib/order-catalog";
import type { LandingSectionProps } from "./types";

/** Loaded on demand as the section scrolls into view. */
export default function HardwareSection(_props: LandingSectionProps) {
  return (
    <section
      id="hardware-section"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-border/60 bg-muted/15"
    >
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
            Hardware
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            Physical Stands &amp; Counter Hardware
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Laser-cut acrylic tabletop stands and waterproof vinyl stickers engineered for busy
            Kigali shops and restaurants.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stand */}
          <div className="p-6 rounded-2xl border border-border/80 bg-card flex flex-col justify-between space-y-5 shadow-sm">
            <div className="space-y-3.5">
              <div className="size-11 rounded-xl bg-foreground/5 text-foreground flex items-center justify-center font-bold">
                <Store className="size-6" />
              </div>
              <h3 className="font-extrabold text-base text-foreground">
                A6 Tabletop Acrylic Stand
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Laser-cut crystal-clear acrylic L-stand. Protects your payment card from spills,
                grease, and wear on busy retail counters.
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
                Heavy-duty laminated vinyl stickers. Waterproof and weather-resistant for windows,
                cash registers, and takeaway counters.
              </p>
            </div>
            <div className="pt-4 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="text-lg font-black text-foreground">
                  {ORDER_UNIT_PRICES.vinyl_stickers.toLocaleString()} RWF
                </span>
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
                Solid polished hardwood stand with laser-engraved business branding. Ideal for
                boutique cafes, hotels, and upscale dining.
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
            Delivered within Kigali in 24-48 hours via fast moto courier. Payment on delivery or via
            Mobile Money.
          </p>
        </div>
      </div>
    </section>
  );
}
