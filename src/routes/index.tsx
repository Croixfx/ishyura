import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { QRCodeSVG } from "qrcode.react";
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
  User,
  Edit3,
  ExternalLink,
  Trash2,
} from "lucide-react";

import { InquiryDialog } from "@/components/InquiryDialog";
import { OrderDialog } from "@/components/OrderDialog";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import { type OrderItemType } from "@/lib/ishyura-client";
import { signInWithGoogleReal, logoutGoogle } from "@/lib/firebase-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  IshyuraClient,
  UserProfile,
  QRCodeRecord,
  isAdminUser,
  getDynamicPayUrl,
} from "@/lib/ishyura-client";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { extractMerchantOrAccountCode, buildRwandaUssdString } from "@/lib/momo-formatters";

interface IndexSearch {
  tab?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    return {
      tab: (search.tab as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      {
        title: "Ishyura — Instant Payment QR Codes (MoMo & Equity eKash)",
      },
      {
        name: "description",
        content:
          "Create printable payment QR tent cards for your shop in seconds. Works with MTN MoMo, Airtel Money, and Equity Bank eKash (*555*2*tel#) for Merchant Codes and Phone Numbers.",
      },
      { property: "og:title", content: "Ishyura — Instant Payment QR Codes" },
      {
        property: "og:description",
        content:
          "Create printable Mobile Money and Equity eKash payment QR tent cards for your counter.",
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
  id?: string;
  businessName: string;
  network: Network;
  paymentType: PaymentType;
  sanitizedInput: string;
  ussdString: string;
  qrTelUri: string;
  feeNote?: string;
  isDynamic?: boolean;
  amount?: number | null;
  itemName?: string | null;
  dynamicUrl?: string;
}

function Index() {
  const searchParams = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(searchParams.tab || "generator");
  const [adminStats, setAdminStats] = useState<{ newInquiries: number; pendingOrders: number }>({
    newInquiries: 0,
    pendingOrders: 0,
  });

  const [businessName, setBusinessName] = useState("");
  const [network, setNetwork] = useState<Network>("MTN MoMo");
  const [paymentType, setPaymentType] = useState<PaymentType>("momo_code");
  const [accountValue, setAccountValue] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // PRO Features: Dynamic Smart QR & Fixed Amount (Free Testing Preview)
  const [isDynamic, setIsDynamic] = useState(false);
  const [hasFixedAmount, setHasFixedAmount] = useState(false);
  const [fixedAmount, setFixedAmount] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");

  // Edit Destination Dialog (for updating dynamic QRs without reprinting)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<QRCodeRecord | null>(null);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editAccountValue, setEditAccountValue] = useState("");
  const [editNetwork, setEditNetwork] = useState<Network>("MTN MoMo");
  const [editPaymentType, setEditPaymentType] = useState<PaymentType>("momo_code");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editItemName, setEditItemName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
  const [quickBillToast, setQuickBillToast] = useState<{ id: string; message: string } | null>(
    null,
  );

  // Instant Customer Scan Preview Dialog
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);

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
  const [authTab, setAuthTab] = useState<"otp" | "password">("otp");
  const [passwordIdInput, setPasswordIdInput] = useState("");
  const [passwordValInput, setPasswordValInput] = useState("");

  // Upgrade state
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [upgradeBusinessName, setUpgradeBusinessName] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // QR History - initialized to empty array for SSR hydration safety, populated after mount
  const [qrHistory, setQrHistory] = useState<QRCodeRecord[]>([]);

  // Load from local storage after client mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem("ishyura_cached_qr_cards_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQrHistory(parsed);
        }
      }
    } catch {
      // Fallback to empty list if local cache is unavailable or corrupted
    }
  }, []);

  // Keep local cache in sync for offline resilience
  useEffect(() => {
    if (typeof window !== "undefined" && qrHistory.length > 0) {
      try {
        localStorage.setItem("ishyura_cached_qr_cards_v2", JSON.stringify(qrHistory));
      } catch {
        // Ignore quota/private browsing write errors
      }
    }
  }, [qrHistory]);

  // Sync offline-generated cards when network reconnects
  useEffect(() => {
    const handleOnlineSync = async () => {
      try {
        const pendingRaw = localStorage.getItem("ishyura_pending_offline_sync");
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          if (Array.isArray(pending) && pending.length > 0) {
            for (const item of pending) {
              await IshyuraClient.createQrCode(item.name, item.amount, item.meta).catch(() => {});
            }
            localStorage.removeItem("ishyura_pending_offline_sync");
            const refreshed = await IshyuraClient.listQrCodes().catch(() => null);
            if (refreshed) setQrHistory(refreshed);
          }
        }
      } catch {
        // Ignore offline sync errors
      }
    };

    window.addEventListener("online", handleOnlineSync);
    return () => window.removeEventListener("online", handleOnlineSync);
  }, []);

  // Verification & Confirmation state: prevents generating or exporting incomplete/miskeyed codes
  const [confirmedData, setConfirmedData] = useState<ConfirmedCardData | null>(null);

  // Single Generation Policy & Duplicate Prevention State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    businessName: string;
    network: string;
    dialCode: string;
    message: string;
    ownerPhone?: string;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Owner Reprint & Lost QR recovery state
  const [ownerReprintNotice, setOwnerReprintNotice] = useState<{
    businessName: string;
    dialCode: string;
    message: string;
  } | null>(null);

  // Customer Print & Download Modal State (for reprint if lost)
  const [selectedQrForCustomerPrint, setSelectedQrForCustomerPrint] = useState<QRCodeRecord | null>(
    null,
  );
  const customerPrintCardRef = useRef<HTMLDivElement>(null);
  const [downloadingCustomerCard, setDownloadingCustomerCard] = useState(false);

  // Customer Delete QR State (releases lock so one can create/print a new one)
  const [deleteConfirmCustomerQr, setDeleteConfirmCustomerQr] = useState<QRCodeRecord | null>(null);
  const [deletingCustomerQr, setDeletingCustomerQr] = useState(false);
  const [customerToastMsg, setCustomerToastMsg] = useState<string | null>(null);

  // Inquiries Dialog
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);

  // Physical Goods Order Dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedProductForOrder, setSelectedProductForOrder] =
    useState<OrderItemType>("acrylic_stand");
  const [upsellDialogOpen, setUpsellDialogOpen] = useState(false);

  const isAdmin = isAdminUser(currentUser);

  const openOrderModal = (product: OrderItemType = "acrylic_stand") => {
    setSelectedProductForOrder(product);
    setOrderDialogOpen(true);
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.tab]);

  useEffect(() => {
    const user = IshyuraClient.getSavedUser();
    if (user) {
      setCurrentUser(user);
      if (isAdminUser(user)) {
        if (!searchParams.tab || searchParams.tab === "generator") {
          setActiveTab("inquiries");
        }
        const key = user.access_token || user.email || "ishyura2026";
        IshyuraClient.getAdminStats(key)
          .then((s) => {
            if (s) {
              setAdminStats({
                newInquiries: s.new_inquiries || 0,
                pendingOrders: s.pending_orders || 0,
              });
            }
          })
          .catch(() => {});
      } else {
        IshyuraClient.listQrCodes()
          .then(setQrHistory)
          .catch(() => {});
      }
    }
  }, [searchParams.tab]);

  useEffect(() => {
    // Initialize Google Identity Services if a valid client ID is configured
    if (typeof window !== "undefined") {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (clientId && !clientId.includes("ishyura-oauth") && !clientId.includes("placeholder")) {
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
                client_id: clientId,
                callback: (response: { credential?: string }) => {
                  if (response?.credential) {
                    try {
                      const base64Url = response.credential.split(".")[1];
                      if (!base64Url) return;
                      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                      const jsonPayload = decodeURIComponent(
                        atob(base64)
                          .split("")
                          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                          .join(""),
                      );
                      const payload = JSON.parse(jsonPayload);
                      if (payload.email) {
                        const email = payload.email as string;
                        const name = (payload.name ||
                          payload.given_name ||
                          email.split("@")[0]) as string;
                        const sub = (payload.sub || "") as string;
                        IshyuraClient.signInWithGoogle({ email, name, sub })
                          .then((u) => {
                            setCurrentUser(u);
                            if (isAdminUser(u)) {
                              setActiveTab("inquiries");
                            }
                          })
                          .catch((err) => console.error("GIS sign in error", err));
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

        let timer: ReturnType<typeof setTimeout> | undefined;
        if ((window as unknown as { google?: unknown }).google) {
          initGsi();
        } else {
          timer = setTimeout(initGsi, 1500);
        }
        return () => {
          if (timer) clearTimeout(timer);
        };
      }
    }
    return undefined;
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
    setDuplicateWarning(null);
    if (confirmedData) setConfirmedData(null);
    if (v === "Equity Bank (eKash)" && paymentType === "momo_code") {
      setPaymentType("phone");
    }
  };

  // When user clicks Confirm & Generate
  const handleConfirmAndGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canConfirm || checkingDuplicate) return;

    setDuplicateWarning(null);
    const tempId = crypto.randomUUID();
    const ussdPrefix = currentProvider.prefixes[paymentType];
    const numAmount = hasFixedAmount && fixedAmount.trim() ? parseFloat(fixedAmount) : null;
    const cleanItem = hasFixedAmount && itemName.trim() ? itemName.trim() : null;

    let ussdString = `${ussdPrefix}${sanitizedInput}#`;
    if (numAmount) {
      if (network === "Equity Bank (eKash)") {
        ussdString = `*555*2*${sanitizedInput}*${Math.round(numAmount)}#`;
      } else {
        ussdString = `${ussdPrefix}${sanitizedInput}*${Math.round(numAmount)}#`;
      }
    }

    let qrTelUri = `tel:${encodeURIComponent(ussdString)}`;
    let dynamicUrl: string | undefined = undefined;

    if (isDynamic) {
      dynamicUrl = getDynamicPayUrl(tempId);
      qrTelUri = dynamicUrl;
    }

    const cardData: ConfirmedCardData = {
      id: tempId,
      businessName: businessName.trim(),
      network,
      paymentType,
      sanitizedInput,
      ussdString,
      qrTelUri,
      feeNote: network === "Equity Bank (eKash)" ? "Only 20 RWF fee via eKash" : undefined,
      isDynamic,
      amount: numAmount,
      itemName: cleanItem,
      dynamicUrl,
    };

    // 1. Unauthenticated visitors must sign in first.
    // Single generation policy/check must NOT render or run before one logs in!
    if (!currentUser) {
      setConfirmedData(null);
      setDuplicateWarning(null);
      if (!authPhoneInput && sanitizedInput.length >= 8) {
        setAuthPhoneInput(sanitizedInput);
      }
      setAuthDialogOpen(true);
      return;
    }

    // 2. For logged-in users: check if QR for this string was already printed
    setCheckingDuplicate(true);
    try {
      const checkRes = await IshyuraClient.checkQrExists(ussdString, network);
      if (checkRes.exists && checkRes.existing && !isAdmin) {
        setCheckingDuplicate(false);
        const existing = checkRes.existing;
        const cleanUserPhone = (currentUser?.phone_number || "").replace(/[^0-9]/g, "");
        const cleanOwnerPhone = (existing.phone_number || "").replace(/[^0-9]/g, "");
        const isOwner = Boolean(
          currentUser &&
          ((existing.owner_id &&
            (existing.owner_id === currentUser.id ||
              existing.owner_id === currentUser.phone_number ||
              (cleanUserPhone && existing.owner_id === cleanUserPhone) ||
              (currentUser.email && existing.owner_id === currentUser.email))) ||
            (cleanOwnerPhone && cleanUserPhone && cleanOwnerPhone === cleanUserPhone) ||
            (existing.phone_number &&
              (existing.phone_number === currentUser.phone_number ||
                existing.phone_number === currentUser.id))),
        );

        if (isOwner) {
          const cleanDigits = extractMerchantOrAccountCode(existing.dial_code, sanitizedInput);
          const isDyn = Boolean(isDynamic || existing.is_dynamic);
          const dynUrl = isDyn ? getDynamicPayUrl(existing.id) : undefined;

          // If updating a Dynamic Stand, update it in-place without creating a duplicate record or new print!
          if (isDyn) {
            try {
              const updated = await IshyuraClient.updateQrCode(existing.id, {
                business_name: businessName.trim() || existing.business_name,
                network,
                payment_type: paymentType,
                dial_code: ussdString,
                amount: numAmount,
                item_name: cleanItem,
                is_dynamic: true,
              });
              const reloadedCard: ConfirmedCardData = {
                id: updated.id,
                businessName: updated.business_name || businessName.trim(),
                network: (updated.network as Network) || network,
                paymentType: (updated.payment_type as PaymentType) || paymentType,
                sanitizedInput: cleanDigits,
                ussdString: updated.dial_code || ussdString,
                qrTelUri: getDynamicPayUrl(updated.id),
                feeNote:
                  (updated.network || network) === "Equity Bank (eKash)"
                    ? "Only 20 RWF fee via eKash"
                    : undefined,
                isDynamic: true,
                amount: updated.amount ?? null,
                itemName: updated.item_name ?? null,
                dynamicUrl: getDynamicPayUrl(updated.id),
              };
              setConfirmedData(reloadedCard);
              setOwnerReprintNotice({
                businessName: reloadedCard.businessName,
                dialCode: reloadedCard.ussdString,
                message: `⚡ Smart Stand updated! Your existing physical stand and NFC tag will show this new bill immediately without reprinting.`,
              });
              setDuplicateWarning(null);
              IshyuraClient.listQrCodes()
                .then(setQrHistory)
                .catch(() => {});
              return;
            } catch (err) {
              console.warn("Client in-place update notice:", err);
            }
          }

          // Legitimate owner re-printing or reloading their lost QR card
          const reloadedCard: ConfirmedCardData = {
            id: existing.id,
            businessName: existing.business_name || businessName.trim(),
            network: (existing.network as Network) || network,
            paymentType: (existing.payment_type as PaymentType) || paymentType,
            sanitizedInput: cleanDigits,
            ussdString: existing.dial_code || ussdString,
            qrTelUri:
              isDyn && dynUrl
                ? dynUrl
                : `tel:${encodeURIComponent(existing.dial_code || ussdString)}`,
            feeNote:
              (existing.network || network) === "Equity Bank (eKash)"
                ? "Only 20 RWF fee via eKash"
                : undefined,
            isDynamic: isDyn,
            amount: existing.amount ?? null,
            itemName: existing.item_name ?? null,
            dynamicUrl: dynUrl,
          };
          setConfirmedData(reloadedCard);
          setOwnerReprintNotice({
            businessName: reloadedCard.businessName,
            dialCode: reloadedCard.ussdString,
            message: `Retrieved your registered payment card for "${reloadedCard.businessName}". You can reprint, download, or edit your card now!`,
          });
          setDuplicateWarning(null);
          return;
        }

        setDuplicateWarning({
          businessName: existing.business_name || businessName.trim(),
          network: existing.network || network,
          dialCode: existing.dial_code || ussdString,
          ownerPhone: existing.phone_number || undefined,
          message: `A payment QR card for this code was registered to ${existing.business_name || businessName.trim()} (${existing.network || network} - ${existing.dial_code || ussdString}). If this is your business, sign in with your phone or email to reprint your card.`,
        });
        return;
      }
    } catch {
      // ignore check error and proceed
    } finally {
      setCheckingDuplicate(false);
    }

    setConfirmedData(cardData);

    // Auto-sync: Save directly to verified merchant account
    setSavingQr(true);
    IshyuraClient.createQrCode(
      `${cardData.businessName} (${cardData.network} - ${cardData.sanitizedInput})`,
      numAmount,
      {
        business_name: cardData.businessName,
        network: cardData.network,
        payment_type: cardData.paymentType,
        dial_code: cardData.ussdString,
        is_dynamic: isDynamic,
        item_name: cleanItem || undefined,
        update_if_exists: true,
      },
    )
      .then((saved) => {
        setSavedSuccess(true);
        if (isDynamic && saved.id) {
          setConfirmedData((prev) =>
            prev
              ? {
                  ...prev,
                  id: saved.id,
                  dynamicUrl: getDynamicPayUrl(saved.id),
                  qrTelUri: getDynamicPayUrl(saved.id),
                }
              : null,
          );
        }
        return IshyuraClient.listQrCodes();
      })
      .then(setQrHistory)
      .catch((err: unknown) => {
        const errorObj =
          err && typeof err === "object"
            ? (err as { duplicate?: boolean; existing_qr?: QRCodeRecord; message?: string })
            : null;
        if (errorObj?.duplicate) {
          setConfirmedData(null);
          setDuplicateWarning({
            businessName: errorObj.existing_qr?.business_name || cardData.businessName,
            network: errorObj.existing_qr?.network || cardData.network,
            dialCode: errorObj.existing_qr?.dial_code || cardData.ussdString,
            message: errorObj.message || "This QR code already exists.",
          });
        } else {
          // Offline network fallback: preserve confirmed data, add to local QR history & sync queue
          const offlineRecord: QRCodeRecord = {
            id:
              cardData.id || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            owner_id: currentUser?.id || "offline_owner",
            phone_number: currentUser?.phone_number || cardData.sanitizedInput,
            business_name: cardData.businessName,
            network: cardData.network,
            payment_type: cardData.paymentType,
            dial_code: cardData.ussdString,
            description: `${cardData.businessName} (${cardData.network} - ${cardData.sanitizedInput})`,
            amount: cardData.amount,
            item_name: cardData.itemName,
            is_dynamic: cardData.isDynamic ? 1 : 0,
            created_at: new Date().toISOString(),
          };
          setQrHistory((prev) => [offlineRecord, ...prev.filter((q) => q.id !== offlineRecord.id)]);
          try {
            const pending = JSON.parse(
              localStorage.getItem("ishyura_pending_offline_sync") || "[]",
            );
            pending.push({
              name: offlineRecord.description,
              amount: numAmount,
              meta: {
                business_name: cardData.businessName,
                network: cardData.network,
                payment_type: cardData.paymentType,
                dial_code: cardData.ussdString,
                is_dynamic: isDynamic,
                item_name: cleanItem || undefined,
              },
            });
            localStorage.setItem("ishyura_pending_offline_sync", JSON.stringify(pending));
          } catch {
            // Ignore offline pending queue write errors
          }
          setSavedSuccess(true);
        }
      })
      .finally(() => {
        setSavingQr(false);
      });
  };

  const handleEdit = () => {
    setConfirmedData(null);
    setDuplicateWarning(null);
    setOwnerReprintNotice(null);
  };

  const handleDownloadCustomerCard = async () => {
    if (!customerPrintCardRef.current || !selectedQrForCustomerPrint) return;
    setDownloadingCustomerCard(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(customerPrintCardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      const netSlug = (selectedQrForCustomerPrint.network || "MTN MoMo").replace(
        /[^a-zA-Z0-9]/g,
        "_",
      );
      link.download = `${(selectedQrForCustomerPrint.business_name || "Payment_Card").replace(/\s+/g, "_")}_${netSlug}_card.png`;
      link.href = dataUrl;
      link.click();
      IshyuraClient.recordDownload({
        business_name: selectedQrForCustomerPrint.business_name || "Payment Card",
        network: selectedQrForCustomerPrint.network || "MTN MoMo",
        dial_code: selectedQrForCustomerPrint.dial_code || "*182#",
        phone_number: selectedQrForCustomerPrint.phone_number || undefined,
        file_format: "png",
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to download customer card PNG", err);
    } finally {
      setDownloadingCustomerCard(false);
    }
  };

  const handleDeleteCustomerQr = async () => {
    if (!deleteConfirmCustomerQr) return;
    setDeletingCustomerQr(true);
    try {
      await IshyuraClient.deleteQrCode(deleteConfirmCustomerQr.id);
      setQrHistory((prev) => prev.filter((q) => q.id !== deleteConfirmCustomerQr.id));
      if (
        confirmedData &&
        (confirmedData.id === deleteConfirmCustomerQr.id ||
          confirmedData.ussdString === deleteConfirmCustomerQr.dial_code)
      ) {
        setConfirmedData(null);
      }
      setDuplicateWarning(null);
      setCustomerToastMsg(
        `Payment card for "${deleteConfirmCustomerQr.business_name}" deleted. Single-generation lock released — you can generate or print a fresh card anytime!`,
      );
      setTimeout(() => setCustomerToastMsg(null), 5000);
      setDeleteConfirmCustomerQr(null);
    } catch (err) {
      console.error("Failed to delete customer QR", err);
    } finally {
      setDeletingCustomerQr(false);
    }
  };

  const handleOpenEditDestination = (qr: QRCodeRecord) => {
    setEditingQr(qr);
    setEditBusinessName(qr.business_name || "");
    const cleanDigits = extractMerchantOrAccountCode(qr.dial_code, qr.phone_number);
    setEditAccountValue(cleanDigits || qr.phone_number || "");
    setEditNetwork((qr.network as Network) || "MTN MoMo");
    setEditPaymentType((qr.payment_type as PaymentType) || "momo_code");
    setEditAmount(qr.amount ? String(qr.amount) : "");
    setEditItemName(qr.item_name || "");
    setEditSuccessMsg(null);
    setEditDialogOpen(true);
  };

  const handleSaveEditDestination = async () => {
    if (!editingQr) return;
    setEditSaving(true);
    setEditSuccessMsg(null);
    try {
      const cleanDigits = extractMerchantOrAccountCode(editAccountValue);
      const numAmount = editAmount.trim() ? parseFloat(editAmount) : null;
      const newUssd = buildRwandaUssdString(editNetwork, editPaymentType, cleanDigits, numAmount);

      const updated = await IshyuraClient.updateQrCode(editingQr.id, {
        business_name: editBusinessName.trim() || editingQr.business_name,
        network: editNetwork,
        payment_type: editPaymentType,
        dial_code: newUssd,
        phone_number: cleanDigits,
        amount: numAmount,
        item_name: editItemName.trim() || null,
        is_dynamic: true,
      });

      // Update local state list
      setQrHistory((prev) => prev.map((q) => (q.id === editingQr.id ? { ...q, ...updated } : q)));

      // If active confirmed card matches this QR, update it live
      if (
        confirmedData &&
        (confirmedData.id === editingQr.id || confirmedData.ussdString === editingQr.dial_code)
      ) {
        setConfirmedData((prev) =>
          prev
            ? {
                ...prev,
                businessName: updated.business_name || prev.businessName,
                network: editNetwork,
                paymentType: editPaymentType,
                sanitizedInput: cleanDigits,
                ussdString: newUssd,
                amount: numAmount,
                itemName: editItemName.trim() || null,
              }
            : null,
        );
      }

      setEditSuccessMsg(
        "Destination updated! Existing printed cards and stickers now route to new details.",
      );
      setTimeout(() => {
        setEditDialogOpen(false);
        setEditSuccessMsg(null);
      }, 1300);
    } catch (err) {
      console.warn("Failed to update QR destination:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleQuickBillUpdate = async (qrId: string, amount: number | null) => {
    try {
      const updated = await IshyuraClient.quickUpdateCounterBill(qrId, amount);
      setQrHistory((prev) => prev.map((q) => (q.id === qrId ? { ...q, ...updated } : q)));
      setQuickBillToast({
        id: qrId,
        message: amount
          ? `✓ Bill updated to ${amount.toLocaleString()} RWF! Stand & NFC will show this amount instantly.`
          : `✓ Bill cleared! Customers will now enter their own amount.`,
      });
      setTimeout(() => setQuickBillToast(null), 4000);
    } catch {
      alert("Failed to update bill amount.");
    }
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
      const { toPng } = await import("html-to-image");
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

      // Post-download / print physical merchandise upsell prompt
      setTimeout(() => {
        setUpsellDialogOpen(true);
      }, 1000);
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
      const loggedUser = IshyuraClient.getSavedUser() || {
        id: res.user_id,
        phone_number: res.phone_number,
        is_fully_registered: res.is_fully_registered,
        role: res.role,
      };
      setCurrentUser(loggedUser);
      setOtpSent(false);
      setOtpCode("");
      setAuthDialogOpen(false);

      if (isAdminUser(loggedUser) && !confirmedData) {
        setActiveTab("inquiries");
      }

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

  const handleContinueWithGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const googleRes = await signInWithGoogleReal();
      if (!googleRes?.email) {
        throw new Error("No Google email received from authentication.");
      }

      const displayName = googleRes.name || googleRes.email.split("@")[0];
      const user = await IshyuraClient.signInWithGoogle({
        email: googleRes.email,
        name: displayName,
        sub: googleRes.uid,
      });

      setCurrentUser(user);
      setAuthDialogOpen(false);

      if (isAdminUser(user) && !confirmedData) {
        setActiveTab("inquiries");
      }

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
      console.error("Google sign in error", err);
      const msg = err instanceof Error ? err.message : "Google sign in failed.";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled-popup-request")) {
        setAuthError("Sign-in popup was closed. Please try again.");
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
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

      if (isAdminUser(user) && !confirmedData) {
        setActiveTab("inquiries");
      }

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

  const handleLogout = async () => {
    try {
      await logoutGoogle();
    } catch {
      // ignore
    }
    IshyuraClient.logout();
    setCurrentUser(null);
    setConfirmedData(null);
    setDuplicateWarning(null);
    setQrHistory([]);
    setActiveTab("generator");
  };

  const handleUserChange = (newUser: UserProfile | null) => {
    setCurrentUser(newUser);
    if (!newUser) {
      setConfirmedData(null);
      setDuplicateWarning(null);
      setActiveTab("generator");
    } else if (isAdminUser(newUser)) {
      setActiveTab("inquiries");
    }
  };

  return (
    <AppLayout
      currentUser={currentUser}
      onUserChange={handleUserChange}
      onOpenAuthDialog={() => {
        setAuthError(null);
        if (!authPhoneInput && sanitizedInput.length >= 8) {
          setAuthPhoneInput(sanitizedInput);
        }
        setAuthDialogOpen(true);
      }}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      inquiryCount={adminStats.newInquiries}
      orderCount={adminStats.pendingOrders}
    >
      {/* Offline Status & Bad Network Assistance Indicator */}
      <OfflineIndicator />

      {/* Global Dialog for Sign In when triggered */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Sign In
            </DialogTitle>
            <DialogDescription>
              Sign in with your phone or Google account to unlock and permanently own your payment
              QR stands.
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
                        {authLoading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
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
                          onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                          className="h-10 font-mono text-base tracking-widest text-center"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={otpCode.length < 6 || authLoading}
                          onClick={() => handleVerifyOtp(authPhoneInput)}
                          className="h-10 shrink-0 text-xs font-semibold px-4"
                        >
                          {authLoading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
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
                  disabled={authLoading || !passwordIdInput.trim() || !passwordValInput.trim()}
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

      {/* Post-Print / Post-Download Physical Merch Upsell Dialog */}
      <Dialog open={upsellDialogOpen} onOpenChange={setUpsellDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 border border-emerald-500/20">
              <Sparkles className="size-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Your QR Card is Ready!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Paper cards get wet or crumpled on busy shop counters. Would you like a durable,
              crystal-clear acrylic stand or waterproof vinyl stickers delivered to your shop?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-2">
            <div className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Premium Acrylic Counter Stand</p>
                <p className="text-[11px] text-muted-foreground">
                  Laser-cut L-stand with your QR &amp; logo
                </p>
              </div>
              <span className="text-xs font-extrabold text-foreground tabular-nums">7,500 RWF</span>
            </div>

            <div className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Pack of 5 Vinyl Stickers</p>
                <p className="text-[11px] text-muted-foreground">Waterproof &amp; UV resistant</p>
              </div>
              <span className="text-xs font-extrabold text-foreground tabular-nums">4,500 RWF</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              className="w-full text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
              onClick={() => {
                setUpsellDialogOpen(false);
                setSelectedProductForOrder("acrylic_stand");
                setOrderDialogOpen(true);
              }}
            >
              <Package className="size-3.5" />
              <span>Order Tabletop Stand (7,500 RWF)</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUpsellDialogOpen(false)}
              className="text-xs text-muted-foreground"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Edit Destination Modal for Dynamic QRs (No Reprinting) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
              <Edit3 className="size-5 text-primary" />
              <span>Edit Destination (No Reprinting)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update the phone number, merchant code, or price. Your physical stickers and stands
              will continue working immediately!
            </DialogDescription>
          </DialogHeader>

          {editSuccessMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span>{editSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Business Name</Label>
              <Input
                value={editBusinessName}
                onChange={(e) => setEditBusinessName(e.target.value)}
                placeholder="Business Name"
                className="h-10 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Network</Label>
                <Select value={editNetwork} onValueChange={(v) => setEditNetwork(v as Network)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN MoMo">MTN MoMo</SelectItem>
                    <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                    <SelectItem value="Equity Bank (eKash)">Equity Bank (eKash)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Type</Label>
                <Select
                  value={editPaymentType}
                  onValueChange={(v) => setEditPaymentType(v as PaymentType)}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momo_code">Merchant Code</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                {editPaymentType === "momo_code" ? "New MoMo / Till Code" : "New Phone Number"}
              </Label>
              <Input
                value={editAccountValue}
                onChange={(e) => setEditAccountValue(e.target.value)}
                placeholder="e.g. 123456 or 0788123456"
                className="h-10 font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Fixed Amount (RWF) (Optional)
                </Label>
                <Input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="h-10 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Item Name (Optional)</Label>
                <Input
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  placeholder="e.g. Lunch Buffet"
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
              💡 <strong>Instant propagation:</strong> Because this is an Ishyura Dynamic QR, anyone
              who scans your already-printed tabletop stands or stickers will automatically route to
              these new details!
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditDestination}
              disabled={editSaving}
              className="text-xs font-bold rounded-xl bg-primary shadow-xs"
            >
              {editSaving ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Save className="size-3.5 mr-1" />
              )}
              {editSaving ? "Saving..." : "Save Destination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instant 1-Tap Customer Scan Preview Dialog */}
      <Dialog
        open={Boolean(scanPreviewUrl)}
        onOpenChange={(open) => !open && setScanPreviewUrl(null)}
      >
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/80">
          <div className="bg-card p-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Zap className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-foreground">
                  1-Tap Customer Scan Experience
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Served directly from Cloudflare Edge (Sub-50ms)
                </p>
              </div>
            </div>
            {scanPreviewUrl && (
              <a
                href={scanPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted"
              >
                <span>Full Page</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {scanPreviewUrl && (
            <div className="p-4 bg-muted/30 flex justify-center">
              <div className="w-full max-w-[360px] h-[480px] rounded-2xl overflow-hidden shadow-xl border border-border/80 bg-background">
                <iframe
                  src={scanPreviewUrl}
                  title="Live Edge Pay Preview"
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-card border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Works seamlessly on iPhones &amp; Androids</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScanPreviewUrl(null)}
              className="text-xs font-semibold rounded-lg h-8"
            >
              Close Preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer High-Resolution Print & Download Modal (for lost QR reprint) */}
      <Dialog
        open={Boolean(selectedQrForCustomerPrint)}
        onOpenChange={(open) => !open && setSelectedQrForCustomerPrint(null)}
      >
        <DialogContent className="max-w-md bg-card border-border/80 p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <span>Official Counter Tent Card</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preview, download high-res PNG or print your official counter card.
            </DialogDescription>
          </DialogHeader>

          {selectedQrForCustomerPrint && (
            <div className="flex flex-col items-center py-2 space-y-4">
              {/* High-Fidelity Printable Card */}
              <div
                ref={customerPrintCardRef}
                className="w-72 overflow-hidden rounded-2xl bg-white text-slate-900 border-2 border-slate-200 shadow-2xl flex flex-col items-center text-center pb-5"
              >
                <div
                  className={`h-3 w-full ${
                    (selectedQrForCustomerPrint.network || "").includes("Equity")
                      ? "bg-rose-800"
                      : (selectedQrForCustomerPrint.network || "").includes("Airtel")
                        ? "bg-red-600"
                        : "bg-amber-400"
                  }`}
                />
                <div className="px-5 pt-4 pb-2 w-full flex flex-col items-center">
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                    <CheckCircle2 className="size-2.5" />
                    <span>Verified Merchant</span>
                  </div>

                  <h3 className="mt-1.5 text-xl font-black text-slate-900 truncate max-w-full">
                    {selectedQrForCustomerPrint.business_name || "Merchant"}
                  </h3>

                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                    <span>{selectedQrForCustomerPrint.network || "MTN MoMo"}</span>
                  </div>

                  {/* QR Code */}
                  <div className="mt-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-md">
                    <QRCodeSVG
                      value={
                        selectedQrForCustomerPrint.is_dynamic
                          ? `${window.location.origin}/p/${selectedQrForCustomerPrint.id}`
                          : `tel:${encodeURIComponent(
                              buildRwandaUssdString(
                                selectedQrForCustomerPrint.network || "MTN MoMo",
                                selectedQrForCustomerPrint.payment_type || "momo_code",
                                selectedQrForCustomerPrint.dial_code || "*182#",
                                selectedQrForCustomerPrint.amount,
                              ),
                            )}`
                      }
                      size={180}
                      level="H"
                    />
                  </div>

                  {/* Clean Merchant Code & Dial Code Display */}
                  <div className="mt-3 w-full rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-left">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {selectedQrForCustomerPrint.payment_type === "momo_code"
                          ? "Merchant Code (Code y'Umucuruzi)"
                          : "Recipient Phone"}
                      </p>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Zero Internet Needed
                      </span>
                    </div>
                    <p className="font-mono text-xl font-black text-slate-950 mt-0.5 tracking-wide">
                      {extractMerchantOrAccountCode(
                        selectedQrForCustomerPrint.dial_code,
                        selectedQrForCustomerPrint.phone_number || undefined,
                      )}
                    </p>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Direct USSD Dial:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {buildRwandaUssdString(
                          selectedQrForCustomerPrint.network || "MTN MoMo",
                          selectedQrForCustomerPrint.payment_type || "momo_code",
                          selectedQrForCustomerPrint.dial_code || "*182#",
                          selectedQrForCustomerPrint.amount,
                        )}
                      </span>
                    </div>
                  </div>

                  {selectedQrForCustomerPrint.amount && (
                    <div className="mt-2 w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-1">
                      <p className="text-[10px] font-bold text-amber-800 uppercase">
                        {selectedQrForCustomerPrint.item_name || "Fixed Amount"}
                      </p>
                      <p className="text-base font-black text-slate-900">
                        {selectedQrForCustomerPrint.amount.toLocaleString()} RWF
                      </p>
                    </div>
                  )}

                  <p className="mt-2.5 text-[10px] text-slate-500">
                    📶 100% Offline • Zero mobile data needed to pay • Ishyura.rw
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={handleDownloadCustomerCard}
                  disabled={downloadingCustomerCard}
                  variant="outline"
                  className="w-full text-xs font-bold gap-1.5 rounded-xl border-border"
                >
                  {downloadingCustomerCard ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>{downloadingCustomerCard ? "Saving..." : "Download PNG"}</span>
                </Button>

                <Button
                  onClick={() => window.print()}
                  className="w-full text-xs font-bold gap-1.5 rounded-xl bg-primary"
                >
                  <Printer className="size-3.5" />
                  <span>Print Card</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmCustomerQr)}
        onOpenChange={(open) => !open && setDeleteConfirmCustomerQr(null)}
      >
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-destructive">
              <Trash2 className="size-5" />
              <span>Delete QR &amp; Unlock Payment Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Delete the payment card for{" "}
              <strong className="text-foreground">{deleteConfirmCustomerQr?.business_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs space-y-2 text-destructive dark:text-rose-200">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle className="size-4 shrink-0" />
              <span>Single-Generation Lock Will Be Released</span>
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-rose-100/90">
              Deleting this card removes it from your saved records and unlocks this payment number
              in the Ishyura system. You will be free to generate a fresh new card from scratch
              anytime.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmCustomerQr(null)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingCustomerQr}
              onClick={handleDeleteCustomerQr}
              className="text-xs font-bold rounded-xl gap-1.5 shadow-xs"
            >
              {deletingCustomerQr ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>{deletingCustomerQr ? "Deleting..." : "Yes, Delete & Unlock"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tab-driven View Switching */}
      {isAdmin &&
      (activeTab === "inquiries" ||
        activeTab === "orders" ||
        activeTab === "qrs" ||
        activeTab === "merchants" ||
        activeTab === "admins" ||
        activeTab === "logs") ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <AdminWorkspace
            activeTab={activeTab}
            currentUser={currentUser!}
            onTabChange={setActiveTab}
          />
        </div>
      ) : currentUser && activeTab === "records" ? (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-5">
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                My Saved Payment Records
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Verified records of your registered payment numbers and merchant codes.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTab("generator")}
              className="text-xs font-bold gap-1.5 rounded-xl shadow-xs"
            >
              <Sparkles className="size-3.5" />
              <span>Generate New Card</span>
            </Button>
          </div>

          {/* Toast Message for Customer Actions */}
          {customerToastMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in-50">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span>{customerToastMsg}</span>
            </div>
          )}

          {/* Saved Payment Records Notice */}
          <div className="p-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 flex items-start gap-3">
            <Sparkles className="size-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Saved Payment Records</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your payment codes are active and ready. If you ever lose your counter card or
                phone, you can reprint or download your official counter tent cards below at any
                time, edit details, or release the code.
              </p>
            </div>
          </div>

          {qrHistory.length === 0 ? (
            <div className="p-12 rounded-3xl border border-dashed border-border/80 text-center bg-card/30 space-y-3">
              <History className="size-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-bold text-foreground">No payment cards on record</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate your first official payment QR tent card to have it archived securely here.
              </p>
              <Button
                size="sm"
                onClick={() => setActiveTab("generator")}
                className="text-xs font-bold rounded-xl mt-2"
              >
                Create Payment QR
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {qrHistory.map((qr) => (
                <div
                  key={qr.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card/60 space-y-4 shadow-sm hover:border-border transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-foreground truncate">
                          {qr.business_name || qr.description || "Merchant Store"}
                        </h3>
                        {Boolean(qr.is_dynamic) && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 px-2 py-0.5 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 shrink-0">
                            <Sparkles className="size-2.5" />
                            PRO DYNAMIC
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {qr.network || "Mobile Money"}
                        </span>
                        {qr.amount && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            {qr.amount.toLocaleString()} RWF
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(qr.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      Active
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">
                        {qr.payment_type === "momo_code" ? "Merchant Code:" : "Phone:"}
                      </span>
                      <span className="font-mono font-black text-foreground">
                        {extractMerchantOrAccountCode(qr.dial_code, qr.phone_number)}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground truncate ml-2">
                      {qr.dial_code}
                    </span>
                  </div>

                  {Boolean(qr.is_dynamic) && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <Zap className="size-3.5" />
                          Live Stand Bill (Print Once):
                        </span>
                        <span className="font-mono font-black text-foreground">
                          {qr.amount
                            ? `${qr.amount.toLocaleString()} RWF`
                            : "Open (Customer Enters)"}
                        </span>
                      </div>

                      {/* Quick inline updater */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder={qr.amount ? String(qr.amount) : "Set new bill amount..."}
                          defaultValue=""
                          id={`quick-bill-${qr.id}`}
                          className="h-8 text-xs font-mono font-bold bg-background/80"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const inputEl = document.getElementById(
                              `quick-bill-${qr.id}`,
                            ) as HTMLInputElement | null;
                            const val = inputEl?.value?.trim();
                            if (val) {
                              handleQuickBillUpdate(qr.id, parseFloat(val));
                              if (inputEl) inputEl.value = "";
                            }
                          }}
                          className="h-8 text-xs font-bold rounded-lg px-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 shrink-0"
                        >
                          Set Bill
                        </Button>
                        {qr.amount ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuickBillUpdate(qr.id, null)}
                            className="h-8 text-[11px] text-muted-foreground hover:text-foreground px-2"
                            title="Clear to open customer entry"
                          >
                            Reset
                          </Button>
                        ) : null}
                      </div>

                      {quickBillToast?.id === qr.id && (
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in-50">
                          <CheckCircle2 className="size-3.5" />
                          <span>{quickBillToast.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-1.5">
                    {/* Direct Print / Download Counter Card (Key feature for lost QR recovery!) */}
                    <Button
                      size="sm"
                      onClick={() => setSelectedQrForCustomerPrint(qr)}
                      className="h-8 text-xs font-bold gap-1 rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0"
                      title="Preview, download high-res PNG or print official counter card"
                    >
                      <Printer className="size-3.5" />
                      <span>Print / Download</span>
                    </Button>

                    {qr.is_dynamic ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const url = getDynamicPayUrl(qr.id);
                            setScanPreviewUrl(url);
                          }}
                          className="h-8 text-xs font-bold gap-1 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
                          title="Test 1-tap customer pay sheet"
                        >
                          <Zap className="size-3.5" />
                          <span>Test Pay</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditDestination(qr)}
                          className="h-8 text-xs font-semibold gap-1 rounded-xl border-border/80 hover:bg-muted"
                          title="Update recipient number or price without reprinting"
                        >
                          <Edit3 className="size-3.5" />
                          <span>Edit</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBusinessName(qr.business_name || "");
                          setNetwork((qr.network as Network) || "MTN MoMo");
                          setPaymentType((qr.payment_type as PaymentType) || "momo_code");
                          const digits = extractMerchantOrAccountCode(
                            qr.dial_code,
                            qr.phone_number,
                          );
                          setAccountValue(digits);
                          setActiveTab("generator");
                        }}
                        className="h-8 text-xs font-semibold gap-1 rounded-xl border-border/80 hover:bg-muted"
                        title="Open in generator to customize"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Generator</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProductForOrder("acrylic_stand");
                        setOrderDialogOpen(true);
                      }}
                      className="h-8 text-xs font-semibold gap-1 rounded-xl border-border/80 hover:bg-muted"
                    >
                      <Package className="size-3.5" />
                      <span>Order Stand</span>
                    </Button>

                    {/* Delete Card & Unlock Code */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmCustomerQr(qr)}
                      className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl px-2"
                      title="Delete card and release duplicate lock so you can print again"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only sm:not-sr-only sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "store" ? (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <div className="border-b border-border/60 pb-5">
            <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Stands, Stickers &amp; Counter Hardware
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Laser-cut tabletop acrylic stands and heavy-duty waterproof vinyl stickers for your
              shop in Kigali.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Stand */}
            <div className="p-5 rounded-2xl border border-border/80 bg-card/60 flex flex-col justify-between space-y-4 shadow-sm hover:border-emerald-500/50 transition-all">
              <div className="space-y-3">
                <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Store className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">A6 Tabletop Acrylic Stand</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Laser-cut crystal-clear acrylic L-stand. Protects your payment card from spills,
                    grease, and wear on busy counters.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-foreground">5,000 RWF</span>
                  <span className="text-[10px] text-muted-foreground">Kigali Delivery</span>
                </div>
                <Button
                  onClick={() => {
                    setSelectedProductForOrder("acrylic_stand");
                    setOrderDialogOpen(true);
                  }}
                  className="w-full text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Order Acrylic Stand
                </Button>
              </div>
            </div>

            {/* Stickers */}
            <div className="p-5 rounded-2xl border border-border/80 bg-card/60 flex flex-col justify-between space-y-4 shadow-sm hover:border-sky-500/50 transition-all">
              <div className="space-y-3">
                <div className="size-11 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <Package className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Pack of 5 Vinyl Stickers</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Heavy-duty laminated vinyl stickers. Waterproof and weather-resistant for
                    windows, cash registers, and doors.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-foreground">3,000 RWF</span>
                  <span className="text-[10px] text-muted-foreground">5x Pack</span>
                </div>
                <Button
                  onClick={() => {
                    setSelectedProductForOrder("vinyl_stickers");
                    setOrderDialogOpen(true);
                  }}
                  className="w-full text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white"
                >
                  Order 5x Stickers Pack
                </Button>
              </div>
            </div>

            {/* Bundle */}
            <div className="p-5 rounded-2xl border-2 border-primary/50 bg-primary/5 flex flex-col justify-between space-y-4 shadow-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                    <Sparkles className="size-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Best Value
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Complete Merchant Bundle</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    1x A6 Acrylic Counter Stand + 5x Waterproof Vinyl Stickers. The complete payment
                    display counter package.
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-foreground">7,500 RWF</span>
                  <span className="text-[10px] line-through text-muted-foreground">8,000 RWF</span>
                </div>
                <Button
                  onClick={() => {
                    setSelectedProductForOrder("pro_bundle");
                    setOrderDialogOpen(true);
                  }}
                  className="w-full text-xs font-bold rounded-xl shadow-xs"
                >
                  Order Starter Bundle
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-12 pt-6 sm:px-8 lg:px-12">
          {/* Page Title Header (Clean and focused) */}
          <div className="border-b border-border/50 pb-5 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Soft Tool Studio
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">Instant Stand Generator</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Payment QR Tent Card Generator
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Instant printable Mobile Money payment tent cards for MTN MoMo, Airtel Money &amp;
              Equity eKash.
            </p>
          </div>

          {/* Main Content Grid */}
          <main className="mt-6 grid flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Form & Confirmation step */}
            <section className="lg:col-span-6 xl:col-span-5">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  Get paid with a scan
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Enter your merchant code or phone number to generate a printable payment tent
                  card.
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
                      ✨ Equity eKash lets clients pay directly to your phone number for just 20
                      RWF!
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

                {/* ---------------------------------------------------- */}
                {/* TIER SELECTION: Basic Stand (Free) vs Dynamic PRO Stand */}
                {/* ---------------------------------------------------- */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Choose Stand &amp; Feature Tier
                    </Label>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {isDynamic ? "⚡ PRO Monthly Plan" : "📴 100% Free Forever"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* TIER 1: Basic Offline (100% Free) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setIsDynamic(false);
                        if (confirmedData) setConfirmedData(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setIsDynamic(false);
                          if (confirmedData) setConfirmedData(null);
                        }
                      }}
                      className={`relative cursor-pointer rounded-2xl border p-4 transition-all text-left flex flex-col justify-between ${
                        !isDynamic
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : "border-border/80 bg-card/60 hover:border-border hover:bg-muted/30 opacity-80"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📴</span>
                            <span className="font-extrabold text-sm text-foreground">
                              Basic Stand
                            </span>
                          </div>
                          <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            0 RWF (Free)
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>100% Offline Direct USSD</strong>. Customer camera scans to dial
                          immediately with <strong>zero mobile data</strong>. Fixed once printed.
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Physical Stands &amp; Stickers</span>
                        <span className="font-bold text-foreground">One-Time Print</span>
                      </div>
                    </div>

                    {/* TIER 2: Dynamic PRO (Monthly Plan - Print Once, Update Forever) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setIsDynamic(true);
                        if (confirmedData) setConfirmedData(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setIsDynamic(true);
                          if (confirmedData) setConfirmedData(null);
                        }
                      }}
                      className={`relative cursor-pointer rounded-2xl border p-4 transition-all text-left flex flex-col justify-between ${
                        isDynamic
                          ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/25 shadow-sm"
                          : "border-border/80 bg-card/60 hover:border-border hover:bg-muted/30 opacity-80"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚡</span>
                            <span className="font-extrabold text-sm text-foreground">
                              Dynamic PRO
                            </span>
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">
                              PRO
                            </span>
                          </div>
                          <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            5,000 RWF/mo
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Print Once, Update Forever</strong>. Web QR &amp; Smart NFC.
                          Update bill amounts or recipient numbers from your dashboard{" "}
                          <strong>without reprinting</strong>.
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span>NFC Tags &amp; Counter Stands</span>
                        <span className="font-black text-amber-600 dark:text-amber-400">
                          Never Reprint
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Tier Configuration Box */}
                  <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-4">
                    {/* If Basic Stand: Option for static predefined price */}
                    {!isDynamic ? (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="basic-fixed-toggle"
                              className="text-xs font-bold text-foreground cursor-pointer"
                            >
                              Encode Fixed Predefined Price (Static USSD)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              Bake fixed amount (e.g. 1,000 RWF parking, 500 RWF entry) directly
                              into offline QR.
                            </p>
                          </div>
                          <Switch
                            id="basic-fixed-toggle"
                            checked={hasFixedAmount}
                            onCheckedChange={(val) => {
                              setHasFixedAmount(val);
                              if (confirmedData) setConfirmedData(null);
                            }}
                          />
                        </div>

                        {hasFixedAmount && (
                          <div className="pt-2 border-t border-border/40 space-y-3 animate-in fade-in-50">
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="basic-fixed-amount"
                                className="text-xs font-bold text-foreground"
                              >
                                Fixed Price to Encode (RWF)
                              </Label>
                              <div className="relative">
                                <Input
                                  id="basic-fixed-amount"
                                  type="number"
                                  inputMode="numeric"
                                  placeholder="e.g. 2000"
                                  value={fixedAmount}
                                  onChange={(e) => {
                                    setFixedAmount(e.target.value);
                                    if (confirmedData) setConfirmedData(null);
                                  }}
                                  className="h-10 font-mono font-bold pr-14"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                                  RWF
                                </span>
                              </div>
                            </div>

                            {/* Quick Preset Chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                                Quick:
                              </span>
                              {["500", "1000", "2000", "5000"].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => {
                                    setFixedAmount(amt);
                                    if (confirmedData) setConfirmedData(null);
                                  }}
                                  className={`rounded-lg px-2 py-1 text-[11px] font-bold border transition-colors ${
                                    fixedAmount === amt
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 border-border text-foreground hover:bg-muted"
                                  }`}
                                >
                                  {parseInt(amt).toLocaleString()} RWF
                                </button>
                              ))}
                            </div>

                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ Note: Because this is a 100% offline static card, changing this
                              price in the future will require printing a new stand or sticker.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* If Dynamic PRO Stand: Mode options */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div>
                            <span className="text-xs font-bold text-foreground">
                              PRO Stand Bill Mode
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              Select how customer payment amounts are determined on this stand.
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Print Once Guarantee Active
                          </span>
                        </div>

                        {/* Bill Mode Options: Open vs Predefined */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setHasFixedAmount(false);
                              if (confirmedData) setConfirmedData(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              !hasFixedAmount
                                ? "border-amber-500/70 bg-amber-500/10 shadow-xs"
                                : "border-border/60 bg-muted/20 hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-foreground">
                                1. Open Customer Entry
                              </span>
                              {!hasFixedAmount && (
                                <CheckCircle2 className="size-3.5 text-amber-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                              Customers enter amount or tap quick chips (+500, +1k, +5k) on their
                              phone.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setHasFixedAmount(true);
                              if (confirmedData) setConfirmedData(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              hasFixedAmount
                                ? "border-amber-500/70 bg-amber-500/10 shadow-xs"
                                : "border-border/60 bg-muted/20 hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-foreground">
                                2. Pre-set Bill / Item
                              </span>
                              {hasFixedAmount && (
                                <CheckCircle2 className="size-3.5 text-amber-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-normal">
                              Set specific bill (e.g. Table 4). Update live anytime without
                              reprinting.
                            </p>
                          </button>
                        </div>

                        {hasFixedAmount && (
                          <div className="space-y-3 pt-2 animate-in fade-in-50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="pro-fixed-amount"
                                  className="text-xs font-bold text-foreground"
                                >
                                  Initial Bill Amount (RWF)
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="pro-fixed-amount"
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="e.g. 15000"
                                    value={fixedAmount}
                                    onChange={(e) => {
                                      setFixedAmount(e.target.value);
                                      if (confirmedData) setConfirmedData(null);
                                    }}
                                    className="h-10 font-mono font-bold pr-14"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                                    RWF
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label
                                  htmlFor="pro-item-name"
                                  className="text-xs font-bold text-foreground"
                                >
                                  Bill or Table Label (Optional)
                                </Label>
                                <Input
                                  id="pro-item-name"
                                  type="text"
                                  placeholder="e.g. Table 4 Bill, Lunch Special"
                                  value={itemName}
                                  onChange={(e) => {
                                    setItemName(e.target.value);
                                    if (confirmedData) setConfirmedData(null);
                                  }}
                                  className="h-10 text-xs"
                                />
                              </div>
                            </div>

                            {/* Quick Preset Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                                Quick:
                              </span>
                              {["1000", "2000", "3500", "5000", "10000", "15000"].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => {
                                    setFixedAmount(amt);
                                    if (confirmedData) setConfirmedData(null);
                                  }}
                                  className={`rounded-lg px-2 py-1 text-[11px] font-bold border transition-colors ${
                                    fixedAmount === amt
                                      ? "bg-amber-500 text-slate-950 border-amber-500"
                                      : "bg-muted/50 border-border text-foreground hover:bg-muted"
                                  }`}
                                >
                                  {parseInt(amt).toLocaleString()} RWF
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1 text-amber-700 dark:text-amber-400">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Zap className="size-3.5" />
                            <span>Zero Reprinting &amp; Zero Duplicate Clutter Guarantee</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-normal">
                            Print your acrylic stand or write your NFC tag{" "}
                            <strong>only once</strong>. Whenever you change this bill from your
                            dashboard, customers scanning the stand or tapping the NFC tag see the
                            new amount instantly in real-time.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmation Action & Checklist */}
                <div className="pt-2">
                  {confirmedData ? (
                    <div className="space-y-2">
                      {ownerReprintNotice && (
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-800 dark:text-sky-200 flex items-start gap-2.5 animate-in fade-in-50">
                          <CheckCircle2 className="size-4 text-sky-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-bold text-foreground">
                              Verified Payment Card Reloaded for Reprinting
                            </p>
                            <p className="text-[11px] text-muted-foreground dark:text-sky-100/80">
                              {ownerReprintNotice.message}
                            </p>
                          </div>
                        </div>
                      )}

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
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentUser && duplicateWarning && (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
                          <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-300">
                            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>A QR card for this payment code was already printed</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-amber-100/90">
                            A payment QR card for <strong>{duplicateWarning.businessName}</strong> (
                            {duplicateWarning.network} -{" "}
                            <code className="font-mono">{duplicateWarning.dialCode}</code>) was
                            already registered. If this is your business, sign in with your owner
                            account to reprint or manage it.
                          </p>
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                if (duplicateWarning.ownerPhone) {
                                  setAuthPhoneInput(duplicateWarning.ownerPhone);
                                }
                                setAuthDialogOpen(true);
                              }}
                              className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                            >
                              <LogIn className="size-3.5" />
                              <span>I am Owner — Sign In to Reprint</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInquiryDialogOpen(true);
                              }}
                              className="h-8 text-xs font-semibold gap-1.5 border-border/70 hover:bg-muted"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Request Help</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedProductForOrder("acrylic_stand");
                                setOrderDialogOpen(true);
                              }}
                              className="h-8 text-xs font-semibold gap-1.5 border-border/70 hover:bg-muted"
                            >
                              <Package className="size-3.5" />
                              <span>Order Stand / Stickers</span>
                            </Button>
                            {isAdmin && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary bg-primary/10 text-[10px]"
                              >
                                Administrator Privilege: You can unlock in Admin Portal
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {sanitizedInput.length > 0 && validationError && !duplicateWarning && (
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          {validationError}
                        </p>
                      )}

                      <Button
                        type="submit"
                        disabled={!canConfirm || checkingDuplicate}
                        className="w-full h-12 text-sm sm:text-base font-bold shadow-md shadow-primary/25"
                      >
                        {checkingDuplicate ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-1.5" />
                            Checking registry...
                          </>
                        ) : !currentUser ? (
                          <>
                            <Lock className="size-4" />
                            Sign In
                            <ArrowRight className="size-4" />
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" />
                            Confirm &amp; Generate QR Card
                            <ArrowRight className="size-4" />
                          </>
                        )}
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

              {/* Sign-In Box */}
              {!currentUser ? (
                <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Sign In Required
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                      Instant Access
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Sign in with Google or your phone number to generate and save your payment QR
                    tent cards.
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
                      <span>Sign In with Google</span>
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
                      <span>Sign In with Phone</span>
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

                      {confirmedData.isDynamic && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[9px] font-black uppercase text-amber-700">
                          <Sparkles className="size-2.5" />
                          <span>Smart Dynamic QR • PRO</span>
                        </div>
                      )}

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
                            <p className="text-xs font-bold text-foreground">
                              Sign In to Reveal QR
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Click to unlock with Phone or Google
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 w-full rounded-xl bg-print-muted px-4 py-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-print-muted-ink">
                            {confirmedData.paymentType === "momo_code"
                              ? "Merchant Code (Code y'Umucuruzi)"
                              : "Phone Number"}
                          </p>
                          <span
                            className={
                              confirmedData.isDynamic
                                ? "text-[9px] font-bold text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded-full"
                                : "text-[9px] font-bold text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded-full"
                            }
                          >
                            {confirmedData.isDynamic
                              ? "Web Link (Needs Data)"
                              : "100% Offline (Zero Data Needed)"}
                          </span>
                        </div>
                        <p className="font-mono text-xl font-black text-print-ink mt-0.5 tracking-wide">
                          {extractMerchantOrAccountCode(
                            confirmedData.sanitizedInput || confirmedData.ussdString,
                          )}
                        </p>
                        <div className="mt-1.5 pt-1.5 border-t border-print-muted-ink/15 flex items-center justify-between">
                          <span className="text-[10px] text-print-muted-ink font-semibold">
                            Direct USSD Dial:
                          </span>
                          <span className="font-mono text-xs font-bold tracking-tight text-print-ink">
                            {confirmedData.ussdString}
                          </span>
                        </div>
                        {confirmedData.feeNote && (
                          <p className="mt-1 text-[11px] font-bold text-emerald-700">
                            {confirmedData.feeNote}
                          </p>
                        )}
                      </div>

                      {confirmedData.amount && (
                        <div className="mt-2.5 w-full rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-center">
                          <p className="text-[10px] uppercase font-bold text-primary tracking-wider">
                            {confirmedData.itemName || "Pre-defined Amount"}
                          </p>
                          <p className="text-xl font-black text-print-ink">
                            {confirmedData.amount.toLocaleString()} RWF
                          </p>
                        </div>
                      )}

                      <p className="mt-3 text-[11px] font-medium text-print-muted-ink">
                        {confirmedData.isDynamic
                          ? "⚡ Smart Dynamic Stand • Tap NFC or scan to pay with live bill"
                          : "📶 Works 100% Offline • Scan camera or dial code • No internet data needed"}
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

                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="lg"
                        className="w-full h-11 text-xs sm:text-sm font-bold shadow-md shadow-primary/20"
                        onClick={handleDownload}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <Loader2 className="size-4 animate-spin mr-1.5" />
                        ) : (
                          <Download className="size-4 mr-1.5" />
                        )}
                        {downloading ? "Preparing…" : "Download PNG"}
                      </Button>

                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full h-11 text-xs sm:text-sm font-bold border-border/80 hover:bg-muted"
                        onClick={() => window.print()}
                      >
                        <Printer className="size-4 mr-1.5" />
                        <span>Print Card</span>
                      </Button>
                    </div>

                    {confirmedData.isDynamic && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-amber-500" />
                            Dynamic Smart QR Controls
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            PRO Preview
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const url =
                                confirmedData.dynamicUrl ||
                                getDynamicPayUrl(confirmedData.id || "preview");
                              setScanPreviewUrl(url);
                            }}
                            className="w-full h-9 text-xs font-bold gap-1.5 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
                          >
                            <Zap className="size-3.5" />
                            <span>Test Pay Sheet</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleOpenEditDestination({
                                id: confirmedData.id || "preview",
                                owner_id: currentUser?.id || "",
                                business_name: confirmedData.businessName,
                                network: confirmedData.network,
                                payment_type: confirmedData.paymentType,
                                dial_code: confirmedData.ussdString,
                                phone_number: confirmedData.sanitizedInput,
                                amount: confirmedData.amount,
                                item_name: confirmedData.itemName,
                                is_dynamic: true,
                                description: `${confirmedData.businessName} (${confirmedData.network})`,
                                created_at: new Date().toISOString(),
                              });
                            }}
                            className="w-full h-9 text-xs font-bold gap-1.5 border-border hover:bg-muted"
                          >
                            <Edit3 className="size-3.5 text-foreground" />
                            <span>Edit Number</span>
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          ⚡ <strong>Never reprint:</strong> Update your phone number anytime.
                          Scanners immediately route to the new details without reprinting the card!
                        </p>
                      </div>
                    )}

                    {/* Print and Save Note */}
                    <div className="p-3 rounded-xl bg-muted/50 border border-border/70 text-xs text-muted-foreground space-y-1">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Printer className="size-3.5 text-primary shrink-0" />
                        <span>Print or download your card</span>
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Keep your printed card in a safe place on your counter. Your account
                        archives your verified payment dial code so you can re-order stands or
                        request replacements anytime.
                      </p>
                    </div>

                    {/* Order physical merch buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProductForOrder("acrylic_stand");
                          setOrderDialogOpen(true);
                        }}
                        className="h-9 text-xs font-semibold gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      >
                        <Store className="size-3.5 text-emerald-600" />
                        <span>Order Acrylic Stand</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProductForOrder("vinyl_stickers");
                          setOrderDialogOpen(true);
                        }}
                        className="h-9 text-xs font-semibold gap-1.5 border-sky-500/40 hover:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      >
                        <Package className="size-3.5 text-sky-600" />
                        <span>Order 5x Stickers</span>
                      </Button>
                    </div>

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
                              : "Recorded in your account"}
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
                    Print directly or save image to display on your shop counter.
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

          {/* Minimal Footer */}
          <footer className="mt-12 border-t border-border/50 pt-6 text-xs text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">Ishyura</span>
                <span>—</span>
                <span>Rwanda Payment QR Card Studio</span>
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
          </footer>
        </div>
      )}
    </AppLayout>
  );
}
