import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  Database,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Key,
  Package,
  Truck,
  FileDown,
  Phone,
  MapPin,
  Smartphone,
  Radio,
} from "lucide-react";
import {
  IshyuraClient,
  type AdminStats,
  type MerchantRecord,
  type InquiryRecord,
  type OrderRecord,
  type DownloadEventRecord,
  type OrderStatus,
} from "@/lib/ishyura-client";

export const Route = createFileRoute("/admin")({
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
  const [adminKey, setAdminKey] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadEventRecord[]>([]);

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

  // Load saved key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
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

      const [merchantsList, inquiriesList, ordersList, downloadsList, settingsData] =
        await Promise.all([
          IshyuraClient.getAdminMerchants(keyToUse).catch(() => []),
          IshyuraClient.getAdminInquiries(keyToUse).catch(() => []),
          IshyuraClient.getAdminOrders(keyToUse).catch(() => []),
          IshyuraClient.getAdminDownloads(keyToUse).catch(() => []),
          IshyuraClient.getAdminSettings(keyToUse).catch(() => null),
        ]);
      setMerchants(merchantsList);
      setInquiries(inquiriesList);
      setOrders(ordersList);
      setDownloads(downloadsList);
      if (settingsData?.twilio) {
        setTwilioSettings(settingsData.twilio);
        setEditPhone(settingsData.twilio.phoneNumber || "");
        setEditVerifySid(settingsData.twilio.verifyServiceSid || "");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(`${msg} (Passcode: ishyura2026)`);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
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
      setSettingsSavedMsg("Twilio settings successfully saved to D1 database.");
      // Refresh settings
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setAuthError("Please enter your admin passcode.");
      return;
    }
    verifyAndFetch(adminKey.trim());
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setIsAuthenticated(false);
    setAdminKey("");
    setStats(null);
    setMerchants([]);
    setInquiries([]);
    setOrders([]);
    setDownloads([]);
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
      console.error("Failed to toggle inquiry status:", err);
    }
  };

  const handleUpdateOrderStatus = async (id: string, newStatus: OrderStatus) => {
    try {
      await IshyuraClient.updateOrderStatus(adminKey, id, newStatus);
      setOrders((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)),
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mr-2 px-2 py-1 rounded-md hover:bg-muted/50"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Ishyura</span>
            </Link>
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="size-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  Ishyura Portal
                </span>
                <span className="bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                  /admin
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Secure Owner Management &amp; Physical Orders Engine
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
                <span className="hidden sm:inline">Refresh</span>
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
          /* Authentication Screen */
          <div className="py-16 max-w-sm mx-auto text-center space-y-5">
            <div className="size-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-xs">
              <Lock className="size-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Owner Portal Authentication</h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                This is a restricted administrative dashboard. Enter your passcode to view orders,
                merchants, downloads, and inquiries.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3 pt-2 text-left">
              {authError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Input
                  type="password"
                  placeholder="Enter admin passcode"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="text-sm h-10"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Default passcode:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">
                    ishyura2026
                  </code>
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
                <span>Unlock Portal</span>
              </Button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="space-y-6">
            {/* KPI Cards: 6 High-Impact Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Orders */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs">
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
                  {(stats?.pending_orders ?? orders.filter((o) => o.status === "pending").length) >
                    0 && (
                    <Badge variant="default" className="text-[9px] px-1 py-0 bg-primary">
                      {stats?.pending_orders ?? orders.filter((o) => o.status === "pending").length}{" "}
                      new
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  Physical merchandise
                </div>
              </div>

              {/* 2. Download Timestamped Events */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-semibold">Downloads Logged</span>
                  <FileDown className="size-3.5 text-blue-500" />
                </div>
                <div className="text-xl font-black text-foreground">
                  {stats?.total_downloads ?? downloads.length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Timestamped in DB</div>
              </div>

              {/* 3. Merchants */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-semibold">Merchants</span>
                  <Users className="size-3.5 text-emerald-500" />
                </div>
                <div className="text-xl font-black text-foreground">
                  {stats?.total_merchants ?? merchants.length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Phone registered</div>
              </div>

              {/* 4. QR Cards */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-semibold">QR Generated</span>
                  <QrCode className="size-3.5 text-teal-500" />
                </div>
                <div className="text-xl font-black text-foreground">
                  {stats?.total_qr_codes ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Across 3 networks</div>
              </div>

              {/* 5. Inquiries */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-[11px] font-semibold">Inquiries</span>
                  <MessageSquare className="size-3.5 text-amber-500" />
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
                <div className="text-[10px] text-muted-foreground mt-0.5">Vendor support</div>
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
            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-7 w-full h-auto p-1 gap-1">
                <TabsTrigger value="orders" className="text-xs py-2">
                  Orders ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="downloads" className="text-xs py-2">
                  Downloads ({downloads.length})
                </TabsTrigger>
                <TabsTrigger value="inquiries" className="text-xs py-2">
                  Inquiries ({inquiries.length})
                </TabsTrigger>
                <TabsTrigger value="merchants" className="text-xs py-2">
                  Merchants ({merchants.length})
                </TabsTrigger>
                <TabsTrigger value="networks" className="text-xs py-2">
                  Networks
                </TabsTrigger>
                <TabsTrigger value="sms" className="text-xs py-2">
                  SMS Gateway
                </TabsTrigger>
                <TabsTrigger value="export" className="text-xs py-2">
                  CSV Export
                </TabsTrigger>
              </TabsList>

              {/* ORDERS TAB */}
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
                    from the generator page.
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

              {/* DOWNLOADS LOG TAB */}
              <TabsContent value="downloads" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Timestamped Card Download Events
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Every high-resolution PNG or PDF downloaded leaves an audit timestamp in D1.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {downloads.length} events logged
                  </span>
                </div>

                {downloads.length === 0 ? (
                  <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                    No download timestamps logged yet. When merchants download their cards, they are
                    stored automatically here.
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
                            <th className="py-2.5 px-4">User Phone</th>
                            <th className="py-2.5 px-4">Timestamp (UTC)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {downloads.map((dl) => (
                            <tr key={dl.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-4 font-semibold text-foreground">
                                {dl.business_name}
                              </td>
                              <td className="py-2.5 px-4">
                                <Badge variant="outline" className="text-[10px]">
                                  {dl.network}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                                {dl.dial_code}
                              </td>
                              <td className="py-2.5 px-4 uppercase font-bold text-[10px] text-primary">
                                {dl.file_format}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground">
                                {dl.phone_number || "guest"}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                                {new Date(dl.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* INQUIRIES TAB */}
              <TabsContent value="inquiries" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Customer Inquiries &amp; Vendor Support
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {inquiries.filter((i) => i.status === "new").length} pending response
                  </span>
                </div>

                {inquiries.length === 0 ? (
                  <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                    No inquiries received yet. Users can submit questions via the Contact button.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inquiries.map((inq) => (
                      <div
                        key={inq.id}
                        className={`rounded-xl border p-4 text-xs transition-colors ${
                          inq.status === "new"
                            ? "bg-amber-500/5 border-amber-500/30 dark:border-amber-500/20"
                            : "bg-card border-border/60 opacity-80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {inq.sender_name}
                              </span>
                              <Badge
                                variant={inq.status === "new" ? "default" : "secondary"}
                                className="text-[10px] font-semibold"
                              >
                                {inq.status === "new" ? "New" : "Resolved"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                Phone: {inq.sender_phone}
                              </span>
                              {inq.sender_email && <span>Email: {inq.sender_email}</span>}
                              <span>{new Date(inq.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`https://wa.me/${inq.sender_phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                            >
                              <span>WhatsApp</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleInquiryStatus(inq.id, inq.status)}
                              className="h-7 text-[11px]"
                            >
                              {inq.status === "new" ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="size-3 text-emerald-500" />
                                  Resolve
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  Reopen
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-border/40">
                          <p className="font-semibold text-foreground mb-0.5">{inq.subject}</p>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {inq.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* MERCHANTS TAB */}
              <TabsContent value="merchants" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Soft-Registered &amp; Fully Registered Merchant Directory
                  </h2>
                  <span className="text-xs text-muted-foreground">{merchants.length} vendors</span>
                </div>

                <div className="rounded-xl border border-border/70 overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="py-3 px-4">Phone Number</th>
                          <th className="py-3 px-4">Tier</th>
                          <th className="py-3 px-4">Cards Generated</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">First Joined</th>
                          <th className="py-3 px-4">Last Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {merchants.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                              No merchants registered yet.
                            </td>
                          </tr>
                        ) : (
                          merchants.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-foreground">
                                {m.phone_number}
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={m.is_fully_registered ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {m.is_fully_registered ? "Full Account" : "Phone Soft-Auth"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 font-bold text-foreground">
                                {m.qr_count ?? 0}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {m.email || <span className="opacity-40">—</span>}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {new Date(m.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {new Date(m.last_active_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* NETWORKS BREAKDOWN TAB */}
              <TabsContent value="networks" className="mt-4 space-y-4">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Payment Network Distribution in Rwanda
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-1">
                    <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
                      MTN Mobile Money
                    </span>
                    <div className="text-2xl font-black text-foreground">
                      {stats?.network_breakdown?.["MTN Mobile Money"] ?? 0}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      MoMo Pay code dialers (*182*8*1*CODE#)
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-1">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      Airtel Money
                    </span>
                    <div className="text-2xl font-black text-foreground">
                      {stats?.network_breakdown?.["Airtel Money"] ?? 0}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Airtel Money merchant &amp; P2P transfers
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-600/30 bg-amber-600/5 p-4 space-y-1">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Equity Bank (eKash)
                    </span>
                    <div className="text-2xl font-black text-foreground">
                      {stats?.network_breakdown?.["Equity Bank (eKash)"] ?? 0}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Inter-bank eKash push (*555# flat 20 RWF)
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* SMS GATEWAY TAB */}
              <TabsContent value="sms" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="size-4 text-primary" />
                      Twilio SMS Gateway &amp; Diagnostics
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Direct OTP transmission to physical mobile phones in Rwanda (+250) and
                      globally via Twilio.
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
                      Ideal for Free/Trial accounts. Uses Twilio managed OTP templates with carrier
                      deliverability routing.
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

                {/* Interactive Live SMS Dispatch Tester */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Smartphone className="size-4 text-primary" />
                      Live SMS Dispatch Tester
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Test real SMS delivery to your physical phone
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
                      {testSmsResult.isTrialNotice && (
                        <div className="p-2 rounded bg-background/80 text-[10px] text-foreground font-mono">
                          Twilio Trial Notice: Free/Trial accounts require Rwandan numbers to be in
                          Twilio Console &gt; Phone Numbers &gt; Verified Caller IDs.
                        </div>
                      )}
                      {testSmsResult.messageId && (
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Message SID: {testSmsResult.messageId} | Test Code Generated:{" "}
                          <strong>{testSmsResult.test_code}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cloudflare Setup & Testing Checklist */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 text-xs">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-blue-500" />
                    Twilio Free / Trial Account Checklist for Rwanda
                  </h4>
                  <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                    <p>
                      <strong>Why Free Twilio Accounts Require Number Verification:</strong> Twilio
                      Trial accounts prevent sending SMS to numbers that are not verified in your
                      Twilio Console.
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                      <li>
                        <strong>Step 1:</strong> Go to{" "}
                        <a
                          href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          Twilio Console &gt; Phone Numbers &gt; Verified Caller IDs
                        </a>{" "}
                        and add your physical phone number (+250...).
                      </li>
                      <li>
                        <strong>Step 2:</strong> Under{" "}
                        <a
                          href="https://console.twilio.com/us1/develop/sms/settings/geo-permissions"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          Messaging &gt; Settings &gt; Geo-Permissions
                        </a>
                        , ensure Rwanda (+250) is enabled.
                      </li>
                      <li>
                        <strong>Step 3:</strong> If using Twilio Verify, ensure your Verify Service
                        SID (VA...) is configured.
                      </li>
                      <li>
                        <strong>Instant Demo Code:</strong> Code{" "}
                        <code className="bg-background px-1 py-0.5 rounded font-mono font-bold text-primary">
                          123456
                        </code>{" "}
                        can always be entered in the sign-in modal for instant login without carrier
                        latency.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Configure / Update Twilio Settings in D1 */}
                <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Key className="size-4 text-primary" />
                      Configure Twilio Credentials (Saved to Database)
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      Overrides or supplements environment variables
                    </span>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          TWILIO_ACCOUNT_SID (AC...)
                        </label>
                        <Input
                          type="text"
                          placeholder={twilioSettings?.accountSidMasked || "ACxxxxxxxxxxxxxxxx"}
                          value={editAccountSid}
                          onChange={(e) => setEditAccountSid(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          TWILIO_AUTH_TOKEN
                        </label>
                        <Input
                          type="password"
                          placeholder={
                            twilioSettings?.hasAuthToken ? "••••••••••••••••" : "Auth Token"
                          }
                          value={editAuthToken}
                          onChange={(e) => setEditAuthToken(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          TWILIO_PHONE_NUMBER (e.g. +12293744607)
                        </label>
                        <Input
                          type="text"
                          placeholder="+12293744607"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          TWILIO_VERIFY_SERVICE_SID (VA...)
                        </label>
                        <Input
                          type="text"
                          placeholder="VAxxxxxxxxxxxxxxxx"
                          value={editVerifySid}
                          onChange={(e) => setEditVerifySid(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {settingsSavedMsg ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          {settingsSavedMsg}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          Changes take effect immediately across all client sign-in requests.
                        </span>
                      )}
                      <Button
                        type="submit"
                        disabled={savingSettings}
                        size="sm"
                        className="h-8 text-xs font-semibold px-4"
                      >
                        {savingSettings ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : null}
                        Save Settings
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              {/* CSV EXPORT TAB */}
              <TabsContent value="export" className="mt-4 space-y-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Data Exports for Administration &amp; Accounting
                </h2>
                <p className="text-xs text-muted-foreground">
                  Export complete data records formatted for Microsoft Excel, Google Sheets, or
                  accounting.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <a
                    href={IshyuraClient.getAdminExportUrl(adminKey, "orders")}
                    download="orders_report.csv"
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                  >
                    <Package className="size-5 text-primary" />
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
  );
}
