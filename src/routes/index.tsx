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
  Landmark,
  UserCheck,
  History,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Save,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IshyuraClient, UserProfile, QRCodeRecord } from "@/lib/ishyura-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Ishyura — Instant Payment QR Codes (MoMo & Equity eKash)",
      },
      {
        name: "description",
        content:
          "Create printable payment QR tent cards for your shop in seconds. Zero login, works with MTN MoMo, Airtel Money, and Equity Bank eKash (*555*2*tel#) for Merchant Codes and Phone Numbers.",
      },
      { property: "og:title", content: "Ishyura — Instant Payment QR Codes" },
      {
        property: "og:description",
        content:
          "Create printable Mobile Money and Equity eKash payment QR tent cards for your counter. Zero login.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

export type Network = "MTN MoMo" | "Airtel Money" | "Equity Bank (eKash)";
export type PaymentType = "momo_code" | "phone";

export interface ProviderConfig {
  name: Network;
  brandColor: string;
  badgeLabel?: string;
  supportsMomoCode: boolean;
  note?: string;
  momoCodeLabel: string;
  momoCodePlaceholder: string;
  phonePlaceholder: string;
  prefixes: {
    momo_code: string;
    phone: string;
  };
}

export const PROVIDERS: Record<Network, ProviderConfig> = {
  "MTN MoMo": {
    name: "MTN MoMo",
    brandColor: "#ffcc00",
    supportsMomoCode: true,
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
    supportsMomoCode: true,
    momoCodeLabel: "Airtel Merchant / Till Code",
    momoCodePlaceholder: "e.g. 567890",
    phonePlaceholder: "e.g. 0733 123 456 or 0722 123 456",
    prefixes: {
      momo_code: "*182*8*1*",
      phone: "*182*1*1*",
    },
  },
  "Equity Bank (eKash)": {
    name: "Equity Bank (eKash)",
    brandColor: "#8B1E0F",
    badgeLabel: "eKash • Only 20 RWF",
    supportsMomoCode: false,
    note: "Pay via Equity eKash straight to any phone number (*555*2*tel#) for just 20 RWF fee.",
    momoCodeLabel: "Merchant Code",
    momoCodePlaceholder: "e.g. 123456",
    phonePlaceholder: "e.g. 0788 123 456 or 0733 123 456",
    prefixes: {
      momo_code: "*555*2*",
      phone: "*555*2*",
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
  feeNote?: string;
}

function Index() {
  const [businessName, setBusinessName] = useState("");
  const [network, setNetwork] = useState<Network>("MTN MoMo");
  const [paymentType, setPaymentType] = useState<PaymentType>("momo_code");
  const [accountValue, setAccountValue] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User state & Soft Registration flow
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{
    status?: string;
    provider?: string;
    message?: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Upgrade state
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  // QR History
  const [qrHistory, setQrHistory] = useState<QRCodeRecord[]>([]);

  // Verification & Confirmation state: prevents generating or exporting incomplete/miskeyed codes
  const [confirmedData, setConfirmedData] = useState<ConfirmedCardData | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const user = IshyuraClient.getSavedUser();
    if (user) {
      setCurrentUser(user);
      IshyuraClient.listQrCodes().then(setQrHistory);
    }
  }, []);

  const currentProvider = PROVIDERS[network];

  // Clean formatted input (stripping non-digits and spacing)
  const sanitizedInput = useMemo(() => accountValue.replace(/[^0-9]/g, "").trim(), [accountValue]);

  // Validation rules tailored to Rwanda mobile money and bank eKash
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

  const handleNetworkChange = (v: Network) => {
    setNetwork(v);
    if (confirmedData) setConfirmedData(null);
    if (v === "Equity Bank (eKash)" && paymentType === "momo_code") {
      setPaymentType("phone");
    }
  };

  // When user clicks Confirm & Generate
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
      feeNote: network === "Equity Bank (eKash)" ? "Only 20 RWF fee via eKash" : undefined,
    });
    setSavedSuccess(false);
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
      const netSlug = confirmedData.network.replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `${confirmedData.businessName.replace(/\s+/g, "_")}_${netSlug}_${typeSlug}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  // Soft registration authentication handlers
  const handleSendOtp = async () => {
    if (!sanitizedInput) {
      setAuthError("Please enter your phone number first.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await IshyuraClient.requestOtp(sanitizedInput);
      setOtpSent(true);
      setDeliveryInfo({
        status: res.delivery_status,
        provider: res.provider,
        message: res.message,
      });
      if (res.otp_preview) {
        setOtpPreview(res.otp_preview);
      } else {
        setOtpPreview(null);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      setAuthError("Please enter the 6-digit OTP code.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await IshyuraClient.verifyOtp(sanitizedInput, otpCode);
      setCurrentUser({
        id: res.user_id,
        phone_number: res.phone_number,
        is_fully_registered: res.is_fully_registered,
      });
      setOtpSent(false);
      const list = await IshyuraClient.listQrCodes();
      setQrHistory(list);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!confirmedData) return;
    setSavingQr(true);
    try {
      await IshyuraClient.createQrCode(
        `${confirmedData.businessName} (${confirmedData.network} - ${confirmedData.sanitizedInput})`,
      );
      setSavedSuccess(true);
      const updated = await IshyuraClient.listQrCodes();
      setQrHistory(updated);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to save QR.");
    } finally {
      setSavingQr(false);
    }
  };

  const handleUpgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upgradeEmail || !upgradePassword) return;
    setUpgradeLoading(true);
    try {
      const updated = await IshyuraClient.upgradeAccount(upgradeEmail, upgradePassword);
      setCurrentUser(updated);
      setUpgradeSuccess(true);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to upgrade account.");
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleLogout = () => {
    IshyuraClient.logout();
    setCurrentUser(null);
    setQrHistory([]);
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
                Instant Payment QR Cards
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-xs font-semibold"
                    >
                      <UserCheck className="size-4 text-emerald-500" />
                      <span className="max-w-[110px] truncate">{currentUser.phone_number}</span>
                      {currentUser.is_fully_registered ? (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Full
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Soft
                        </span>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="size-5 text-primary" />
                        Ishyura Account &amp; History
                      </DialogTitle>
                      <DialogDescription>
                        {currentUser.is_fully_registered
                          ? "Your account is fully registered and protected."
                          : "You are in Soft Registration. Upgrade to add email & password anytime without losing your QR codes."}
                      </DialogDescription>
                    </DialogHeader>

                    {!currentUser.is_fully_registered && (
                      <form
                        onSubmit={handleUpgradeAccount}
                        className="mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4"
                      >
                        <p className="text-xs font-bold text-foreground">Upgrade to Full Account</p>
                        <Input
                          type="email"
                          placeholder="Your email address"
                          value={upgradeEmail}
                          onChange={(e) => setUpgradeEmail(e.target.value)}
                          required
                          className="h-9 text-xs"
                        />
                        <Input
                          type="password"
                          placeholder="Create a password (min 6 chars)"
                          value={upgradePassword}
                          onChange={(e) => setUpgradePassword(e.target.value)}
                          required
                          className="h-9 text-xs"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={upgradeLoading}
                          className="w-full text-xs font-bold"
                        >
                          {upgradeLoading ? "Upgrading..." : "Save & Upgrade Account"}
                        </Button>
                        {upgradeSuccess && (
                          <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Account successfully upgraded!
                          </p>
                        )}
                      </form>
                    )}

                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <History className="size-3.5" /> Saved QR Cards ({qrHistory.length})
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {qrHistory.length > 0 ? (
                          qrHistory.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-border/40 bg-card p-2 text-xs flex justify-between items-center"
                            >
                              <div>
                                <p className="font-semibold">{item.description}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            No QR codes saved yet.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        <LogOut className="size-3.5 mr-1" /> Logout
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}

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
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="mt-8 grid flex-1 grid-cols-1 items-start gap-8 lg:mt-12 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Form & Confirmation step */}
          <section className="lg:col-span-6 xl:col-span-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Get paid with a scan
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Create a printable payment QR tent card for your counter. Supports MTN MoMo, Airtel
                Money, and Equity Bank eKash with optional account history.
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
                  Payment Network / Bank
                </Label>
                <Select value={network} onValueChange={(v) => handleNetworkChange(v as Network)}>
                  <SelectTrigger id="network" className="h-11">
                    <SelectValue placeholder="Choose provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN MoMo">MTN MoMo</SelectItem>
                    <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                    <SelectItem value="Equity Bank (eKash)">
                      Equity Bank (eKash • 20 RWF)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {network === "Equity Bank (eKash)" && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✨ Equity eKash lets clients pay directly to your phone number for just 20 RWF!
                  </p>
                )}
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
                      disabled={!currentProvider.supportsMomoCode}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold sm:text-sm disabled:opacity-40"
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
                  {network === "Equity Bank (eKash)"
                    ? "Equity eKash dials *555*2*tel# to send money straight to your phone number."
                    : paymentType === "momo_code"
                      ? "For registered merchant/till codes (dials *182*8*1*code#)."
                      : "For direct phone number transfers (dials *182*1*1*number#)."}
                </p>
              </div>

              {/* Number or Code input */}
              <div className="space-y-2">
                <Label htmlFor="account-value" className="text-sm font-semibold">
                  {paymentType === "momo_code"
                    ? currentProvider.momoCodeLabel
                    : network === "Equity Bank (eKash)"
                      ? "Recipient Phone Number (tel)"
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

            {/* Soft Registration Box (Optional cloud history sync) */}
            {!currentUser && (
              <div className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Soft Registration &amp; History
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Start with just your phone number. Save your QR codes and upgrade to a full
                  account whenever you are ready without losing history.
                </p>

                {!otpSent ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!sanitizedInput || authLoading}
                    onClick={handleSendOtp}
                    className="mt-3 w-full text-xs font-semibold"
                  >
                    {authLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                    Send Real OTP to {sanitizedInput ? sanitizedInput : "your phone"}
                  </Button>
                ) : (
                  <div className="mt-3 space-y-2">
                    {deliveryInfo?.status === "sent" ? (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                        <p className="font-semibold flex items-center gap-1.5">
                          <span>📲</span> SMS Dispatched via Twilio
                        </p>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          Check your phone inbox for your 6-digit verification code.
                        </p>
                      </div>
                    ) : otpPreview ? (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                        <div className="flex items-center justify-between">
                          <span>Verification OTP:</span>
                          <strong className="font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/20">
                            {otpPreview}
                          </strong>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Configure live Twilio credentials in{" "}
                          <code className="font-mono">.env</code> to deliver over real mobile
                          networks.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2 text-[11px] text-blue-700 dark:text-blue-300">
                        Code sent to your mobile device via Twilio SMS.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="6-digit OTP"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={6}
                        className="h-9 font-mono text-center text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={authLoading}
                        onClick={handleVerifyOtp}
                        className="h-9 px-4 text-xs font-bold"
                      >
                        {authLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </div>
                )}
                {authError && <p className="mt-2 text-[11px] text-red-500">{authError}</p>}
              </div>
            )}

            {/* Practical instructions / feature badges */}
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-card/30 p-3">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Landmark className="size-3.5 text-emerald-500" />
                  Equity eKash (20 RWF)
                </p>
                <p className="mt-0.5">
                  Instant dialing via *555*2*tel# with an affordable 20 RWF transaction cost.
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
              <div className="w-full max-w-sm space-y-4 lg:sticky lg:top-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Generated Card
                  </p>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Verified &amp; Ready
                  </span>
                </div>

                {/* Printable card */}
                <div
                  ref={cardRef}
                  className="w-full overflow-hidden rounded-2xl bg-print-surface text-print-ink shadow-2xl shadow-black/15 transition-all duration-300"
                >
                  <div className="gradient-strip h-2.5 w-full" />
                  <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-print-muted-ink">
                        {confirmedData.network === "Equity Bank (eKash)"
                          ? "Equity eKash Pay"
                          : confirmedData.paymentType === "momo_code"
                            ? "Merchant Pay"
                            : "Send Money"}
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
                      {confirmedData.feeNote && (
                        <p className="mt-1 text-[11px] font-bold text-emerald-700">
                          {confirmedData.feeNote}
                        </p>
                      )}
                    </div>

                    <p className="mt-3 text-[11px] font-medium text-print-muted-ink">
                      Scan with camera &amp; tap Call to pay
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-print-muted bg-print-muted/40 px-5 py-3">
                    <span className="text-[11px] font-semibold text-print-muted-ink">
                      {confirmedData.network === "Equity Bank (eKash)"
                        ? "eKash • 20 RWF"
                        : confirmedData.paymentType === "momo_code"
                          ? "Registered Merchant"
                          : "Direct Number"}
                    </span>
                    <span className="text-sm font-extrabold text-primary">Ishyura</span>
                  </div>
                </div>

                <div className="space-y-2">
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

                  {currentUser && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveToHistory}
                      disabled={savingQr || savedSuccess}
                      className="w-full h-10 text-xs font-semibold"
                    >
                      {savingQr ? (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      ) : savedSuccess ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 mr-1.5" />
                      ) : (
                        <Save className="size-3.5 mr-1.5" />
                      )}
                      {savedSuccess ? "Saved to Account History" : "Save Card to My Account"}
                    </Button>
                  )}
                </div>

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
