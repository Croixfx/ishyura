import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Package,
  Truck,
  Loader2,
  Phone,
  Store,
  MapPin,
  Tag,
  Radio,
} from "lucide-react";
import { IshyuraClient, type OrderItemType, type OrderPayload } from "@/lib/ishyura-client";

export interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBusinessName?: string;
  defaultPhone?: string;
  network?: string;
  dialCode?: string;
  preselectedProduct?: OrderItemType;
}

interface ProductOption {
  id: OrderItemType;
  title: string;
  priceRwf: number;
  badge: string;
  popular?: boolean;
  description: string;
  features: string[];
}

const PRODUCTS: ProductOption[] = [
  {
    id: "acrylic_stand",
    title: "Premium Acrylic Counter Stand",
    priceRwf: 5000,
    badge: "Most Popular",
    popular: true,
    description: "Sleek, transparent, scratch-resistant A6 L-shape counter display.",
    features: [
      "Heavy-duty crystal clear acrylic",
      "High-resolution fade-resistant print",
      "Official network badge (MTN / Airtel / Equity)",
      "Ready to sit on your cashier desk immediately",
    ],
  },
  {
    id: "vinyl_stickers",
    title: "Pack of 5 Waterproof Vinyl Stickers",
    priceRwf: 3500,
    badge: "Weatherproof",
    description: "UV-laminated outdoor grade decals for counters, doors, glass & delivery boxes.",
    features: [
      "5 custom printed stickers with your QR & MoMo code",
      "100% waterproof and scratch resistant",
      "Sticks firmly to glass, metal, wood, or plastic",
      "Wipeable with sanitizer or wet cloth",
    ],
  },
  {
    id: "smart_nfc_stand",
    title: "Smart Acrylic Stand (QR + Tap)",
    priceRwf: 8000,
    badge: "Next-Gen",
    description: "The ultimate modern stand. Customers can scan the QR code OR tap capable phones.",
    features: [
      "High quality acrylic stand with your MoMo code",
      "Embedded fast contactless chip for phone tap",
      "Zero battery or charging needed",
      "Instant dialer prompt on customer smartphones",
    ],
  },
  {
    id: "pro_bundle",
    title: "Merchant Pro Starter Kit",
    priceRwf: 9500,
    badge: "Best Value",
    description: "1x Premium Acrylic Stand + 5x Waterproof Stickers + Counter Mat decal.",
    features: [
      "1x Acrylic Stand for the main checkout counter",
      "5x Heavy-duty Vinyl Decals for doors and windows",
      "Priority same-day processing in Kigali",
      "Save 2,500 RWF compared to buying separately",
    ],
  },
];

export function OrderDialog({
  open,
  onOpenChange,
  defaultBusinessName = "",
  defaultPhone = "",
  network = "MTN MoMo",
  dialCode = "*182*8*1*...",
  preselectedProduct = "acrylic_stand",
}: OrderDialogProps) {
  const [selectedProduct, setSelectedProduct] = useState<OrderItemType>(preselectedProduct);
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>(defaultPhone);
  const [businessName, setBusinessName] = useState<string>(defaultBusinessName);
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(null);

  // Sync defaults when dialog opens or defaults change
  React.useEffect(() => {
    if (defaultBusinessName && !businessName) {
      setBusinessName(defaultBusinessName);
    }
    if (defaultPhone && !customerPhone) {
      setCustomerPhone(defaultPhone);
    }
    if (preselectedProduct) {
      setSelectedProduct(preselectedProduct);
    }
  }, [defaultBusinessName, defaultPhone, preselectedProduct, businessName, customerPhone]);

  const defaultProd = PRODUCTS[0]!;
  const currentProduct = PRODUCTS.find((p) => p.id === selectedProduct) ?? defaultProd;
  const totalPrice = currentProduct.priceRwf * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = customerName.trim();
    const phone = (customerPhone || "").trim();
    const bName = (businessName || "").trim();
    const location = deliveryLocation.trim();

    if (!name) {
      setError("Please provide your name or contact person.");
      return;
    }
    if (!phone || phone.replace(/[^0-9]/g, "").length < 8) {
      setError("Please provide a valid Rwandan phone number (e.g. 0788 123 456).");
      return;
    }
    if (!location) {
      setError(
        "Please specify your delivery location (e.g. Kimironko Market Stall 12 or Nyarugenge UTC).",
      );
      return;
    }

    setLoading(true);
    try {
      const payload: OrderPayload = {
        customer_name: name,
        customer_phone: phone,
        business_name: bName || name,
        delivery_location: location,
        item_type: selectedProduct,
        quantity,
        total_price: totalPrice,
        notes: notes.trim() || undefined,
        network,
        dial_code: dialCode,
      };

      const res = await IshyuraClient.createOrder(payload);
      setCompletedOrderNumber(res.order_number);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setCompletedOrderNumber(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Package className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Order Physical Stands &amp; Stickers
              </DialogTitle>
              <DialogDescription className="text-xs">
                Turn your digital QR code into durable, branded counter displays delivered to your
                shop in Kigali.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {completedOrderNumber ? (
          <div className="py-6 text-center space-y-4 animate-in fade-in">
            <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Order Received
              </span>
              <h3 className="text-xl font-black text-foreground mt-0.5">{completedOrderNumber}</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                Murakoze! Your order for{" "}
                <strong>
                  {quantity}x {currentProduct.title}
                </strong>{" "}
                has been logged in our system. Our Kigali team will call / WhatsApp you at{" "}
                <strong>{customerPhone}</strong> to confirm delivery time and payment upon arrival.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-left max-w-sm mx-auto space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product</span>
                <span className="font-semibold text-foreground">{currentProduct.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery to</span>
                <span className="font-semibold text-foreground">{deliveryLocation}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                <span>Total Due on Delivery</span>
                <span className="text-primary text-sm">{totalPrice.toLocaleString()} RWF</span>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleResetAndClose} className="w-full sm:w-auto px-8">
                Done &amp; Return
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Product selection tiles */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1. Choose Your Physical Display</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRODUCTS.map((prod) => {
                  const isSelected = selectedProduct === prod.id;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedProduct(prod.id)}
                      className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
                          : "border-border/70 bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              prod.popular
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {prod.badge}
                          </span>
                          <span className="text-xs font-black text-foreground">
                            {prod.priceRwf.toLocaleString()} RWF
                          </span>
                        </div>
                        <p className="text-xs font-bold text-foreground leading-snug">
                          {prod.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {prod.description}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                        ✓ {prod.features[0]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity and dynamic total */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div>
                <span className="text-xs font-bold text-foreground">Quantity</span>
                <p className="text-[10px] text-muted-foreground">
                  Multiple stands for different stalls / registers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-8 w-8 p-0"
                >
                  -
                </Button>
                <span className="font-mono font-bold text-sm px-2 text-foreground">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-8 w-8 p-0"
                >
                  +
                </Button>
                <div className="ml-3 text-right">
                  <span className="text-xs font-black text-primary block">
                    {totalPrice.toLocaleString()} RWF
                  </span>
                  <span className="text-[9px] text-muted-foreground">Pay on delivery</span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold">2. Delivery &amp; Contact Details</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cust-name" className="text-[11px] text-muted-foreground">
                    Your Name / Contact Person
                  </Label>
                  <Input
                    id="cust-name"
                    placeholder="e.g. Eric Mugisha"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cust-phone" className="text-[11px] text-muted-foreground">
                    Phone / WhatsApp Number
                  </Label>
                  <Input
                    id="cust-phone"
                    type="tel"
                    placeholder="0788 123 456"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-loc" className="text-[11px] text-muted-foreground">
                  Shop / Delivery Location (Kigali)
                </Label>
                <div className="relative">
                  <MapPin className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    id="cust-loc"
                    placeholder="e.g. Kimironko Market Stall 24, Nyarugenge Commercial, or Kicukiro Sonatubes"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="h-9 text-xs pl-8"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-notes" className="text-[11px] text-muted-foreground">
                  Special Notes or Instructions (Optional)
                </Label>
                <Input
                  id="cust-notes"
                  placeholder="e.g. Call before delivery, add stall number on print"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Delivery reassurance badge */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
              <Truck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">
                  Cash / MoMo on Delivery in Kigali
                </span>
                <p className="text-[11px] mt-0.5">
                  You only pay after our moto courier delivers your stand to your hands and you
                  inspect the print quality.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-xs font-bold gap-2 shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Recording Your Order…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Confirm Order ({totalPrice.toLocaleString()} RWF)</span>
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
