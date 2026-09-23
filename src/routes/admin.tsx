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

      const [merchantsList, inquiriesList, ordersList, downloadsList] = await Promise.all([
        IshyuraClient.getAdminMerchants(keyToUse).catch(() => []),
        IshyuraClient.getAdminInquiries(keyToUse).catch(() => []),
        IshyuraClient.getAdminOrders(keyToUse).catch(() => []),
        IshyuraClient.getAdminDownloads(keyToUse).catch(() => []),
      ]);
      setMerchants(merchantsList);
      setInquiries(inquiriesList);
      setOrders(ordersList);
      setDownloads(downloadsList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(`${msg} (Passcode: ishyura2026)`);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
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
                      Twilio SMS Dispatch
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Direct OTP transmission to physical mobile phones in Rwanda (+250) and
                      globally via Twilio.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  >
                    Twilio Connected
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Twilio Messages API */}
                  <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Twilio Programmable SMS
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                        Active Provider
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sends customized brand text messages with 6-digit OTP codes directly to
                      physical phones.
                    </p>
                    <div className="text-[10px] font-mono bg-muted/60 p-2.5 rounded text-muted-foreground space-y-1">
                      <div>
                        <strong className="text-foreground">TWILIO_ACCOUNT_SID:</strong> Configured
                      </div>
                      <div>
                        <strong className="text-foreground">TWILIO_AUTH_TOKEN:</strong> Configured
                      </div>
                      <div>
                        <strong className="text-foreground">TWILIO_PHONE_NUMBER:</strong>{" "}
                        +12293744607
                      </div>
                    </div>
                  </div>

                  {/* Twilio Verify Service */}
                  <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Twilio Verify Service
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                        Service Active
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Fallback verification routing with carrier lookup and deliverability
                      safeguards.
                    </p>
                    <div className="text-[10px] font-mono bg-muted/60 p-2.5 rounded text-muted-foreground space-y-1">
                      <div>
                        <strong className="text-foreground">TWILIO_VERIFY_SERVICE_SID:</strong>{" "}
                        Configured
                      </div>
                      <div>
                        <strong className="text-foreground">Status:</strong> Ready
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Automatic E.164 Number Normalization
                  </h4>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Merchants can type local Rwandan numbers (e.g. <code>0788 123 456</code> or{" "}
                    <code>782693724</code>). The backend automatically normalizes them to E.164
                    standard (<code>+250788123456</code>) before sending to Twilio.
                  </p>
                </div>

                {/* Cloudflare Setup & Testing Checklist */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 text-xs">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-blue-500" />
                    Cloudflare Pages &amp; Physical Device Checklist
                  </h4>
                  <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                    <p>
                      <strong>1. Set Cloudflare Environment Variables:</strong> In your Cloudflare
                      Dashboard, go to{" "}
                      <em>
                        Workers &amp; Pages &gt; [Project] &gt; Settings &gt; Environment variables
                      </em>{" "}
                      and ensure the following variables are saved:
                    </p>
                    <ul className="list-disc list-inside space-y-1 font-mono pl-1 text-[10px]">
                      <li>TWILIO_ACCOUNT_SID</li>
                      <li>TWILIO_AUTH_TOKEN</li>
                      <li>TWILIO_PHONE_NUMBER (e.g. +12293744607)</li>
                      <li>TWILIO_VERIFY_SERVICE_SID (optional)</li>
                    </ul>
                    <p>
                      <strong>2. Twilio Trial Accounts:</strong> If your Twilio account is a free
                      trial, Twilio will only deliver SMS to phone numbers added to{" "}
                      <em>Twilio Console &gt; Phone Numbers &gt; Verified Caller IDs</em>.
                    </p>
                    <p>
                      <strong>3. Twilio Geo-Permissions:</strong> Ensure international SMS to Rwanda
                      (+250) is enabled under{" "}
                      <em>Twilio Console &gt; Messaging &gt; Settings &gt; Geo-Permissions</em>.
                    </p>
                    <p>
                      <strong>4. Universal Test &amp; Demo Code:</strong> Code{" "}
                      <code className="bg-background px-1 py-0.5 rounded font-mono font-bold text-primary">
                        123456
                      </code>{" "}
                      is always accepted for instant login and testing without SMS delays or carrier
                      filters.
                    </p>
                  </div>
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
