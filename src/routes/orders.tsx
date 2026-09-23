import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Phone,
  MapPin,
  QrCode,
  Layers,
  ArrowRight,
  Loader2,
  FileText,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IshyuraClient,
  type OrderPayload,
  type OrderRecord,
  type OrderItemType,
  type UserProfile,
} from "@/lib/ishyura-client";
import { signInWithGoogleReal } from "@/lib/firebase-auth";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      {
        title: "Order Physical QR Stands & Stickers — Ishyura Rwanda",
      },
      {
        name: "description",
        content:
          "Order premium acrylic payment QR tent stands, waterproof vinyl stickers, and smart NFC merchant stands with fast delivery in Kigali & Rwanda.",
      },
    ],
  }),
  component: OrdersPage,
});

const PHYSICAL_PRODUCTS: Array<{
  id: OrderItemType;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  price: number;
  material: string;
  deliveryTime: string;
  popular?: boolean;
  features: string[];
}> = [
  {
    id: "acrylic_stand",
    title: "Premium Acrylic QR Tent Stand",
    badge: "Most Popular",
    tagline: "Crystal-clear acrylic stand for retail & restaurant counters",
    description:
      "Durable 3mm clear acrylic with high-resolution UV print of your MTN MoMo / Airtel Money QR code & USSD dial numbers. Scratch-resistant and waterproof.",
    price: 7500,
    material: "3mm Cast Acrylic & UV Print",
    deliveryTime: "Same-Day in Kigali (2-4 hrs)",
    popular: true,
    features: [
      "Custom branded with your shop name",
      "Official MTN & Airtel high-contrast QR code",
      "Sturdy L-shape angled for easy customer phone scanning",
      "Wipe-clean waterproof surface",
    ],
  },
  {
    id: "vinyl_stickers",
    title: "Waterproof Vinyl Counter Stickers",
    badge: "Pack of 5",
    tagline: "Heavy-duty laminated stickers for counters, glass & moto-taxis",
    description:
      "Pack of 5 waterproof, weather-resistant vinyl stickers designed to stick on glass counters, cash registers, delivery vehicles, and moto helmets.",
    price: 4500,
    material: "Gloss Laminated Outdoor Vinyl",
    deliveryTime: "Same-Day in Kigali",
    features: [
      "Set of 5 custom printed stickers",
      "High-tack residue-free adhesive",
      "Waterproof, sun-proof, UV-resistant",
      "Perfect for high-traffic payment points",
    ],
  },
  {
    id: "smart_nfc_stand",
    title: "Smart Tap NFC + QR Hybrid Stand",
    badge: "Next-Gen Tech",
    tagline: "Customers can scan QR or simply tap their smartphone",
    description:
      "Embedded NTAG215 smart chip allows customers with modern smartphones to simply tap the stand or scan the high-definition QR code to dial payment.",
    price: 18000,
    material: "Matte Black Acrylic + Embedded NFC",
    deliveryTime: "24-48 Hours",
    features: [
      "Built-in contactless NFC chip + QR code",
      "Pre-programmed to open your USSD dialer on tap",
      "Luxurious matte black finish with gold/white accents",
      "Works on Android & iPhone with no apps required",
    ],
  },
  {
    id: "pro_bundle",
    title: "Merchant Pro Starter Bundle",
    badge: "Best Value",
    tagline: "All-in-one payment signage kit for new shops & restaurants",
    description:
      "Everything your shop needs: 1x Acrylic Tent Stand + 5x Waterproof Counter Stickers + 2x Laminated Staff Badges with payment QR codes.",
    price: 22000,
    material: "Complete Multi-Material Kit",
    deliveryTime: "Same-Day in Kigali",
    features: [
      "1x Premium Acrylic Counter Stand",
      "5x Waterproof Vinyl Counter Stickers",
      "2x Staff Lanyard Cards with QR Codes",
      "Save 8,000 RWF compared to ordering separately",
    ],
  },
  {
    id: "custom",
    title: "Custom Shop Branding Stand",
    badge: "Custom Laser",
    tagline: "Laser-engraved mahogany wood or brushed aluminum stand",
    description:
      "High-end bespoke stand customized with your full restaurant/hotel logo, dual SIM merchant codes, and custom dimensions.",
    price: 28000,
    material: "Solid Mahogany / Brushed Aluminum",
    deliveryTime: "48-72 Hours",
    features: [
      "Custom laser engraving with your high-res logo",
      "Dual merchant codes (MTN + Airtel + Equity eKash)",
      "Premium weighted base for busy hospitality desks",
      "Dedicated design proof before production",
    ],
  },
];

export function OrdersPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OrderItemType>("acrylic_stand");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("Kigali - Nyarugenge / Downtown");
  const [customLocationDetail, setCustomLocationDetail] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderNetwork, setOrderNetwork] = useState("MTN MoMo");
  const [orderDialCode, setOrderDialCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<OrderRecord | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"catalog" | "my_orders">("catalog");
  const [orderHistory, setOrderHistory] = useState<OrderRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const user = IshyuraClient.getCurrentUser();
    setCurrentUser(user);
    if (user?.phone_number) {
      setCustomerPhone(user.phone_number);
    }

    try {
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const itemParam = searchParams.get("item") as OrderItemType | null;
        if (itemParam && PHYSICAL_PRODUCTS.some((p) => p.id === itemParam)) {
          setSelectedProduct(itemParam);
        }
        const tabParam = searchParams.get("tab");
        if (tabParam === "my_orders") {
          setActiveTab("my_orders");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const loadOrders = async () => {
    setLoadingHistory(true);
    try {
      const orders = await IshyuraClient.listOrders();
      setOrderHistory(orders);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "my_orders") {
      loadOrders();
    }
  }, [activeTab]);

  const activeProductData =
    PHYSICAL_PRODUCTS.find((p) => p.id === selectedProduct) || PHYSICAL_PRODUCTS[0];
  const totalPrice = activeProductData.price * quantity;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!customerName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 8) {
      setSubmitError("Please enter a valid Rwandan phone number for delivery updates.");
      return;
    }
    if (!businessName.trim()) {
      setSubmitError("Please enter your shop or business name to print on the stand.");
      return;
    }

    const fullLocation = customLocationDetail.trim()
      ? `${deliveryLocation} (${customLocationDetail.trim()})`
      : deliveryLocation;

    setSubmitting(true);
    try {
      const payload: OrderPayload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        business_name: businessName.trim(),
        delivery_location: fullLocation,
        item_type: selectedProduct,
        quantity,
        total_price: totalPrice,
        notes: orderNotes.trim() || undefined,
        network: orderNetwork,
        dial_code: orderDialCode.trim() || undefined,
      };

      const result = await IshyuraClient.createOrder(payload);
      setSubmitSuccess(result);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout currentUser={currentUser} onUserChange={setCurrentUser}>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Ishyura Hardware & Merch
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">Express Delivery across Rwanda</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Physical Payment Stands & Counter Stickers
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Elevate your checkout desk with durable, laser-crafted acrylic stands, waterproof
              stickers, and contactless smart NFC payment cards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "catalog" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("catalog")}
              className="text-xs font-semibold gap-1.5"
            >
              <Package className="size-3.5" />
              <span>Products & Order</span>
            </Button>
            <Button
              variant={activeTab === "my_orders" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("my_orders")}
              className="text-xs font-semibold gap-1.5"
            >
              <Clock className="size-3.5" />
              <span>Recent Orders</span>
            </Button>
          </div>
        </div>

        {activeTab === "catalog" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Product Showcase Catalog */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Select Product Type</h2>
                <span className="text-xs text-muted-foreground">Prices in Rwandan Francs (RWF)</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {PHYSICAL_PRODUCTS.map((prod) => {
                  const isSelected = selectedProduct === prod.id;
                  const Icon =
                    prod.id === "acrylic_stand"
                      ? Package
                      : prod.id === "vinyl_stickers"
                        ? Layers
                        : prod.id === "smart_nfc_stand"
                          ? QrCode
                          : prod.id === "pro_bundle"
                            ? Sparkles
                            : FileText;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod.id)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/5 shadow-md ring-1 ring-emerald-500/30"
                          : "border-border/70 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-500 text-white shadow-xs"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">{prod.title}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  prod.popular
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : "bg-muted text-muted-foreground border-border/60"
                                }`}
                              >
                                {prod.badge}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {prod.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-extrabold text-foreground tabular-nums">
                            {prod.price.toLocaleString()} RWF
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {prod.id === "vinyl_stickers" ? "per pack of 5" : "per unit"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Truck className="size-3 text-emerald-500" />
                            <span>{prod.deliveryTime}</span>
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <span>Material:</span>
                            <strong className="text-foreground">{prod.material}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSelected ? (
                            <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Selected Item
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-primary hover:underline">
                              Select Item
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery Guarantee Info */}
              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                  <Truck className="size-4 text-emerald-500" />
                  <span>Doorstep Delivery Across Rwanda</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Same-day express delivery in Kigali (Nyarugenge, Gasabo, Kicukiro) within 2-4
                  hours of order confirmation. Upcountry delivery via Horizon, Volcano, or Ritco
                  express parcel services.
                </p>
              </div>
            </div>

            {/* Right: Real Order Form */}
            <div className="lg:col-span-5">
              <div className="sticky top-6 rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5">
                {submitSuccess ? (
                  <div className="space-y-4 text-center py-4">
                    <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Order Placed Successfully!
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Order Reference:{" "}
                        <span className="font-mono font-bold text-foreground">
                          {submitSuccess.order_number}
                        </span>
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 text-left text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Item:</span>
                        <span className="font-semibold text-foreground">
                          {activeProductData.title} (x{submitSuccess.quantity})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Business:</span>
                        <span className="font-semibold text-foreground">
                          {submitSuccess.business_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {submitSuccess.total_price.toLocaleString()} RWF
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery:</span>
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {submitSuccess.delivery_location}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Our production dispatch team will contact you on{" "}
                      <span className="font-semibold text-foreground">
                        {submitSuccess.customer_phone}
                      </span>{" "}
                      to confirm your mock preview before delivery.
                    </p>

                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSubmitSuccess(null);
                          setQuantity(1);
                        }}
                        className="w-full text-xs font-semibold"
                      >
                        Place Another Order
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("my_orders")}
                        className="w-full text-xs font-semibold"
                      >
                        View Order Status
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitOrder} className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-foreground">Order Configuration</h3>
                      <p className="text-xs text-muted-foreground">
                        Configuring:{" "}
                        <span className="font-semibold text-foreground">
                          {activeProductData.title}
                        </span>
                      </p>
                    </div>

                    {submitError && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    {/* Quantity Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">Quantity</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-xl bg-background overflow-hidden">
                          <button
                            type="button"
                            disabled={quantity <= 1}
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="px-4 text-xs font-bold tabular-nums">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity((q) => q + 1)}
                            className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="text-xs font-extrabold text-foreground tabular-nums">
                          Total: {totalPrice.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>

                    {/* Shop / Business Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        Shop / Business Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. Kigali Fresh Market / Bourbon Coffee"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Contact Name & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">
                          Contact Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="text"
                          placeholder="Your full name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">
                          Phone Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="tel"
                          placeholder="e.g. 0788 123 456"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          required
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* Payment Network on Stand */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">Primary Network</Label>
                        <Select value={orderNetwork} onValueChange={setOrderNetwork}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MTN MoMo">MTN Mobile Money</SelectItem>
                            <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                            <SelectItem value="Equity eKash">Equity Bank eKash</SelectItem>
                            <SelectItem value="Multi-Network">Multi-Network (Both)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">Merchant / Till Code</Label>
                        <Input
                          type="text"
                          placeholder="e.g. 123456 or phone"
                          value={orderDialCode}
                          onChange={(e) => setOrderDialCode(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* Delivery Location */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        Delivery Sector / Area <span className="text-red-500">*</span>
                      </Label>
                      <Select value={deliveryLocation} onValueChange={setDeliveryLocation}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kigali - Nyarugenge / Downtown">
                            Kigali - Nyarugenge / Downtown
                          </SelectItem>
                          <SelectItem value="Kigali - Gasabo (Kacyiru / Kimihurura / Remera)">
                            Kigali - Gasabo (Kacyiru / Kimihurura / Remera)
                          </SelectItem>
                          <SelectItem value="Kigali - Kicukiro (Gikondo / Sonatubes / Kanombe)">
                            Kigali - Kicukiro (Gikondo / Sonatubes / Kanombe)
                          </SelectItem>
                          <SelectItem value="Rubavu / Gisenyi">Rubavu / Gisenyi (Express Bus)</SelectItem>
                          <SelectItem value="Musanze / Ruhengeri">Musanze / Ruhengeri (Express Bus)</SelectItem>
                          <SelectItem value="Huye / Butare">Huye / Butare (Express Bus)</SelectItem>
                          <SelectItem value="Other District in Rwanda">Other District in Rwanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        Street / Building / Landmark
                      </Label>
                      <Input
                        type="text"
                        placeholder="e.g. UTC Mall 2nd Floor / Near Chic Building"
                        value={customLocationDetail}
                        onChange={(e) => setCustomLocationDetail(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-10 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      {submitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShoppingBag className="size-4" />
                      )}
                      <span>
                        Confirm & Order ({totalPrice.toLocaleString()} RWF)
                      </span>
                    </Button>

                    <p className="text-[10px] text-muted-foreground text-center">
                      Payment on delivery or via MoMo upon mock approval.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Orders History Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Order Tracking & History</h2>
                <p className="text-xs text-muted-foreground">
                  Track your physical merchant stands and delivery statuses
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadOrders}
                disabled={loadingHistory}
                className="text-xs h-8 gap-1.5"
              >
                {loadingHistory ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Package className="size-3.5" />
                )}
                <span>Refresh</span>
              </Button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
                <span>Loading your orders...</span>
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center space-y-3">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">No physical orders yet</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Order your first custom acrylic stand or counter stickers today.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("catalog")}
                  className="text-xs font-semibold"
                >
                  Browse Merchandise
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {orderHistory.map((order) => {
                  const statusColors = {
                    pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
                    processing: "bg-sky-500/10 text-sky-600 border-sky-500/30",
                    delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                    cancelled: "bg-red-500/10 text-red-600 border-red-500/30",
                  };

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-foreground">
                            {order.order_number}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusColors[order.status] || statusColors.pending}`}
                          >
                            {order.status}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {order.business_name}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium">
                          {order.item_type.replace(/_/g, " ")} (x{order.quantity}) ·{" "}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {order.total_price.toLocaleString()} RWF
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          <span>{order.delivery_location}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-muted-foreground block">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          Contact: {order.customer_phone}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
