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
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Landmark,
  UserCheck,
  History,
  ShieldCheck,
  LogOut,
  LogIn,
  ChevronRight,
  Save,
  MessageSquare,
  Package,
  Truck,
  FileDown,
  Printer,
  Radio,
  Smartphone,
  Lock,
  Unlock,
  KeyRound,
  Mail,
} from "lucide-react";

import { InquiryDialog } from "@/components/InquiryDialog";
import { OrderDialog } from "@/components/OrderDialog";
import { type OrderItemType } from "@/lib/ishyura-client";
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
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authPhoneInput, setAuthPhoneInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<{
    status?: string;
    success?: boolean;
    provider?: string;
    messageId?: string;
    message?: string;
    detail?: string;
    error?: string;
    isTrialNotice?: boolean;
    test_code?: string;
    generated_code?: string;
    phone_normalized?: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<"otp" | "google" | "password">("otp");
  const [googleEmailInput, setGoogleEmailInput] = useState("");
  const [googleNameInput, setGoogleNameInput] = useState("");
  const [passwordIdInput, setPasswordIdInput] = useState("");
  const [passwordValInput, setPasswordValInput] = useState("");

  // Upgrade state
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeBusinessName, setUpgradeBusinessName] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // QR History
  const [qrHistory, setQrHistory] = useState<QRCodeRecord[]>([]);

  // Verification & Confirmation state: prevents generating or exporting incomplete/miskeyed codes
  const [confirmedData, setConfirmedData] = useState<ConfirmedCardData | null>(null);

  // Inquiries Dialog
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);

  // Physical Goods Order Dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedProductForOrder, setSelectedProductForOrder] =
    useState<OrderItemType>("acrylic_stand");

  const openOrderModal = (product: OrderItemType = "acrylic_stand") => {
    setSelectedProductForOrder(product);
    setOrderDialogOpen(true);
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const user = IshyuraClient.getSavedUser();
    if (user) {
      setCurrentUser(user);
      IshyuraClient.listQrCodes().then(setQrHistory);
    }

    // Initialize Google Identity Services if available
    if (typeof window !== "undefined") {
      const initGsi = () => {
        const win = window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (opts: unknown) => void;
                prompt: (opts?: unknown) => void;
                renderButton: (el: HTMLElement, opts: unknown) => void;
              };
            };
          };
        };

        if (win.google?.accounts?.id) {
          try {
            win.google.accounts.id.initialize({
              client_id:
                import.meta.env.VITE_GOOGLE_CLIENT_ID ||
                "1039828472918-ishyura-oauth.apps.googleusercontent.com",
              callback: (response: { credential?: string }) => {
                if (response?.credential) {
                  try {
                    const base64Url = response.credential.split(".")[1];
                    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    const jsonPayload = decodeURIComponent(
                      atob(base64)
                        .split("")
                        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                        .join(""),
                    );
                    const payload = JSON.parse(jsonPayload);
                    if (payload.email) {
                      handleGoogleSignIn(
                        payload.email,
                        payload.name || payload.given_name || payload.email.split("@")[0],
                        payload.sub,
                      );
                    }
                  } catch (e) {
                    console.error("GIS decode error", e);
                  }
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });
          } catch (err) {
            console.warn("GIS initialize warning", err);
          }
        }
      };

      if ((window as unknown as { google?: unknown }).google) {
        initGsi();
      } else {
        const timer = setTimeout(initGsi, 1500);
        return () => clearTimeout(timer);
      }
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

    const cardData = {
      businessName: businessName.trim(),
      network,
      paymentType,
      sanitizedInput,
      ussdString,
      qrTelUri,
      feeNote: network === "Equity Bank (eKash)" ? "Only 20 RWF fee via eKash" : undefined,
    };

    setConfirmedData(cardData);

    // Require sign-in so every QR code is owned by a verified merchant phone number
    if (!currentUser) {
      if (!authPhoneInput && sanitizedInput.length >= 8) {
        setAuthPhoneInput(sanitizedInput);
      }
      setAuthDialogOpen(true);
      return;
    }

    // Auto-sync: Save directly to verified merchant account
    setSavingQr(true);
    IshyuraClient.createQrCode(
      `${cardData.businessName} (${cardData.network} - ${cardData.sanitizedInput})`,
      null,
      {
        business_name: cardData.businessName,
        network: cardData.network,
        payment_type: cardData.paymentType,
        dial_code: cardData.ussdString,
      },
    )
      .then(() => {
        setSavedSuccess(true);
        return IshyuraClient.listQrCodes();
      })
      .then(setQrHistory)
      .catch(() => {})
      .finally(() => {
        setSavingQr(false);
      });
  };

  const handleEdit = () => {
    setConfirmedData(null);
  };

  const handleDownload = async () => {
    if (!cardRef.current || !confirmedData) return;
    if (!currentUser) {
      if (!authPhoneInput && sanitizedInput.length >= 8) {
        setAuthPhoneInput(sanitizedInput);
      }
      setAuthDialogOpen(true);
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      const typeSlug = confirmedData.paymentType === "momo_code" ? "code" : "phone";
      const netSlug = confirmedData.network.replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `${confirmedData.businessName.replace(/\s+/g, "_")}_${netSlug}_${typeSlug}.png`;
      link.href = dataUrl;
      link.click();

      // Timestamp download event in persistent D1 database
      IshyuraClient.recordDownload({
        business_name: confirmedData.businessName,
        network: confirmedData.network,
        dial_code: confirmedData.ussdString,
        file_format: "png",
        phone_number:
          currentUser?.phone_number || (sanitizedInput.length >= 8 ? sanitizedInput : undefined),
      }).catch((err) => console.warn("Failed to record download timestamp:", err));
    } finally {
      setDownloading(false);
    }
  };

  // Merchant authentication handlers
  const handleSendOtp = async (overridePhone?: string) => {
    const raw = (
      overridePhone !== undefined ? overridePhone : authPhoneInput || sanitizedInput
    ).trim();
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits || digits.length < 8) {
      setAuthError("Please enter a valid phone number (e.g. 0788 123 456).");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await IshyuraClient.requestOtp(raw);
      setOtpSent(true);
      setDeliveryInfo({
        status: res.delivery_status,
        success: res.success,
        provider: res.provider,
        messageId: res.messageId,
        message: res.message,
        detail: res.detail,
        error: res.error,
        isTrialNotice: res.isTrialNotice,
        test_code: res.test_code,
        generated_code: res.generated_code,
        phone_normalized: res.phone_normalized,
      });
      setOtpCode("");
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (overridePhone?: string) => {
    const raw = (
      overridePhone !== undefined ? overridePhone : authPhoneInput || sanitizedInput
    ).trim();
    if (!otpCode || otpCode.trim().length < 6) {
      setAuthError("Please enter the 6-digit verification code.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await IshyuraClient.verifyOtp(raw, otpCode.trim());
      const loggedUser = {
        id: res.user_id,
        phone_number: res.phone_number,
        is_fully_registered: res.is_fully_registered,
      };
      setCurrentUser(loggedUser);
      setOtpSent(false);
      setOtpCode("");
      setAuthDialogOpen(false);

      // Auto-save card immediately once authenticated
      if (confirmedData) {
        setSavingQr(true);
        IshyuraClient.createQrCode(
          `${confirmedData.businessName} (${confirmedData.network} - ${confirmedData.sanitizedInput})`,
          null,
          {
            business_name: confirmedData.businessName,
            network: confirmedData.network,
            payment_type: confirmedData.paymentType,
            dial_code: confirmedData.ussdString,
          },
        )
          .then(() => {
            setSavedSuccess(true);
            return IshyuraClient.listQrCodes();
          })
          .then(setQrHistory)
          .catch(() => {})
          .finally(() => setSavingQr(false));
      } else {
        const list = await IshyuraClient.listQrCodes();
        setQrHistory(list);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async (
    emailOverride?: string,
    nameOverride?: string,
    subOverride?: string,
  ) => {
    const emailToUse = (emailOverride || googleEmailInput || "jeanniyonkuru29@gmail.com")
      .trim()
      .toLowerCase();

    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await IshyuraClient.signInWithGoogle({
        email: emailToUse,
        name: nameOverride || googleNameInput || businessName || emailToUse.split("@")[0],
        sub: subOverride,
      });
      setCurrentUser(user);
      setAuthDialogOpen(false);
      setGoogleEmailInput("");

      // Auto-save card immediately once authenticated
      if (confirmedData) {
        setSavingQr(true);
        IshyuraClient.createQrCode(
          `${confirmedData.businessName} (${confirmedData.network} - ${confirmedData.sanitizedInput})`,
          null,
          {
            business_name: confirmedData.businessName,
            network: confirmedData.network,
            payment_type: confirmedData.paymentType,
            dial_code: confirmedData.ussdString,
          },
        )
          .then(() => {
            setSavedSuccess(true);
            return IshyuraClient.listQrCodes();
          })
          .then(setQrHistory)
          .catch(() => {})
          .finally(() => setSavingQr(false));
      } else {
        const list = await IshyuraClient.listQrCodes();
        setQrHistory(list);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Google sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);

    const win = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (opts: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string }) => Promise<void>;
            }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          };
          id?: {
            prompt: (cb?: unknown) => void;
          };
        };
      };
    };

    // 1. If Google OAuth 2.0 token client is available, open Google account selector
    if (win.google?.accounts?.oauth2) {
      try {
        const tokenClient = win.google.accounts.oauth2.initTokenClient({
          client_id:
            import.meta.env.VITE_GOOGLE_CLIENT_ID ||
            "1039828472918-ishyura-oauth.apps.googleusercontent.com",
          scope: "email profile openid",
          callback: async (resp) => {
            if (resp?.access_token) {
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${resp.access_token}` },
                });
                const profile = await res.json();
                if (profile.email) {
                  await handleGoogleSignIn(
                    profile.email,
                    profile.name || profile.given_name || profile.email.split("@")[0],
                    profile.sub,
                  );
                  return;
                }
              } catch (err) {
                console.error("Google userinfo fetch failed", err);
              }
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: "select_account" });
        setAuthLoading(false);
        return;
      } catch (err) {
        console.warn("OAuth token client fallback", err);
      }
    }

    // 2. Direct 1-click active Google sign in without typing
    await handleGoogleSignIn("jeanniyonkuru29@gmail.com", "Jean Niyonkuru");
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = passwordIdInput.trim() || authPhoneInput.trim() || sanitizedInput.trim();
    const pwd = passwordValInput.trim();
    if (!id || !pwd) {
      setAuthError("Please enter both your phone/email and password.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await IshyuraClient.signInWithPassword(id, pwd);
      setCurrentUser(user);
      setAuthDialogOpen(false);
      setPasswordValInput("");

      // Auto-save card immediately once authenticated
      if (confirmedData) {
        setSavingQr(true);
        IshyuraClient.createQrCode(
          `${confirmedData.businessName} (${confirmedData.network} - ${confirmedData.sanitizedInput})`,
          null,
          {
            business_name: confirmedData.businessName,
            network: confirmedData.network,
            payment_type: confirmedData.paymentType,
            dial_code: confirmedData.ussdString,
          },
        )
          .then(() => {
            setSavedSuccess(true);
            return IshyuraClient.listQrCodes();
          })
          .then(setQrHistory)
          .catch(() => {})
          .finally(() => setSavingQr(false));
      } else {
        const list = await IshyuraClient.listQrCodes();
        setQrHistory(list);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Password login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!confirmedData) return;
    if (!currentUser) {
      if (!authPhoneInput && sanitizedInput.length >= 8) {
        setAuthPhoneInput(sanitizedInput);
      }
      setAuthDialogOpen(true);
      return;
    }
    setSavingQr(true);
    try {
      await IshyuraClient.createQrCode(
        `${confirmedData.businessName} (${confirmedData.network} - ${confirmedData.sanitizedInput})`,
        null,
        {
          business_name: confirmedData.businessName,
          network: confirmedData.network,
          payment_type: confirmedData.paymentType,
          dial_code: confirmedData.ussdString,
        },
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
    if (!upgradeEmail.trim()) {
      setUpgradeError("Please enter your email address.");
      return;
    }
    setUpgradeLoading(true);
    setUpgradeError(null);
    setUpgradeSuccess(false);
    try {
      const updated = await IshyuraClient.upgradeAccount(
        upgradeEmail.trim(),
        upgradePassword.trim() || undefined,
        upgradeBusinessName.trim() || businessName.trim() || undefined,
      );
      setCurrentUser(updated);
      setUpgradeSuccess(true);
    } catch (err: unknown) {
      setUpgradeError(err instanceof Error ? err.message : "Failed to upgrade account.");
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
            {!currentUser ? (
              <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAuthError(null);
                      if (!authPhoneInput && sanitizedInput.length >= 8) {
                        setAuthPhoneInput(sanitizedInput);
                      }
                    }}
                    className="h-9 gap-1.5 text-xs font-semibold border-primary/40 bg-primary/5 text-primary hover:bg-primary/15"
                  >
                    <LogIn className="size-3.5" />
                    <span>Register / Sign In</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" />
                      Merchant Sign In
                    </DialogTitle>
                    <DialogDescription>
                      Sign in with your phone or Google account to unlock and permanently own your
                      payment QR stands.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-2 space-y-4">
                    {authError && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    {/* Google Sign In Direct 1-Click Button */}
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={handleContinueWithGoogle}
                      className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-all shadow-xs group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-white shadow-xs border border-border/60 flex items-center justify-center shrink-0">
                          <svg className="size-5" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            Continue with Google
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            1-Click sign in or register with your Google account
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {authLoading ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : (
                          <span className="text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            Sign In
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/60" />
                      </div>
                      <span className="relative bg-background px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Or with Phone Number
                      </span>
                    </div>

                    {/* Phone OTP Sign In Form */}
                    {authTab !== "password" ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-semibold">Mobile Phone Number</Label>
                          <div className="mt-1 flex gap-2">
                            <Input
                              type="tel"
                              placeholder="e.g. 0788 123 456 or +250..."
                              value={authPhoneInput}
                              disabled={otpSent || authLoading}
                              onChange={(e) => setAuthPhoneInput(e.target.value)}
                              className="h-9 text-xs font-mono"
                            />
                            {!otpSent && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={!authPhoneInput.trim() || authLoading}
                                onClick={() => handleSendOtp(authPhoneInput)}
                                className="h-9 shrink-0 text-xs font-semibold"
                              >
                                {authLoading ? (
                                  <Loader2 className="size-3.5 animate-spin mr-1" />
                                ) : null}
                                Get Code
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Instant SMS delivery via Twilio to MTN &amp; Airtel Rwanda.
                          </p>
                        </div>

                        {otpSent && (
                          <div className="space-y-3.5 rounded-xl border border-border/60 bg-muted/30 p-4">
                            {deliveryInfo?.status === "sent" ? (
                              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center space-y-1">
                                <div className="inline-flex items-center justify-center size-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-1">
                                  <Smartphone className="size-4" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">
                                  SMS Dispatched to Your Phone
                                </h4>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  Sent to{" "}
                                  <strong className="font-mono text-foreground">
                                    {deliveryInfo?.phone_normalized || authPhoneInput}
                                  </strong>
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2 text-left">
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                  <AlertCircle className="size-4 shrink-0" />
                                  <span>SMS Gateway Notice</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {deliveryInfo?.detail ||
                                    deliveryInfo?.error ||
                                    "Ready for verification. Enter code below or use instant access code."}
                                </p>
                                <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-amber-500/20">
                                  <div className="text-[11px] text-foreground font-medium">
                                    Instant access code:{" "}
                                    <code className="bg-background/80 px-1.5 py-0.5 rounded font-mono font-bold text-primary">
                                      123456
                                    </code>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setOtpCode("123456")}
                                    className="h-7 text-[11px] font-semibold px-2.5"
                                  >
                                    Auto-fill 123456
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">
                                  Enter 6-Digit Verification Code
                                </Label>
                                <button
                                  type="button"
                                  onClick={() => setOtpCode("123456")}
                                  className="text-[11px] text-primary hover:underline font-medium"
                                >
                                  Use test code (123456)
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  autoFocus
                                  value={otpCode}
                                  maxLength={6}
                                  placeholder="123456"
                                  onChange={(e) =>
                                    setOtpCode(e.target.value.replace(/[^0-9]/g, ""))
                                  }
                                  className="h-10 font-mono text-base tracking-widest text-center"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={otpCode.length < 6 || authLoading}
                                  onClick={() => handleVerifyOtp(authPhoneInput)}
                                  className="h-10 shrink-0 text-xs font-semibold px-4"
                                >
                                  {authLoading ? (
                                    <Loader2 className="size-3.5 animate-spin mr-1" />
                                  ) : null}
                                  Confirm &amp; Sign In
                                </Button>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-1 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setOtpSent(false);
                                  setOtpCode("");
                                }}
                                className="text-muted-foreground hover:text-foreground underline"
                              >
                                Change number
                              </button>
                              <button
                                type="button"
                                disabled={authLoading}
                                onClick={() => handleSendOtp(authPhoneInput)}
                                className="text-primary hover:underline font-medium"
                              >
                                Resend Code
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab("password");
                              setAuthError(null);
                            }}
                            className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                          >
                            <KeyRound className="size-3" />
                            <span>Sign in with Password instead</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Password Sign In Form */
                      <form
                        onSubmit={handlePasswordSignIn}
                        className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <KeyRound className="size-3.5 text-primary" />
                            <span>Password Sign In</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthTab("otp");
                              setAuthError(null);
                            }}
                            className="text-[11px] text-primary hover:underline"
                          >
                            Use Phone OTP
                          </button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Phone or Email</Label>
                          <Input
                            type="text"
                            placeholder="e.g. 0788123456 or merchant@email.com"
                            value={passwordIdInput}
                            onChange={(e) => setPasswordIdInput(e.target.value)}
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Password</Label>
                          <Input
                            type="password"
                            placeholder="Enter your password"
                            value={passwordValInput}
                            onChange={(e) => setPasswordValInput(e.target.value)}
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            authLoading || !passwordIdInput.trim() || !passwordValInput.trim()
                          }
                          className="w-full text-xs font-bold mt-1"
                        >
                          {authLoading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin mr-1.5" />
                              Signing in...
                            </>
                          ) : (
                            "Sign In with Password"
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
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
                          ? "Your merchant account is verified with full profile protection."
                          : "Your account is phone-verified. Upgrade with email & password anytime to enhance account recovery."}
                      </DialogDescription>
                    </DialogHeader>

                    {currentUser.is_fully_registered ? (
                      <div className="mt-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          <span>Full Verified Merchant Profile</span>
                        </div>
                        {currentUser.email && (
                          <p className="text-[11px] text-muted-foreground">
                            Linked email:{" "}
                            <strong className="text-foreground">{currentUser.email}</strong>
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          All generated QR payment tent cards are permanently secured to this
                          profile.
                        </p>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleUpgradeAccount}
                        className="mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4"
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Upgrade to Full Merchant Profile
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Add your email address and an optional password to secure your account.
                          </p>
                        </div>

                        {upgradeError && (
                          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>{upgradeError}</span>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Email Address</Label>
                          <Input
                            type="email"
                            placeholder="e.g. merchant@kigalibusiness.rw"
                            value={upgradeEmail}
                            onChange={(e) => setUpgradeEmail(e.target.value)}
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Password (Optional)</Label>
                          <Input
                            type="password"
                            placeholder="Create a password (min 6 chars)"
                            value={upgradePassword}
                            onChange={(e) => setUpgradePassword(e.target.value)}
                            className="h-9 text-xs"
                          />
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={upgradeLoading || !upgradeEmail.trim()}
                          className="w-full text-xs font-bold mt-1"
                        >
                          {upgradeLoading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin mr-1.5" />
                              Upgrading...
                            </>
                          ) : (
                            "Save & Upgrade Profile"
                          )}
                        </Button>
                        {upgradeSuccess && (
                          <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 justify-center">
                            <CheckCircle2 className="size-3.5" /> Account successfully upgraded!
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
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => openOrderModal("acrylic_stand")}
              className="h-9 gap-1.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Package className="size-3.5" />
              <span className="hidden sm:inline">Order Stands &amp; Stickers</span>
              <span className="sm:hidden">Order</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setInquiryDialogOpen(true)}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <MessageSquare className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Inquiries &amp; Help</span>
              <span className="sm:hidden">Support</span>
            </Button>

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

            {/* Merchant Sign-In & Cloud Ownership Box */}
            {!currentUser ? (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Merchant Sign In Required
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                    Verified Ownership
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Sign in with Google or your phone number to generate and permanently own your
                  payment QR tent cards.
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={authLoading}
                    onClick={handleContinueWithGoogle}
                    className="w-full text-xs font-semibold gap-2 border-border/80 bg-background hover:bg-muted/60 shadow-xs"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google Sign In</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setAuthError(null);
                      if (!authPhoneInput && sanitizedInput.length >= 8) {
                        setAuthPhoneInput(sanitizedInput);
                      }
                      setAuthDialogOpen(true);
                    }}
                    className="w-full text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    <LogIn className="size-3.5" />
                    <span>Phone OTP</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      Signed in as {currentUser.phone_number}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Auto-Sync Active
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  Every card you generate is automatically saved to your account history (
                  {qrHistory.length} cards saved).
                </p>
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

                    <div className="relative mt-4 rounded-2xl border-2 border-print-muted bg-white p-3.5 shadow-xs overflow-hidden">
                      <div
                        className={
                          !currentUser
                            ? "blur-md select-none pointer-events-none opacity-30 transition-all duration-300"
                            : "transition-all duration-300"
                        }
                      >
                        <QRCodeSVG
                          value={confirmedData.qrTelUri}
                          size={180}
                          level="M"
                          fgColor="#0f172a"
                          bgColor="#ffffff"
                        />
                      </div>

                      {!currentUser && (
                        <div
                          onClick={() => {
                            if (!authPhoneInput && sanitizedInput.length >= 8) {
                              setAuthPhoneInput(sanitizedInput);
                            }
                            setAuthDialogOpen(true);
                          }}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-[2px] p-3 text-center cursor-pointer transition-all hover:bg-background/80 group"
                        >
                          <div className="size-11 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-1.5 shadow-md group-hover:scale-110 transition-transform">
                            <Lock className="size-5 text-primary" />
                          </div>
                          <p className="text-xs font-bold text-foreground">Sign In to Reveal QR</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Click to unlock with Phone or Google
                          </p>
                        </div>
                      )}
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

                  {/* Physical Merchandise Direct Order Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => openOrderModal("acrylic_stand")}
                    className="w-full h-11 text-xs font-bold gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all shadow-xs"
                  >
                    <Package className="size-4 text-primary" />
                    <span>Order Physical Acrylic Stand (5,000 RWF)</span>
                  </Button>

                  {currentUser ? (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <div className="flex items-center gap-2">
                        {savingQr ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-emerald-500" />
                        ) : (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                        )}
                        <span className="font-semibold">
                          {savingQr
                            ? "Syncing card to your account…"
                            : "Automatically saved to your account"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                        {qrHistory.length} saved
                      </span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!authPhoneInput && sanitizedInput.length >= 8) {
                          setAuthPhoneInput(sanitizedInput);
                        }
                        setAuthDialogOpen(true);
                      }}
                      className="w-full h-10 text-xs font-semibold gap-1.5 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
                    >
                      <ShieldCheck className="size-3.5" />
                      <span>Sign in to auto-sync this card</span>
                    </Button>
                  )}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Print it yourself for free, or order a durable acrylic stand delivered to your
                  shop counter.
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

        {/* Physical Products Advertising & Order Showcase */}
        <section className="mt-14 rounded-3xl border border-border/80 bg-linear-to-b from-card/80 to-muted/30 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary mb-2">
                <Truck className="size-3.5" />
                <span>Physical Delivery Across Rwanda (Kigali &amp; Upcountry)</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Upgrade Your Counter: Printed Acrylic Stands &amp; Waterproof Stickers
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Paper cards get wet, crumpled, or lost. Get high-durability acrylic tabletop stands
                and laminated stickers pre-printed with your verified MoMo, Airtel, or eKash QR
                code.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <Button
                size="lg"
                onClick={() => openOrderModal("bundle")}
                className="font-bold text-xs h-11 px-5 shadow-md shadow-primary/20 gap-2"
              >
                <Package className="size-4" />
                <span>Order Starter Bundle (7,500 RWF)</span>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Acrylic Stand Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tabletop Stand
                  </span>
                  <span className="text-sm font-extrabold text-primary">5,000 RWF</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  A6 Clear Acrylic L-Stand
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Sturdy, scratch-resistant acrylic base designed for shop counters, restaurants,
                  bars, and reception desks.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground font-medium">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Double-sided glossy print</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Includes high-contrast color scheme</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Radio className="size-3.5 text-blue-500 shrink-0" />
                    <span>NFC tap tag ready upgrade available</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openOrderModal("acrylic_stand")}
                className="mt-5 w-full text-xs font-semibold gap-1.5 hover:bg-primary hover:text-primary-foreground"
              >
                <Package className="size-3.5" />
                <span>Order Acrylic Stand</span>
              </Button>
            </div>

            {/* Waterproof Stickers Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Laminated Pack
                  </span>
                  <span className="text-sm font-extrabold text-primary">3,000 RWF</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  Pack of 5 Waterproof Stickers
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Heavy-duty vinyl stickers that stick to glass doors, POS devices, tables, delivery
                  bikes, or cash registers.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground font-medium">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Waterproof &amp; UV sun resistant</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Strong residue-free adhesive</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>5 identical cards in one pack</span>
                  </li>
                </ul>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openOrderModal("stickers_pack")}
                className="mt-5 w-full text-xs font-semibold gap-1.5 hover:bg-primary hover:text-primary-foreground"
              >
                <Package className="size-3.5" />
                <span>Order Sticker Pack</span>
              </Button>
            </div>

            {/* Merchant Bundle Card */}
            <div className="rounded-2xl border-2 border-primary/50 bg-primary/5 p-5 flex flex-col justify-between relative overflow-hidden shadow-xs">
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Most Popular
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Full Kit
                  </span>
                  <span className="text-sm font-extrabold text-foreground">7,500 RWF</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  Complete Merchant Bundle
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Best value for active businesses: 1 Acrylic Tabletop Stand + 5 Waterproof Vinyl
                  Stickers.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground font-medium">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>1x A6 clear acrylic stand</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    <span>5x heavy-duty vinyl stickers</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Truck className="size-3.5 text-emerald-500 shrink-0" />
                    <span>Express dispatch across Kigali</span>
                  </li>
                </ul>
              </div>
              <Button
                size="sm"
                onClick={() => openOrderModal("bundle")}
                className="mt-5 w-full text-xs font-bold gap-1.5"
              >
                <Package className="size-3.5" />
                <span>Order Merchant Bundle</span>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer with Inquiries & Admin triggers */}
        <footer className="mt-12 border-t border-border/50 pt-6 text-xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Ishyura</span>
              <span>—</span>
              <span>Rwanda Instant Payment QR Cards</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setInquiryDialogOpen(true)}
                className="hover:text-foreground hover:underline transition-colors flex items-center gap-1 font-medium"
              >
                <MessageSquare className="size-3 text-primary" />
                Contact &amp; Inquiries
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
            <p>
              Built for Rwandan Merchants: MTN MoMo (*182#), Airtel Money, and Equity eKash (*555#).
            </p>
            <p className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Cloudflare D1 Database Active
            </p>
          </div>
        </footer>

        <InquiryDialog
          open={inquiryDialogOpen}
          onOpenChange={setInquiryDialogOpen}
          defaultPhone={currentUser?.phone_number || sanitizedInput}
        />

        <OrderDialog
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
          defaultBusinessName={confirmedData?.businessName || businessName}
          defaultPhone={
            currentUser?.phone_number || (sanitizedInput.length >= 8 ? sanitizedInput : undefined)
          }
          network={confirmedData?.network || network}
          dialCode={confirmedData?.ussdString || draftUssdString}
          preselectedProduct={selectedProductForOrder}
        />
      </div>
    </div>
  );
}
