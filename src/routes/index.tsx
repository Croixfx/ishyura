import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { Download, Loader2, Moon, Sun, Zap } from "lucide-react";

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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Ishyura — Instant MoMo Payment QR Codes",
      },
      {
        name: "description",
        content:
          "Create printable Mobile Money payment QR tent cards for your shop in seconds. Zero login, works with MTN MoMo and Airtel Money.",
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

type Network = "MTN MoMo" | "Airtel Money";

const USSD_PREFIX: Record<Network, string> = {
  "MTN MoMo": "*182*8*1*",
  "Airtel Money": "*182*2*1*",
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

function Index() {
  const [businessName, setBusinessName] = useState("");
  const [network, setNetwork] = useState<Network>("MTN MoMo");
  const [phone, setPhone] = useState("");
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  const ready = businessName.trim().length > 0 && phone.trim().length > 0;

  const ussdString = useMemo(
    () => (ready ? `${USSD_PREFIX[network]}${phone.trim()}#` : ""),
    [network, phone, ready],
  );

  // Phone dialer URI: using tel: URI scheme with encoded '#' (%23)
  // When scanned by camera apps (iOS & Android), the OS recognizes it as a phone action/dialer call instead of a web or text search.
  const qrTelUri = useMemo(
    () => (ready ? `tel:${encodeURIComponent(ussdString)}` : ""),
    [ussdString, ready],
  );

  const handleDownload = async () => {
    if (!cardRef.current || !ready) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `${businessName.trim().replace(/\s+/g, "_")}_ishyura.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Zap className="size-5" strokeWidth={2.5} />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-primary">Ishyura</span>
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

        {/* Intro */}
        <div className="mt-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Get paid with a scan
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Create a Mobile Money QR card for your shop in seconds. No account needed.
          </p>
        </div>

        {/* Form */}
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="e.g. Kigali Fresh Market"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="network">Network</Label>
            <Select value={network} onValueChange={(v) => setNetwork(v as Network)}>
              <SelectTrigger id="network">
                <SelectValue placeholder="Choose network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MTN MoMo">MTN MoMo</SelectItem>
                <SelectItem value="Airtel Money">Airtel Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">MoMo Phone Number / Code</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="e.g. 0788 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Live preview + download — hidden until the form is complete */}
        {ready && (
          <div className="mt-8 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your payment card
            </p>

            {/* Printable card — fixed white surface so it prints perfectly */}
            <div
              ref={cardRef}
              className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-print-surface text-print-ink shadow-xl shadow-black/10 animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              <div className="gradient-strip h-2 w-full" />
              <div className="flex flex-col items-center px-6 pb-5 pt-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-print-muted-ink">
                  Scan &amp; Pay
                </p>
                <p className="mt-1.5 max-w-full truncate text-xl font-extrabold tracking-tight">
                  {businessName.trim()}
                </p>

                <div className="mt-4 rounded-xl border border-print-muted p-3">
                  <QRCodeSVG
                    value={qrTelUri}
                    size={168}
                    level="M"
                    fgColor="#0f172a"
                    bgColor="#ffffff"
                  />
                </div>

                <div className="mt-4 w-full rounded-lg bg-print-muted px-3 py-2">
                  <p className="font-mono text-xs font-semibold text-print-muted-ink">
                    {ussdString}
                  </p>
                </div>

                <p className="mt-3 text-[11px] text-print-muted-ink">Point phone camera to pay</p>
              </div>
              <div className="flex items-center justify-between border-t border-print-muted px-5 py-3">
                <span className="text-[11px] font-medium text-print-muted-ink">
                  {network} Merchant
                </span>
                <span className="text-sm font-extrabold text-primary">Ishyura</span>
              </div>
            </div>

            <Button size="lg" className="w-full" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Download className="size-5" />
              )}
              {downloading ? "Preparing your card…" : "Download QR Code (PNG)"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Print it, fold it, place it on the counter. Done.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
