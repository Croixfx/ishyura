import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Users,
  QrCode,
  MessageSquare,
  Download,
  RefreshCw,
  Lock,
  Loader2,
  CheckCircle2,
  Database,
  AlertCircle,
  ExternalLink,
  Package,
  Truck,
  FileDown,
  Phone,
  MapPin,
  Smartphone,
  Printer,
  Trash2,
  Search,
  UserPlus,
  Eye,
  ShieldAlert,
  ChevronDown,
  Mail,
  User,
} from "lucide-react";
import {
  IshyuraClient,
  type AdminStats,
  type MerchantRecord,
  type InquiryRecord,
  type OrderRecord,
  type DownloadEventRecord,
  type AdminUserRecord,
  type QRCodeRecord,
  type UserProfile,
} from "@/lib/ishyura-client";
import { signInWithGoogleReal, logoutGoogle } from "@/lib/firebase-auth";

interface AdminSearch {
  tab?: string;
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    return {
      tab: (search.tab as string) || "orders",
    };
  },
  head: () => ({
    meta: [
      {
        title: "Ishyura Portal — Owner & Administrative Dashboard",
      },
      {
        name: "robots",
        content: "noindex, nofollow",
      },
      {
        name: "description",
        content: "Secure portal for platform administration and merchant reporting.",
      },
    ],
  }),
  component: AdminPage,
});

const ADMIN_STORAGE_KEY = "ishyura_admin_key";

function AdminPage() {
  const searchParams = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(searchParams.tab || "orders");

  const [adminKey, setAdminKey] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showKeyFallback, setShowKeyFallback] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadEventRecord[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [systemAdmins, setSystemAdmins] = useState<AdminUserRecord[]>([]);

  // QR management state
  const [searchQr, setSearchQr] = useState<string>("");
  const [selectedQrForPrint, setSelectedQrForPrint] = useState<QRCodeRecord | null>(null);
  const [unlockingQrId, setUnlockingQrId] = useState<string | null>(null);
  const [unlockSuccessMsg, setUnlockSuccessMsg] = useState<string | null>(null);
  const printCardRef = useRef<HTMLDivElement>(null);
  const [downloadingPrint, setDownloadingPrint] = useState(false);

  // Admin users state
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  // Twilio Settings & Test SMS State
  const [twilioSettings, setTwilioSettings] = useState<{
    hasAccountSid: boolean;
    accountSidMasked: string;
    hasAuthToken: boolean;
    phoneNumber: string;
    verifyServiceSid: string;
  } | null>(null);

  const [editAccountSid, setEditAccountSid] = useState("");
  const [editAuthToken, setEditAuthToken] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVerifySid, setEditVerifySid] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [testSmsLoading, setTestSmsLoading] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{
    success: boolean;
    provider?: string;
    messageId?: string;
    detail: string;
    error?: string;
    isTrialNotice?: boolean;
    test_code?: string;
    rawResponse?: unknown;
  } | null>(null);

  // Sync tab with URL search parameter if changed
  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.tab]);

  // Check current user login status & local admin key on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = IshyuraClient.getCurrentUser();
      setCurrentUser(user);

      if (user && user.role === "admin") {
        const key = user.access_token || user.email || "ishyura2026";
        setAdminKey(key);
        verifyAndFetch(key);
        return;
      }

      const savedKey = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (savedKey) {
        setAdminKey(savedKey);
        verifyAndFetch(savedKey);
      }
    }
  }, []);

  const verifyAndFetch = async (keyToUse: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const statsData = await IshyuraClient.getAdminStats(keyToUse);
      setStats(statsData);
      setIsAuthenticated(true);
      localStorage.setItem(ADMIN_STORAGE_KEY, keyToUse);

      const [
        merchantsList,
        inquiriesList,
        ordersList,
        downloadsList,
        qrList,
        adminsList,
        settingsData,
      ] = await Promise.all([
        IshyuraClient.getAdminMerchants(keyToUse).catch(() => []),
        IshyuraClient.getAdminInquiries(keyToUse).catch(() => []),
        IshyuraClient.getAdminOrders(keyToUse).catch(() => []),
        IshyuraClient.getAdminDownloads(keyToUse).catch(() => []),
        IshyuraClient.getAdminQrCodes(keyToUse).catch(() => []),
        IshyuraClient.getAdminAdmins(keyToUse).catch(() => []),
        IshyuraClient.getAdminSettings(keyToUse).catch(() => null),
      ]);

      setMerchants(merchantsList);
      setInquiries(inquiriesList);
      setOrders(ordersList);
      setDownloads(downloadsList);
      setQrCodes(qrList);
      setSystemAdmins(adminsList);

      if (settingsData?.twilio) {
        setTwilioSettings(settingsData.twilio);
        setEditPhone(settingsData.twilio.phoneNumber || "");
        setEditVerifySid(settingsData.twilio.verifyServiceSid || "");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In for Administrator Accounts
  const handleGoogleAdminLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const gUser = await signInWithGoogleReal();
      if (!gUser?.email) {
        throw new Error("No Google account email provided.");
      }

      const response = await IshyuraClient.signInWithGoogle({
        email: gUser.email,
        name: gUser.name || undefined,
        sub: gUser.uid,
      });

      if (response.role !== "admin") {
        IshyuraClient.saveUser(response);
        setCurrentUser(response);
        throw new Error(
          `Signed in as ${gUser.email}, but this account is not registered as an Administrator in Ishyura. Contact the platform administrator (jeanniyonkuru29@gmail.com) for privileges.`,
        );
      }

      IshyuraClient.saveUser(response);
      setCurrentUser(response);
      setAdminKey(response.access_token);
      await verifyAndFetch(response.access_token);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualKeyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setAuthError("Please enter your admin credentials.");
      return;
    }
    verifyAndFetch(adminKey.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    IshyuraClient.logout();
    logoutGoogle().catch(() => {});
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAdminKey("");
    setStats(null);
    setMerchants([]);
    setInquiries([]);
    setOrders([]);
    setDownloads([]);
    setQrCodes([]);
    setSystemAdmins([]);
  };

  const handleToggleInquiryStatus = async (id: string, currentStatus: "new" | "resolved") => {
    const newStatus = currentStatus === "new" ? "resolved" : "new";
    try {
      await IshyuraClient.updateInquiryStatus(adminKey, id, newStatus);
      setInquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)),
      );
      if (stats) {
        setStats({
          ...stats,
          new_inquiries:
            newStatus === "resolved"
              ? Math.max(0, stats.new_inquiries - 1)
              : stats.new_inquiries + 1,
        });
      }
    } catch (err: unknown) {
      console.error("Failed to update inquiry status:", err);
    }
  };

  const handleUpdateOrderStatus = async (id: string, newStatus: string) => {
    try {
      await IshyuraClient.updateOrderStatus(adminKey, id, newStatus);
      setOrders((prev) =>
        prev.map((ord) => (ord.id === id ? { ...ord, status: newStatus as OrderStatus } : ord)),
      );
      if (stats) {
        setStats({
          ...stats,
          pending_orders:
            newStatus === "pending"
              ? stats.pending_orders + 1
              : Math.max(0, stats.pending_orders - 1),
        });
      }
    } catch (err: unknown) {
      console.error("Failed to update order status:", err);
    }
  };

  // QR Code Single Generation Unlock / Delete
  const handleUnlockQr = async (id: string) => {
    if (
      !window.confirm(
        "Unlock and remove this QR code? The merchant will be allowed to generate a new card.",
      )
    ) {
      return;
    }
    setUnlockingQrId(id);
    setUnlockSuccessMsg(null);
    try {
      await IshyuraClient.deleteAdminQrCode(adminKey, id);
      setQrCodes((prev) => prev.filter((q) => q.id !== id));
      setUnlockSuccessMsg(
        "Payment QR code unlocked successfully. The merchant may now generate a new card.",
      );
      setTimeout(() => setUnlockSuccessMsg(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unlock QR code.");
    } finally {
      setUnlockingQrId(null);
    }
  };

  // Download printable card for merchant
  const handleDownloadMerchantPrint = async () => {
    if (!printCardRef.current || !selectedQrForPrint) return;
    setDownloadingPrint(true);
    try {
      const dataUrl = await toPng(printCardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      const cleanName = (selectedQrForPrint.business_name || "Merchant").replace(/\s+/g, "_");
      link.download = `Ishyura_${cleanName}_Print_Card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Card print export error:", err);
    } finally {
      setDownloadingPrint(false);
    }
  };

  // Add new administrator
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminEmail.includes("@")) {
      setAdminErrorMsg("Please enter a valid administrator email address.");
      return;
    }
    setAddingAdmin(true);
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);
    try {
      const res = await IshyuraClient.addAdmin(
        adminKey,
        newAdminEmail.trim().toLowerCase(),
        newAdminName.trim() || undefined,
      );
      if (res.admin) {
        setSystemAdmins((prev) => [
          ...prev.filter((a) => a.email !== res.admin!.email),
          res.admin!,
        ]);
      }
      setAdminSuccessMsg(`Administrator ${newAdminEmail} added successfully.`);
      setNewAdminEmail("");
      setNewAdminName("");
      setTimeout(() => setAdminSuccessMsg(null), 5000);
    } catch (err) {
      setAdminErrorMsg(err instanceof Error ? err.message : "Failed to add administrator.");
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (id: string, email: string) => {
    if (email === "jeanniyonkuru29@gmail.com") {
      alert("Superadmin cannot be deleted.");
      return;
    }
    if (!window.confirm(`Revoke administrative privileges from ${email}?`)) {
      return;
    }
    try {
      await IshyuraClient.removeAdmin(adminKey, id);
      setSystemAdmins((prev) => prev.filter((a) => a.id !== id));
      setAdminSuccessMsg(`Privileges revoked from ${email}.`);
      setTimeout(() => setAdminSuccessMsg(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke admin.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      await IshyuraClient.saveAdminSettings(adminKey, {
        twilio_account_sid: editAccountSid || undefined,
        twilio_auth_token: editAuthToken || undefined,
        twilio_phone_number: editPhone || undefined,
        twilio_verify_service_sid: editVerifySid || undefined,
      });
      setSettingsSavedMsg("Twilio settings successfully saved to database.");
      const updated = await IshyuraClient.getAdminSettings(adminKey);
      if (updated?.twilio) {
        setTwilioSettings(updated.twilio);
      }
      setEditAccountSid("");
      setEditAuthToken("");
    } catch (err) {
      setSettingsSavedMsg(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTestSmsLoading(true);
    setTestSmsResult(null);
    try {
      const res = await IshyuraClient.testAdminSms(adminKey, testPhone.trim());
      setTestSmsResult(res);
    } catch (err) {
      setTestSmsResult({
        success: false,
        detail: err instanceof Error ? err.message : "Test dispatch failed.",
      });
    } finally {
      setTestSmsLoading(false);
    }
  };

  // Filtered QR codes
  const filteredQrs = qrCodes.filter((q) => {
    if (!searchQr.trim()) return true;
    const term = searchQr.toLowerCase();
    return (
      (q.business_name && q.business_name.toLowerCase().includes(term)) ||
      (q.dial_code && q.dial_code.toLowerCase().includes(term)) ||
      (q.network && q.network.toLowerCase().includes(term)) ||
      (q.phone_number && q.phone_number.toLowerCase().includes(term))
    );
  });

  return (
    <AppLayout currentUser={currentUser} onUserChange={setCurrentUser}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Top Header */}
        <header className="border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-30">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="size-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-foreground">
                    Ishyura Administrative Portal
                  </span>
                  <span className="bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
                    RBAC Database
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  Overall platform control · Single-generation QR registry · Physical orders
                </p>
              </div>
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verifyAndFetch(adminKey)}
                  disabled={loading}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh Data</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                >
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-8">
          {!isAuthenticated ? (
            /* Secure Locked Authentication Screen */
            <div className="py-12 max-w-md mx-auto text-center space-y-5">
              <div className="size-16 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center shadow-xs">
                <Lock className="size-8" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive mb-2">
                  <ShieldAlert className="size-3" />
                  <span>Restricted Access Control</span>
                </div>
                <h1 className="text-xl font-black text-foreground">Database-Backed Admin Login</h1>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Direct URL browsing without administrator credentials is prohibited to prevent
                  unauthorized access. Administrators are verified against the system database.
                </p>
              </div>

              {currentUser && currentUser.role !== "admin" && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 text-left space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" />
                    <span>Insufficient Permissions</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    You are signed in as{" "}
                    <strong>{currentUser.phone_number || currentUser.email}</strong>, which has
                    regular <strong>Merchant</strong> role.
                  </p>
                </div>
              )}

              {authError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2 text-left">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="leading-relaxed">{authError}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleGoogleAdminLogin}
                  disabled={loading}
                  className="w-full h-11 text-xs sm:text-sm font-bold gap-2 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  <span>Sign In with Google (Admin Account)</span>
                </Button>

                <p className="text-[11px] text-muted-foreground">
                  Registered system admins (e.g.{" "}
                  <code className="font-mono text-foreground font-semibold">
                    jeanniyonkuru29@gmail.com
                  </code>
                  ) will be validated immediately.
                </p>

                {/* Collapsible Key Fallback */}
                <div className="pt-4 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setShowKeyFallback(!showKeyFallback)}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <span>Developer Emergency Passcode</span>
                    <ChevronDown
                      className={`size-3 transition-transform ${showKeyFallback ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showKeyFallback && (
                    <form onSubmit={handleManualKeyLogin} className="space-y-2 mt-3 text-left">
                      <Input
                        type="password"
                        placeholder="Enter admin passcode"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        className="text-xs h-9 font-mono"
                      />
                      <Button
                        type="submit"
                        disabled={loading || !adminKey.trim()}
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs font-semibold"
                      >
                        Verify Key
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Authenticated Dashboard View */
            <div className="space-y-6">
              {/* KPI Cards: 6 High-Impact Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Orders */}
                <div
                  onClick={() => setActiveTab("orders")}
                  className={`rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all ${
                    activeTab === "orders"
                      ? "bg-primary/10 border-primary"
                      : "bg-card border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold text-primary">
                      Stands &amp; Stickers
                    </span>
                    <Package className="size-3.5 text-primary" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">
                      {stats?.total_orders ?? orders.length}
                    </span>
                    {(stats?.pending_orders ??
                      orders.filter((o) => o.status === "pending").length) > 0 && (
                      <Badge variant="default" className="text-[9px] px-1 py-0 bg-primary">
                        {stats?.pending_orders ??
                          orders.filter((o) => o.status === "pending").length}{" "}
                        new
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Physical merchandise
                  </div>
                </div>

                {/* 2. Generated QRs */}
                <div
                  onClick={() => setActiveTab("qrs")}
                  className={`rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all ${
                    activeTab === "qrs"
                      ? "bg-amber-500/10 border-amber-500"
                      : "bg-card border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold text-amber-600">Generated QRs</span>
                    <QrCode className="size-3.5 text-amber-500" />
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {stats?.total_qr_codes ?? qrCodes.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Single-generation cards
                  </div>
                </div>

                {/* 3. Merchants */}
                <div
                  onClick={() => setActiveTab("merchants")}
                  className={`rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all ${
                    activeTab === "merchants"
                      ? "bg-blue-500/10 border-blue-500"
                      : "bg-card border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold text-blue-600">Merchants</span>
                    <Users className="size-3.5 text-blue-500" />
                  </div>
                  <div className="text-xl font-black text-foreground">
                    {stats?.total_merchants ?? merchants.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Registered businesses
                  </div>
                </div>

                {/* 4. System Admins */}
                <div
                  onClick={() => setActiveTab("admins")}
                  className={`rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all ${
                    activeTab === "admins"
                      ? "bg-rose-500/10 border-rose-500"
                      : "bg-card border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold text-rose-600">Admins</span>
                    <Lock className="size-3.5 text-rose-500" />
                  </div>
                  <div className="text-xl font-black text-foreground">{systemAdmins.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Privileged roles
                  </div>
                </div>

                {/* 5. Support Inquiries */}
                <div
                  onClick={() => setActiveTab("inquiries")}
                  className={`rounded-xl border p-3.5 shadow-xs cursor-pointer transition-all ${
                    activeTab === "inquiries"
                      ? "bg-indigo-500/10 border-indigo-500"
                      : "bg-card border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold text-indigo-600">Support</span>
                    <MessageSquare className="size-3.5 text-indigo-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">
                      {stats?.total_inquiries ?? inquiries.length}
                    </span>
                    {(stats?.new_inquiries ?? inquiries.filter((i) => i.status === "new").length) >
                      0 && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                        {stats?.new_inquiries ?? inquiries.filter((i) => i.status === "new").length}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Vendor tickets &amp; lost QRs
                  </div>
                </div>

                {/* 6. Database Engine */}
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[11px] font-semibold">Engine</span>
                    <Database className="size-3.5 text-purple-500" />
                  </div>
                  <div className="text-xs font-bold text-foreground truncate mt-1">
                    {stats?.database_type || "Cloudflare D1"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Resilient SQL</span>
                  </div>
                </div>
              </div>

              {/* Admin Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-8 w-full h-auto p-1 gap-1">
                  <TabsTrigger value="orders" className="text-xs py-2">
                    Orders ({orders.length})
                  </TabsTrigger>
                  <TabsTrigger value="qrs" className="text-xs py-2">
                    Generated QRs ({qrCodes.length})
                  </TabsTrigger>
                  <TabsTrigger value="merchants" className="text-xs py-2">
                    Merchants ({merchants.length})
                  </TabsTrigger>
                  <TabsTrigger value="admins" className="text-xs py-2">
                    Admins ({systemAdmins.length})
                  </TabsTrigger>
                  <TabsTrigger value="inquiries" className="text-xs py-2">
                    Support ({inquiries.length})
                  </TabsTrigger>
                  <TabsTrigger value="downloads" className="text-xs py-2">
                    Downloads ({downloads.length})
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="text-xs py-2">
                    SMS Gateway
                  </TabsTrigger>
                  <TabsTrigger value="export" className="text-xs py-2">
                    CSV Export
                  </TabsTrigger>
                </TabsList>

                {/* 1. ORDERS TAB */}
                <TabsContent value="orders" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Physical Stands &amp; Waterproof Stickers Orders
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Customer orders placed for acrylic stands and vinyl sticker bundles.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {orders.filter((o) => o.status === "pending").length} pending delivery
                    </span>
                  </div>

                  {orders.length === 0 ? (
                    <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                      No physical orders received yet. Users can order stands and stickers directly
                      from the store.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((ord) => (
                        <div
                          key={ord.id}
                          className={`rounded-xl border p-4 text-xs transition-colors ${
                            ord.status === "pending"
                              ? "bg-primary/5 border-primary/30"
                              : ord.status === "processing"
                                ? "bg-amber-500/5 border-amber-500/30"
                                : ord.status === "delivered"
                                  ? "bg-emerald-500/5 border-emerald-500/25 opacity-90"
                                  : "bg-card border-border/60 opacity-60"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-sm text-foreground bg-muted px-2 py-0.5 rounded">
                                  {ord.order_number}
                                </span>
                                <span className="font-bold text-sm text-foreground">
                                  {ord.customer_name}
                                </span>
                                <Badge
                                  variant={
                                    ord.status === "pending"
                                      ? "default"
                                      : ord.status === "delivered"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-[10px] font-semibold uppercase"
                                >
                                  {ord.status}
                                </Badge>
                                <span className="text-xs font-black text-primary ml-auto sm:ml-0">
                                  {ord.total_price.toLocaleString()} RWF
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <Phone className="size-3 text-primary" />
                                  {ord.customer_phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3 text-muted-foreground" />
                                  Location: <strong>{ord.delivery_location}</strong>
                                </span>
                                <span>
                                  Item:{" "}
                                  <strong>
                                    {ord.quantity}x {ord.item_type.replace(/_/g, " ")}
                                  </strong>
                                </span>
                                <span>Shop: {ord.business_name}</span>
                                <span>Date: {new Date(ord.created_at).toLocaleString()}</span>
                              </div>

                              {ord.notes && (
                                <p className="mt-2 text-[11px] bg-muted/60 p-2 rounded-lg text-foreground italic">
                                  "{ord.notes}"
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                              <a
                                href={`https://wa.me/${ord.customer_phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                              >
                                <span>WhatsApp</span>
                                <ExternalLink className="size-2.5" />
                              </a>

                              <div className="flex items-center gap-1">
                                {ord.status !== "delivered" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateOrderStatus(ord.id, "delivered")}
                                    className="h-7 text-[11px] gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                  >
                                    <CheckCircle2 className="size-3" />
                                    <span>Mark Delivered</span>
                                  </Button>
                                )}
                                {ord.status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateOrderStatus(ord.id, "processing")}
                                    className="h-7 text-[11px] gap-1"
                                  >
                                    <Truck className="size-3" />
                                    <span>Processing</span>
                                  </Button>
                                )}
                                {ord.status === "delivered" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateOrderStatus(ord.id, "pending")}
                                    className="h-7 text-[10px] text-muted-foreground"
                                  >
                                    Revert to Pending
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* 2. GENERATED QRS TAB (Single Generation Registry) */}
                <TabsContent value="qrs" className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <QrCode className="size-4 text-amber-500" />
                        <span>Registered Payment QR Registry (Single Generation Rule)</span>
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Each QR is registered once to protect merchant identity and prevent
                        paper/plastic waste. Admins can view, reprint, or unlock codes if lost.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search business, code, or phone..."
                        value={searchQr}
                        onChange={(e) => setSearchQr(e.target.value)}
                        className="h-8 text-xs pl-8"
                      />
                    </div>
                  </div>

                  {unlockSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>{unlockSuccessMsg}</span>
                    </div>
                  )}

                  {filteredQrs.length === 0 ? (
                    <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                      {searchQr
                        ? "No payment QRs match your search filter."
                        : "No payment QRs generated yet."}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase">
                            <tr>
                              <th className="py-2.5 px-4">Business Name</th>
                              <th className="py-2.5 px-4">Network</th>
                              <th className="py-2.5 px-4">Dial Code</th>
                              <th className="py-2.5 px-4">Type</th>
                              <th className="py-2.5 px-4">Owner / Phone</th>
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4 text-right">Admin Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {filteredQrs.map((qr) => (
                              <tr key={qr.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-bold text-foreground">
                                  {qr.business_name || qr.description || "QR Card"}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      qr.network?.includes("MTN")
                                        ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                                        : qr.network?.includes("Airtel")
                                          ? "border-red-500/30 text-red-600 bg-red-500/10"
                                          : "border-purple-500/30 text-purple-600 bg-purple-500/10"
                                    }`}
                                  >
                                    {qr.network || "Mobile Money"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-primary">
                                  {qr.dial_code || "*182#"}
                                </td>
                                <td className="py-3 px-4 text-[11px] text-muted-foreground uppercase">
                                  {qr.payment_type?.replace(/_/g, " ") || "Merchant"}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground font-mono">
                                  {qr.phone_number || qr.owner_id || "Unassigned"}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-[11px]">
                                  {new Date(qr.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedQrForPrint(qr)}
                                      className="h-7 text-[11px] gap-1"
                                    >
                                      <Printer className="size-3 text-primary" />
                                      <span>Print Card</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={unlockingQrId === qr.id}
                                      onClick={() => handleUnlockQr(qr.id)}
                                      className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                                      title="Unlock so merchant can regenerate"
                                    >
                                      {unlockingQrId === qr.id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="size-3" />
                                      )}
                                      <span className="hidden sm:inline ml-1">Unlock / Reset</span>
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 3. MERCHANTS DIRECTORY TAB */}
                <TabsContent value="merchants" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Registered Merchants Directory
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Phone-verified accounts and active merchants stored in the database.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {merchants.length} total merchants
                    </span>
                  </div>

                  {merchants.length === 0 ? (
                    <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                      No merchants registered yet.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase">
                            <tr>
                              <th className="py-2.5 px-4">Identifier / Phone</th>
                              <th className="py-2.5 px-4">Business / Email</th>
                              <th className="py-2.5 px-4">Registration</th>
                              <th className="py-2.5 px-4">QR Count</th>
                              <th className="py-2.5 px-4">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {merchants.map((m) => (
                              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-foreground">
                                  {m.phone_number}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {m.email || m.business_name || "—"}
                                </td>
                                <td className="py-3 px-4">
                                  {m.is_fully_registered ? (
                                    <Badge variant="default" className="text-[10px] bg-emerald-600">
                                      Full Profile
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">
                                      OTP Verified
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-bold text-foreground">
                                  {m.qr_count ?? 0}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-[11px]">
                                  {new Date(m.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 4. SYSTEM ADMINISTRATORS TAB (RBAC in Database) */}
                <TabsContent value="admins" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="size-4 text-rose-500" />
                        <span>System Administrators (Database-Backed RBAC)</span>
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Users stored in the <code className="font-mono">system_admins</code> table
                        have access to the administrative dashboard, can override single-generation
                        restrictions, and manage merchants.
                      </p>
                    </div>
                  </div>

                  {adminSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>{adminSuccessMsg}</span>
                    </div>
                  )}

                  {adminErrorMsg && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{adminErrorMsg}</span>
                    </div>
                  )}

                  {/* Add Admin Form */}
                  <form
                    onSubmit={handleAddAdmin}
                    className="p-4 rounded-xl border border-border/70 bg-card/60 flex flex-col sm:flex-row gap-3 items-end"
                  >
                    <div className="space-y-1 flex-1 w-full">
                      <label className="text-[11px] font-semibold text-foreground">
                        Administrator Email (Google or Work Account)
                      </label>
                      <Input
                        type="email"
                        placeholder="e.g. admin@company.rw"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1 w-full sm:w-48">
                      <label className="text-[11px] font-semibold text-foreground">
                        Admin Name / Department
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Operations Lead"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={addingAdmin || !newAdminEmail.trim()}
                      className="h-9 text-xs font-bold gap-1.5 w-full sm:w-auto"
                    >
                      {addingAdmin ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      <span>Add Administrator</span>
                    </Button>
                  </form>

                  {/* Administrators List */}
                  <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="py-2.5 px-4">Administrator</th>
                          <th className="py-2.5 px-4">Role</th>
                          <th className="py-2.5 px-4">Phone / Contact</th>
                          <th className="py-2.5 px-4">Created Date</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {systemAdmins.map((adm) => (
                          <tr key={adm.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <User className="size-3.5 text-primary" />
                                <span>{adm.name || adm.email}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {adm.email}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {adm.email === "jeanniyonkuru29@gmail.com" ? (
                                <Badge className="text-[10px] bg-primary font-bold">
                                  Superadmin / Owner
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Administrator
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground font-mono">
                              {adm.phone_number || "—"}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-[11px]">
                              {new Date(adm.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {adm.email !== "jeanniyonkuru29@gmail.com" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAdmin(adm.id, adm.email)}
                                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="size-3 mr-1" />
                                  <span>Revoke</span>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* 5. SUPPORT INQUIRIES TAB */}
                <TabsContent value="inquiries" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Customer &amp; Merchant Support Inquiries
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Help requests, lost QR re-issue tickets, and feedback submissions.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {inquiries.filter((i) => i.status === "new").length} unhandled inquiries
                    </span>
                  </div>

                  {inquiries.length === 0 ? (
                    <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                      No support inquiries logged yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {inquiries.map((inq) => (
                        <div
                          key={inq.id}
                          className={`rounded-xl border p-4 text-xs transition-colors ${
                            inq.status === "new"
                              ? "bg-primary/5 border-primary/30"
                              : "bg-card border-border/60 opacity-75"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">{inq.name}</span>
                              <Badge
                                variant={inq.status === "new" ? "default" : "secondary"}
                                className="text-[10px] font-semibold"
                              >
                                {inq.status.toUpperCase()}
                              </Badge>
                              {inq.category && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase font-mono"
                                >
                                  {inq.category.replace(/_/g, " ")}
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(inq.created_at).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {inq.phone && (
                                <a
                                  href={`https://wa.me/${inq.phone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                                >
                                  <span>WhatsApp</span>
                                  <ExternalLink className="size-2.5" />
                                </a>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleInquiryStatus(inq.id, inq.status)}
                                className="h-7 text-[11px] gap-1"
                              >
                                <CheckCircle2 className="size-3" />
                                <span>
                                  {inq.status === "new" ? "Mark Resolved" : "Reopen Ticket"}
                                </span>
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                            {inq.email && <span>Email: {inq.email}</span>}
                            {inq.phone && <span>Phone: {inq.phone}</span>}
                            {inq.subject && (
                              <span>
                                Subject: <strong>{inq.subject}</strong>
                              </span>
                            )}
                          </div>

                          <p className="mt-2.5 text-[11px] bg-muted/60 p-2.5 rounded-lg text-foreground leading-relaxed whitespace-pre-wrap">
                            {inq.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* 6. DOWNLOADS AUDIT LOG TAB */}
                <TabsContent value="downloads" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Timestamped Card Download Events
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Every high-resolution PNG or PDF downloaded leaves an audit timestamp in the
                        database.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {downloads.length} events logged
                    </span>
                  </div>

                  {downloads.length === 0 ? (
                    <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                      No download timestamps logged yet.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase">
                            <tr>
                              <th className="py-2.5 px-4">Business / Shop</th>
                              <th className="py-2.5 px-4">Network</th>
                              <th className="py-2.5 px-4">Dial Code</th>
                              <th className="py-2.5 px-4">Format</th>
                              <th className="py-2.5 px-4">Phone / User</th>
                              <th className="py-2.5 px-4">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {downloads.map((d) => (
                              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-bold text-foreground">
                                  {d.business_name}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="outline" className="text-[10px]">
                                    {d.network}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-primary">
                                  {d.dial_code}
                                </td>
                                <td className="py-3 px-4 uppercase font-mono text-[10px]">
                                  {d.file_format}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground font-mono">
                                  {d.phone_number || "Anonymous"}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-[11px]">
                                  {new Date(d.downloaded_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 7. SMS GATEWAY & TWILIO TAB */}
                <TabsContent value="sms" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Twilio SMS Gateway Configuration &amp; Live Tester
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Configure production Twilio credentials for Rwanda SMS dispatch.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        twilioSettings?.hasAccountSid && twilioSettings?.hasAuthToken
                          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {twilioSettings?.hasAccountSid && twilioSettings?.hasAuthToken
                        ? "Twilio Ready"
                        : "Twilio Inactive / Demo Mode"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Twilio Messages API */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Twilio Programmable SMS
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            twilioSettings?.phoneNumber
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {twilioSettings?.phoneNumber ? "Sender Active" : "No Sender Number"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sends customized brand text messages with 6-digit OTP codes directly to
                        physical phones.
                      </p>
                      <div className="text-[10px] font-mono bg-muted/60 p-2.5 rounded text-muted-foreground space-y-1">
                        <div>
                          <strong className="text-foreground">TWILIO_ACCOUNT_SID:</strong>{" "}
                          {twilioSettings?.accountSidMasked ||
                            (twilioSettings?.hasAccountSid ? "Configured" : "Not configured")}
                        </div>
                        <div>
                          <strong className="text-foreground">TWILIO_AUTH_TOKEN:</strong>{" "}
                          {twilioSettings?.hasAuthToken ? "Configured" : "Not configured"}
                        </div>
                        <div>
                          <strong className="text-foreground">TWILIO_PHONE_NUMBER:</strong>{" "}
                          {twilioSettings?.phoneNumber || "Not configured"}
                        </div>
                      </div>
                    </div>

                    {/* Twilio Verify Service */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Twilio Verify Service
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            twilioSettings?.verifyServiceSid
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {twilioSettings?.verifyServiceSid ? "Service Active" : "Optional"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Uses Twilio managed OTP templates with carrier deliverability routing.
                      </p>
                      <div className="text-[10px] font-mono bg-muted/60 p-2.5 rounded text-muted-foreground space-y-1">
                        <div>
                          <strong className="text-foreground">TWILIO_VERIFY_SERVICE_SID:</strong>{" "}
                          {twilioSettings?.verifyServiceSid || "Not configured"}
                        </div>
                        <div>
                          <strong className="text-foreground">Status:</strong>{" "}
                          {twilioSettings?.verifyServiceSid ? "Ready" : "Not Set"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live SMS Dispatch Tester */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Smartphone className="size-4 text-primary" />
                        Live SMS Dispatch Tester
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        Test real SMS delivery to your phone
                      </span>
                    </div>
                    <form onSubmit={handleRunTestSms} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="tel"
                        placeholder="e.g. 0788 123 456 or +250..."
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="h-9 text-xs font-mono bg-background flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={testSmsLoading || !testPhone.trim()}
                        className="h-9 text-xs font-semibold px-4 shrink-0"
                      >
                        {testSmsLoading ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Smartphone className="size-3.5 mr-1.5" />
                        )}
                        Send Real SMS Now
                      </Button>
                    </form>

                    {testSmsResult && (
                      <div
                        className={`p-3 rounded-lg text-xs space-y-1.5 border ${
                          testSmsResult.success
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          {testSmsResult.success ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <AlertCircle className="size-4 text-amber-600" />
                          )}
                          <span>
                            {testSmsResult.success
                              ? "SMS Dispatch Initiated"
                              : "SMS Dispatch Returned Notice"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed">{testSmsResult.detail}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* 8. CSV EXPORTS TAB */}
                <TabsContent value="export" className="mt-4 space-y-3">
                  <div>
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Database Records Export (CSV)
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Download full data dumps for accounting, inventory, and operations.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <a
                      href={IshyuraClient.getAdminExportUrl(adminKey, "orders")}
                      download="physical_orders.csv"
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                    >
                      <FileDown className="size-5 text-primary" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Export Orders</p>
                        <p className="text-[10px] text-muted-foreground">
                          Physical stands &amp; stickers
                        </p>
                      </div>
                    </a>

                    <a
                      href={IshyuraClient.getAdminExportUrl(adminKey, "downloads")}
                      download="downloads_log.csv"
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                    >
                      <FileDown className="size-5 text-blue-500" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Export Downloads</p>
                        <p className="text-[10px] text-muted-foreground">Timestamped PNG/PDF log</p>
                      </div>
                    </a>

                    <a
                      href={IshyuraClient.getAdminExportUrl(adminKey, "merchants")}
                      download="merchants_report.csv"
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                    >
                      <Download className="size-5 text-emerald-500" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Export Merchants</p>
                        <p className="text-[10px] text-muted-foreground">
                          Phone numbers &amp; registration
                        </p>
                      </div>
                    </a>

                    <a
                      href={IshyuraClient.getAdminExportUrl(adminKey, "inquiries")}
                      download="inquiries_report.csv"
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                    >
                      <Download className="size-5 text-amber-500" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Export Inquiries</p>
                        <p className="text-[10px] text-muted-foreground">
                          Support messages &amp; feedback
                        </p>
                      </div>
                    </a>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>

      {/* Admin QR Card Preview & Re-Print Dialog */}
      <Dialog
        open={Boolean(selectedQrForPrint)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrForPrint(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-4 text-primary" />
              <span>Merchant Tent Card Preview &amp; Print</span>
            </DialogTitle>
            <DialogDescription>
              High-resolution printable card for {selectedQrForPrint?.business_name}. Admins can
              re-print this card for merchants who lost their original copy.
            </DialogDescription>
          </DialogHeader>

          {selectedQrForPrint && (
            <div className="space-y-4 pt-2">
              {/* Printable Card Area */}
              <div
                ref={printCardRef}
                className="rounded-2xl border-2 border-foreground/15 bg-white p-6 text-slate-900 shadow-md flex flex-col items-center text-center space-y-3"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Ishyura Verified
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-950 uppercase tracking-tight">
                    {selectedQrForPrint.business_name || "Merchant Counter"}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-600 mt-0.5">
                    {selectedQrForPrint.network} Pay Here
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <QRCodeSVG
                    value={`tel:${encodeURIComponent(selectedQrForPrint.dial_code || "*182#")}`}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="w-full bg-slate-100 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    Or Dial USSD Code
                  </div>
                  <div className="font-mono font-black text-sm text-slate-900 mt-0.5">
                    {selectedQrForPrint.dial_code}
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 font-medium">
                  Scan with camera to dial · No manual typing required
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedQrForPrint(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadMerchantPrint}
                  disabled={downloadingPrint}
                  className="text-xs font-bold gap-1.5"
                >
                  {downloadingPrint ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>Download High-Res Print PNG</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
