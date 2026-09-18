import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import {
  Download,
  Loader2,
  Moon,
  Sun,
  Zap,
  PhoneCall,
  Store,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Ishyura — Instant MoMo Payment QR Codes",
      },
      {
        name: "description",
        content:
          "Create printable Mobile Money payment QR tent cards for your shop in seconds. Zero login, works with MTN MoMo and Airtel Money for Merchant Codes and Phone Numbers.",
      },
      { property: "og:title", content: "Ishyura — Instant MoMo Payment QR Codes" },
      {
        property: "og:description",
        content:
          "Create printable Mobile Money payment QR tent cards for your shop in seconds. Zero login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

export type Network = "MTN MoMo" | "Airtel Money";
export type PaymentType = "momo_code" | "phone";

export interface ProviderConfig {
  name: Network;
  brandColor: string;
  momoCodeLabel: string;
  momoCodePlaceholder: string;
  phonePlaceholder: string;
  prefixes: {
    momo_code: string; // Dialing a merchant / till / agent code
    phone: string; // Transferring / sending money to a mobile number
  };
}

export const PROVIDERS: Record<Network, ProviderConfig> = {
  "MTN MoMo": {
    name: "MTN MoMo",
    brandColor: "#ffcc00",
    momoCodeLabel: "MoMo Pay Merchant Code",
    momoCodePlaceholder: "e.g. 123456",
    phonePlaceholder: "e.g. 0788 123 456",
    prefixes: {
      momo_code: "*182*8*1*",
      phone: "*182*1*1*",
    },
  },
  "Airtel Money": {
    name: "Airtel Money",
    brandColor: "#e60000",
    momoCodeLabel: "Airtel Merchant / Till Code",
    momoCodePlaceholder: "e.g. 567890",
    phonePlaceholder: "e.g. 0733 123 456 or 0722 123 456",
    prefixes: {
      momo_code: "*182*8*1*",
      phone: "*182*1*1*",
    },
  },
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("ishyura-theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("ishyura-theme", next);
      return next;
    });
  };

  return { theme, toggle };
}

interface ConfirmedCardData {
  businessName: string;
  network: Network;
  paymentType: PaymentType;
  sanitizedInput: string;
  ussdString: string;
  qrTelUri: string;
}

function Index() {
  const [businessName, setBusinessName] = useState("");
  const [network, setNetwork] = useState<Network>("MTN MoMo");
  const [paymentType, setPaymentType] = useState<PaymentType>("momo_code");
  const [accountValue, setAccountValue] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Verification & Confirmation state: prevents generating or exporting incomplete/miskeyed codes
  const [confirmedData, setConfirmedData] = useState<ConfirmedCardData | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  const currentProvider = PROVIDERS[network];

  // Clean formatted input (stripping non-digits and spacing)
  const sanitizedInput = useMemo(() => accountValue.replace(/[^0-9]/g, "").trim(), [accountValue]);

  // Validation rules tailored to Rwanda mobile money
  const validationError = useMemo(() => {
    if (!businessName.trim()) {
      return "Please enter your business or shop name.";
    }
    if (!sanitizedInput) {
      return paymentType === "momo_code"
        ? "Please enter your Merchant / MoMo Pay code."
        : "Please enter your mobile phone number.";
    }
    if (paymentType === "momo_code") {
      if (sanitizedInput.length < 4 || sanitizedInput.length > 8) {
        return "Merchant codes are typically 5 to 7 digits long.";
      }
    } else {
      // Phone number: standard Rwandan format is 10 digits (e.g. 078XXXXXXX or 073XXXXXXX)
      if (sanitizedInput.length < 9 || sanitizedInput.length > 12) {
        return "Please enter a valid phone number (e.g. 0788 123 456).";
      }
    }
    return null;
  }, [businessName, sanitizedInput, paymentType]);

  const canConfirm = !validationError;

  // Selected USSD code for draft
  const draftUssdPrefix = currentProvider.prefixes[paymentType];
  const draftUssdString = `${draftUssdPrefix}${sanitizedInput}#`;

  // When user edits inputs, if previously confirmed, we keep the previous confirmed card
  // until they confirm changes or explicitly reset.
  const handleConfirmAndGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canConfirm) return;

    const ussdString = `${currentProvider.prefixes[paymentType]}${sanitizedInput}#`;
    const qrTelUri = `tel:${encodeURIComponent(ussdString)}`;

    setConfirmedData({
      businessName: businessName.trim(),
      network,
      paymentType,
      sanitizedInput,
      ussdString,
      qrTelUri,
    });
  };

  const handleEdit = () => {
    setConfirmedData(null);
  };

  const handleDownload = async () => {
    if (!cardRef.current || !confirmedData) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      const typeSlug = confirmedData.paymentType === "momo_code" ? "code" : "phone";
      link.download = `${confirmedData.businessName.replace(/\s+/g, "_")}_${confirmedData.network.replace(/\s+/g, "_")}_${typeSlug}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12 pt-6 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl shadow-md shadow-sky-500/20">
              <img src="/favicon.svg" alt="Ishyura Scanner Logo" className="size-10 object-cover" />
            </span>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-foreground">Ishyura</span>
              <span className="ml-2 hidden text-xs font-semibold text-muted-foreground sm:inline-block">
                Instant MoMo Payment QR Cards
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <span className="relative flex size-5 items-center justify-center">
              <Sun
                className={`absolute size-5 transition-all duration-300 ${
                  theme === "dark"
                    ? "scale-0 -rotate-90 opacity-0"
                    : "scale-100 rotate-0 opacity-100"
                }`}
              />
              <Moon
                className={`absolute size-5 transition-all duration-300 ${
                  theme === "dark"
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-0 rotate-90 opacity-0"
                }`}
              />
            </span>
          </Button>
        </header>

        {/* Main Content Grid: 1 column on mobile/tablets, 2 columns on desktop/laptops */}
        <main className="mt-8 grid flex-1 grid-cols-1 items-start gap-8 lg:mt-12 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Form & Confirmation step */}
          <section className="lg:col-span-6 xl:col-span-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Get paid with a scan
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Create a printable Mobile Money QR tent card for your counter. Review and confirm
                your details before generating to guarantee zero mistakes.
              </p>
            </div>

            {/* Form & Verification Block */}
            <form
              onSubmit={handleConfirmAndGenerate}
              className="mt-6 space-y-5 rounded-2xl border border-border/60 bg-card/50 p-5 shadow-xs sm:p-6 lg:mt-8"
            >
              <div className="space-y-2">
                <Label htmlFor="business-name" className="text-sm font-semibold">
                  Business / Counter Name
                </Label>
                <Input
                  id="business-name"
                  placeholder="e.g. Kigali Fresh Market"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (confirmedData) setConfirmedData(null);
                  }}
                  autoComplete="off"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="network" className="text-sm font-semibold">
                  Payment Network
                </Label>
                <Select
                  value={network}
                  onValueChange={(v) => {
                    setNetwork(v as Network);
                    if (confirmedData) setConfirmedData(null);
                  }}
                >
                  <SelectTrigger id="network" className="h-11">
                    <SelectValue placeholder="Choose network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN MoMo">MTN MoMo</SelectItem>
                    <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Type Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Method Type</Label>
                <Tabs
                  value={paymentType}
                  onValueChange={(val) => {
                    setPaymentType(val as PaymentType);
                    if (confirmedData) setConfirmedData(null);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
                    <TabsTrigger
                      value="momo_code"
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold sm:text-sm"
                    >
                      <Store className="size-4 shrink-0" />
                      <span>Merchant Code</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="phone"
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold sm:text-sm"
                    >
                      <PhoneCall className="size-4 shrink-0" />
                      <span>Phone Number</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-[11px] text-muted-foreground">
                  {paymentType === "momo_code"
                    ? "For registered merchant/till codes (dials *182*8*1*code#)."
                    : "For direct personal/agent phone number transfers (dials *182*1*1*number#)."}
                </p>
              </div>

              {/* Number or Code input */}
              <div className="space-y-2">
                <Label htmlFor="account-value" className="text-sm font-semibold">
                  {paymentType === "momo_code"
                    ? currentProvider.momoCodeLabel
                    : "Recipient Mobile Phone Number"}
                </Label>
                <Input
                  id="account-value"
                  type="tel"
                  inputMode="numeric"
                  placeholder={
                    paymentType === "momo_code"
                      ? currentProvider.momoCodePlaceholder
                      : currentProvider.phonePlaceholder
                  }
                  value={accountValue}
                  onChange={(e) => {
                    setAccountValue(e.target.value);
                    if (confirmedData) setConfirmedData(null);
                  }}
                  autoComplete="off"
                  className="h-11 font-mono text-base"
                />
              </div>

              {/* Confirmation Action & Checklist */}
              <div className="pt-2">
                {confirmedData ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Details Confirmed
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleEdit}
                        className="h-7 text-xs text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                      >
                        <RotateCcw className="size-3 mr-1" />
                        Edit details
                      </Button>
                    </div>
                    <p className="leading-relaxed">
                      QR card is locked and ready for export using code{" "}
                      <strong className="font-mono text-foreground font-semibold">
                        {confirmedData.ussdString}
                      </strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sanitizedInput.length > 0 && validationError && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        {validationError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={!canConfirm}
                      className="w-full h-12 text-sm sm:text-base font-bold shadow-md shadow-primary/25"
                    >
                      <Sparkles className="size-4" />
                      Confirm &amp; Generate QR Card
                      <ArrowRight className="size-4" />
                    </Button>

                    <p className="text-[11px] text-center text-muted-foreground">
                      Double-check your{" "}
                      {paymentType === "momo_code" ? "merchant code" : "phone number"} carefully
                      before confirming.
                    </p>
                  </div>
                )}
              </div>
            </form>

            {/* Practical instructions / feature badges */}
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-card/30 p-3">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Dual USSD Routing
                </p>
                <p className="mt-0.5">
                  Automatically chooses the proper USSD syntax for codes or phone numbers.
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/30 p-3">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Mistake Prevention
                </p>
                <p className="mt-0.5">
                  Validates formats and requires user confirmation before generating the QR code.
                </p>
              </div>
            </div>
          </section>

          {/* Right Column: Live Payment Card Preview & Download */}
          <section className="lg:col-span-6 lg:col-start-7 xl:col-span-7 flex flex-col items-center justify-center">
            {confirmedData ? (
              <div className="w-full max-w-sm space-y-5 lg:sticky lg:top-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Generated Card
                  </p>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Verified &amp; Ready
                  </span>
                </div>

                {/* Printable card — fixed white surface so it prints cleanly */}
                <div
                  ref={cardRef}
                  className="w-full overflow-hidden rounded-2xl bg-print-surface text-print-ink shadow-2xl shadow-black/15 transition-all duration-300"
                >
                  <div className="gradient-strip h-2.5 w-full" />
                  <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-print-muted-ink">
                        {confirmedData.paymentType === "momo_code" ? "Merchant Pay" : "Send Money"}
                      </span>
                      <span className="text-[10px] rounded-sm bg-print-muted px-1.5 py-0.5 font-bold uppercase text-print-muted-ink">
                        {confirmedData.network}
                      </span>
                    </div>

                    <p className="mt-1.5 max-w-full truncate text-2xl font-black tracking-tight">
                      {confirmedData.businessName}
                    </p>

                    <div className="mt-4 rounded-2xl border-2 border-print-muted bg-white p-3.5 shadow-xs">
                      <QRCodeSVG
                        value={confirmedData.qrTelUri}
                        size={180}
                        level="M"
                        fgColor="#0f172a"
                        bgColor="#ffffff"
                      />
                    </div>

                    <div className="mt-4 w-full rounded-xl bg-print-muted px-4 py-2.5">
                      <p className="text-[10px] font-semibold uppercase text-print-muted-ink">
                        {confirmedData.paymentType === "momo_code" ? "MoMo Code" : "Phone Number"}:{" "}
                        {confirmedData.sanitizedInput}
                      </p>
                      <p className="font-mono text-sm font-bold tracking-tight text-print-ink">
                        {confirmedData.ussdString}
                      </p>
                    </div>

                    <p className="mt-3 text-[11px] font-medium text-print-muted-ink">
                      Scan with camera &amp; tap Call to pay
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-print-muted bg-print-muted/40 px-5 py-3">
                    <span className="text-[11px] font-semibold text-print-muted-ink">
                      {confirmedData.paymentType === "momo_code"
                        ? "Registered Merchant"
                        : "Direct Number"}
                    </span>
                    <span className="text-sm font-extrabold text-primary">Ishyura</span>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Download className="size-5" />
                  )}
                  {downloading ? "Preparing your card…" : "Download High-Res Card (PNG)"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Print it, fold as a tent card, or place on your shop counter.
                </p>
              </div>
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/20 px-6 py-14 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                  <Zap className="size-7 opacity-40" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  {canConfirm ? "Ready for confirmation" : "Awaiting your details"}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
                  {canConfirm ? (
                    <>
                      Target USSD dial string:{" "}
                      <strong className="font-mono text-foreground font-semibold">
                        {draftUssdString}
                      </strong>
                      . Click <strong>Confirm &amp; Generate QR Card</strong> to generate the
                      exportable card.
                    </>
                  ) : (
                    "Fill in your business name and merchant code or phone number, then verify and confirm to preview and download."
                  )}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
