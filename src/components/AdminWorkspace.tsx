import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  Loader2,
  CheckCircle2,
  Package,
  Phone,
  MapPin,
  Printer,
  Search,
  UserPlus,
  Mail,
  Unlock,
  ExternalLink,
  Clock,
  Filter,
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

interface AdminWorkspaceProps {
  activeTab: string;
  currentUser: UserProfile;
  onTabChange?: (tab: string) => void;
}

export function AdminWorkspace({ activeTab, currentUser, onTabChange }: AdminWorkspaceProps) {
  const adminKey = currentUser.access_token || currentUser.email || "ishyura2026";

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [systemAdmins, setSystemAdmins] = useState<AdminUserRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadEventRecord[]>([]);

  // Per-tab lazy loading tracking to avoid loading a lot of things upfront
  const [tabLoading, setTabLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [inquiryFilter, setInquiryFilter] = useState<"all" | "new" | "resolved">("all");
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "delivered">("all");

  // QR Print & Unlock Modal
  const [selectedQrForPrint, setSelectedQrForPrint] = useState<QRCodeRecord | null>(null);
  const [unlockingQrId, setUnlockingQrId] = useState<string | null>(null);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const printCardRef = useRef<HTMLDivElement>(null);

  // New admin state
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  // Lazy-load data ONLY for the requested tab (avoiding fetching 7 collections at once)
  const fetchTabData = useCallback(
    async (tab: string, force = false) => {
      if (!force && loadedTabs[tab]) {
        return;
      }
      setTabLoading(true);
      try {
        switch (tab) {
          case "inquiries": {
            const data = await IshyuraClient.getAdminInquiries(adminKey).catch(() => []);
            setInquiries(data);
            break;
          }
          case "orders": {
            const data = await IshyuraClient.getAdminOrders(adminKey).catch(() => []);
            setOrders(data);
            break;
          }
          case "qrs": {
            const data = await IshyuraClient.getAdminQrCodes(adminKey).catch(() => []);
            setQrCodes(data);
            break;
          }
          case "merchants": {
            const data = await IshyuraClient.getAdminMerchants(adminKey).catch(() => []);
            setMerchants(data);
            break;
          }
          case "admins": {
            const data = await IshyuraClient.getAdminAdmins(adminKey).catch(() => []);
            setSystemAdmins(data);
            break;
          }
          case "logs": {
            const data = await IshyuraClient.getAdminDownloads(adminKey).catch(() => []);
            setDownloads(data);
            break;
          }
          default:
            break;
        }
        setLoadedTabs((prev) => ({ ...prev, [tab]: true }));
      } catch (err) {
        console.error(`Failed to load data for tab ${tab}`, err);
      } finally {
        setTabLoading(false);
      }
    },
    [adminKey, loadedTabs],
  );

  // Load only the current active tab
  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // Fetch background stats once on mount for header badges
  useEffect(() => {
    IshyuraClient.getAdminStats(adminKey)
      .then((s) => {
        if (s) setStats(s);
      })
      .catch(() => {});
  }, [adminKey]);

  // Manual refresh for current active tab only
  const handleRefreshTab = () => {
    fetchTabData(activeTab, true);
    IshyuraClient.getAdminStats(adminKey)
      .then((s) => {
        if (s) setStats(s);
      })
      .catch(() => {});
  };

  // Handle updating inquiry status
  const handleToggleInquiryStatus = async (inquiryId: string, currentStatus: string) => {
    const newStatus = currentStatus === "new" ? "resolved" : "new";
    try {
      await IshyuraClient.updateInquiryStatus(adminKey, inquiryId, newStatus);
      setInquiries((prev) =>
        prev.map((item) => (item.id === inquiryId ? { ...item, status: newStatus } : item)),
      );
      if (stats) {
        setStats({
          ...stats,
          newInquiries:
            newStatus === "resolved" ? Math.max(0, stats.newInquiries - 1) : stats.newInquiries + 1,
        });
      }
    } catch (err) {
      console.error("Failed to update inquiry status", err);
    }
  };

  // Handle updating order status
  const handleToggleOrderStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "pending" ? "delivered" : "pending";
    try {
      await IshyuraClient.updateOrderStatus(adminKey, orderId, nextStatus);
      setOrders((prev) =>
        prev.map((item) => (item.id === orderId ? { ...item, status: nextStatus } : item)),
      );
      if (stats) {
        setStats({
          ...stats,
          pendingOrders:
            nextStatus === "delivered"
              ? Math.max(0, stats.pendingOrders - 1)
              : stats.pendingOrders + 1,
        });
      }
    } catch (err) {
      console.error("Failed to update order status", err);
    }
  };

  // Handle unlocking single print
  const handleUnlockQr = async (qrId: string) => {
    setUnlockingQrId(qrId);
    setUnlockMsg(null);
    try {
      await IshyuraClient.unlockQr(adminKey, qrId);
      setUnlockMsg(`QR Card ${qrId} has been unlocked for re-printing.`);
      setTimeout(() => setUnlockMsg(null), 4000);
    } catch (err) {
      console.error("Failed to unlock QR", err);
    } finally {
      setUnlockingQrId(null);
    }
  };

  // Handle adding admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);
    try {
      await IshyuraClient.addAdminUser(adminKey, {
        email: newAdminEmail.trim().toLowerCase(),
        name: newAdminName.trim() || undefined,
      });
      setAdminSuccessMsg(`Granted Administrator role to ${newAdminEmail}.`);
      setNewAdminEmail("");
      setNewAdminName("");
      const updatedAdmins = await IshyuraClient.getAdminAdmins(adminKey);
      setSystemAdmins(updatedAdmins);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add admin";
      setAdminErrorMsg(msg);
    } finally {
      setAddingAdmin(false);
    }
  };

  // Filtered queries
  const filteredInquiries = inquiries.filter((i) => {
    const matchesSearch =
      i.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.sender_phone.includes(searchQuery) ||
      i.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.message.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (inquiryFilter === "new") return i.status === "new";
    if (inquiryFilter === "resolved") return i.status === "resolved";
    return true;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_phone.includes(searchQuery) ||
      o.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.delivery_location.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (orderFilter === "pending") return o.status === "pending";
    if (orderFilter === "delivered") return o.status === "delivered";
    return true;
  });

  const filteredQrs = qrCodes.filter(
    (q) =>
      (q.business_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.dial_code || "").includes(searchQuery) ||
      (q.owner_id || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredMerchants = merchants.filter(
    (m) =>
      m.phone_number.includes(searchQuery) ||
      (m.email || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Tab metadata for clean header
  const getTabInfo = () => {
    switch (activeTab) {
      case "inquiries":
        return {
          title: "Client Messages",
          desc: "Merchant inquiries and instant WhatsApp contact channels",
          icon: <MessageSquare className="size-4.5 text-sky-500" />,
          count: inquiries.length,
          countLabel: "messages",
        };
      case "orders":
        return {
          title: "Stand & Sticker Orders",
          desc: "Tabletop acrylic stands and waterproof vinyl sticker orders",
          icon: <Package className="size-4.5 text-emerald-500" />,
          count: orders.length,
          countLabel: "orders",
        };
      case "qrs":
        return {
          title: "Merchant QR Registry",
          desc: "All registered payment tent cards and active USSD dial codes in Rwanda",
          icon: <QrCode className="size-4.5 text-amber-500" />,
          count: qrCodes.length,
          countLabel: "active cards",
        };
      case "merchants":
        return {
          title: "Merchants Directory",
          desc: "Verified merchant accounts and phone numbers",
          icon: <Users className="size-4.5 text-purple-500" />,
          count: merchants.length,
          countLabel: "merchants",
        };
      case "admins":
        return {
          title: "Platform Administrators",
          desc: "Users authorized to manage platform operations and orders",
          icon: <ShieldCheck className="size-4.5 text-rose-500" />,
          count: systemAdmins.length,
          countLabel: "administrators",
        };
      case "logs":
        return {
          title: "Audit & Download Logs",
          desc: "Recent tent card exports, print events, and system records",
          icon: <Clock className="size-4.5 text-slate-400" />,
          count: downloads.length,
          countLabel: "events",
        };
      default:
        return {
          title: "Admin Workspace",
          desc: "Administrative operations",
          icon: <ShieldCheck className="size-4.5 text-primary" />,
          count: 0,
          countLabel: "",
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <div className="w-full flex-1 flex flex-col space-y-4">
      {/* 1. Sleek, space-saving Header: No huge KPI blocks consuming vertical space */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-card border border-border/70 flex items-center justify-center shrink-0 shadow-2xs">
            {tabInfo.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                {tabInfo.title}
              </h1>
              <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">
                {tabInfo.count} {tabInfo.countLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{tabInfo.desc}</p>
          </div>
        </div>

        {/* Right Action Tools: Integrated Search & Refresh */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={`Search in ${tabInfo.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 h-8.5 bg-card/60 rounded-xl border-border/70 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshTab}
            disabled={tabLoading}
            className="h-8.5 text-xs font-semibold gap-1.5 rounded-xl shrink-0"
            title="Refresh current tab"
          >
            <RefreshCw className={`size-3.5 ${tabLoading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. TAB CONTENT: Maximized space on the right for displaying important information */}
      <div className="flex-1 w-full min-h-0">
        {/* Loading Spinner for Active Tab */}
        {tabLoading && !loadedTabs[activeTab] ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading {tabInfo.title.toLowerCase()}...</p>
          </div>
        ) : null}

        {/* TAB 1: CLIENT INQUIRIES & MESSAGES */}
        {activeTab === "inquiries" && (
          <div className="space-y-3">
            {/* Quick Filter Bar */}
            <div className="flex items-center gap-2 pb-1">
              <Button
                variant={inquiryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setInquiryFilter("all")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                All Messages ({inquiries.length})
              </Button>
              <Button
                variant={inquiryFilter === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setInquiryFilter("new")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                New / Unread ({inquiries.filter((i) => i.status === "new").length})
              </Button>
              <Button
                variant={inquiryFilter === "resolved" ? "default" : "outline"}
                size="sm"
                onClick={() => setInquiryFilter("resolved")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                Resolved ({inquiries.filter((i) => i.status === "resolved").length})
              </Button>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <MessageSquare className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No client messages match filter</p>
                <p className="text-xs text-muted-foreground">
                  Inquiries submitted by merchants through the support modal appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredInquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      inquiry.status === "new"
                        ? "border-sky-500/50 bg-sky-500/5 shadow-xs"
                        : "border-border/60 bg-card/30 opacity-85"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            inquiry.status === "new"
                              ? "bg-sky-500 text-white"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                          }`}
                        >
                          {inquiry.status === "new" ? "New Ticket" : "Resolved"}
                        </span>
                        <h3 className="font-bold text-sm text-foreground truncate">
                          {inquiry.subject}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                        <Clock className="size-3" />
                        <span>{new Date(inquiry.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="py-2.5">
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {inquiry.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border/40 text-xs">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Users className="size-3.5 text-muted-foreground" />
                          <span>{inquiry.sender_name}</span>
                        </div>

                        <a
                          href={`tel:${inquiry.sender_phone}`}
                          className="flex items-center gap-1.5 text-primary hover:underline font-bold"
                        >
                          <Phone className="size-3.5" />
                          <span>{inquiry.sender_phone}</span>
                        </a>

                        {inquiry.sender_email && (
                          <a
                            href={`mailto:${inquiry.sender_email}`}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="size-3.5" />
                            <span>{inquiry.sender_email}</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`https://wa.me/${inquiry.sender_phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <span>Reply WhatsApp</span>
                          <ExternalLink className="size-3" />
                        </a>

                        <Button
                          size="sm"
                          variant={inquiry.status === "new" ? "default" : "outline"}
                          onClick={() => handleToggleInquiryStatus(inquiry.id, inquiry.status)}
                          className="h-7 text-xs font-semibold rounded-lg px-2.5"
                        >
                          {inquiry.status === "new" ? "Mark Resolved" : "Re-open"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STAND & STICKER ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-3">
            {/* Quick Filter Bar */}
            <div className="flex items-center gap-2 pb-1">
              <Button
                variant={orderFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderFilter("all")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                All Orders ({orders.length})
              </Button>
              <Button
                variant={orderFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderFilter("pending")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                Pending Dispatch ({orders.filter((o) => o.status === "pending").length})
              </Button>
              <Button
                variant={orderFilter === "delivered" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderFilter("delivered")}
                className="h-7 text-xs font-semibold rounded-lg px-2.5"
              >
                Fulfilled / Delivered ({orders.filter((o) => o.status === "delivered").length})
              </Button>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <Package className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No orders match filter</p>
                <p className="text-xs text-muted-foreground">
                  Orders placed for physical acrylic stands or sticker packs will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      order.status === "pending"
                        ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
                        : "border-border/60 bg-card/30"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {order.order_number}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            order.status === "pending"
                              ? "bg-amber-500 text-amber-950 font-black"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                          }`}
                        >
                          {order.status}
                        </span>
                        <span className="text-xs font-bold text-primary truncate">
                          {order.item_type === "acrylic_stand"
                            ? "1x A6 Acrylic Tabletop Stand"
                            : order.item_type === "vinyl_stickers"
                              ? "Pack of 5 Waterproof Stickers"
                              : "Complete Merchant Bundle"}
                        </span>
                      </div>

                      <span className="text-sm font-extrabold text-foreground shrink-0">
                        {order.total_price.toLocaleString()} RWF
                      </span>
                    </div>

                    <div className="py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground text-[11px]">Shop / Business:</p>
                        <p className="font-bold text-foreground mt-0.5">{order.business_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[11px]">Contact & Phone:</p>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="font-bold text-primary mt-0.5 block hover:underline"
                        >
                          {order.customer_name} ({order.customer_phone})
                        </a>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[11px]">Delivery Location:</p>
                        <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="size-3 text-rose-500 shrink-0" />
                          <span>{order.delivery_location}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground text-[11px]">
                        Created: {new Date(order.created_at).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant={order.status === "pending" ? "default" : "outline"}
                        onClick={() => handleToggleOrderStatus(order.id, order.status)}
                        className="h-7 text-xs font-semibold rounded-lg px-3"
                      >
                        {order.status === "pending"
                          ? "Mark Dispatched / Delivered"
                          : "Mark Pending"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MERCHANT QR REGISTRY */}
        {activeTab === "qrs" && (
          <div className="space-y-3">
            {unlockMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{unlockMsg}</span>
              </div>
            )}

            {filteredQrs.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <QrCode className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No QR payment cards found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredQrs.map((qr) => (
                  <div
                    key={qr.id}
                    className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-3 flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {qr.business_name || "Payment Card"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {qr.network}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ID: {qr.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                          Active
                        </span>
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-muted/40 font-mono text-xs text-foreground flex items-center justify-between">
                        <span className="font-bold">{qr.dial_code}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(qr.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/40 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedQrForPrint(qr)}
                        className="h-7 text-xs font-semibold gap-1.5 rounded-lg"
                      >
                        <Printer className="size-3" />
                        <span>Admin Re-Print</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={unlockingQrId === qr.id}
                        onClick={() => handleUnlockQr(qr.id)}
                        className="h-7 text-xs font-semibold text-amber-500 hover:text-amber-600 gap-1.5"
                      >
                        <Unlock className="size-3" />
                        <span>Unlock Re-Issue</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MERCHANTS DIRECTORY */}
        {activeTab === "merchants" && (
          <div className="space-y-3">
            {filteredMerchants.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <Users className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No merchants match your search</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold">
                      <tr>
                        <th className="p-3">Phone / Account</th>
                        <th className="p-3">Email Address</th>
                        <th className="p-3">Account Status</th>
                        <th className="p-3">Registered Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredMerchants.map((merchant) => (
                        <tr key={merchant.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-bold text-foreground">
                            <a
                              href={`tel:${merchant.phone_number}`}
                              className="hover:underline text-primary"
                            >
                              {merchant.phone_number}
                            </a>
                          </td>
                          <td className="p-3 text-muted-foreground">{merchant.email || "—"}</td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              Active Merchant
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(merchant.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SYSTEM ADMINS */}
        {activeTab === "admins" && (
          <div className="space-y-4">
            {/* Add Admin Form */}
            <div className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Grant Administrator Access</h3>
              <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Google Email (e.g. name@gmail.com)"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                  className="h-8.5 text-xs rounded-xl"
                />
                <Input
                  placeholder="Full Name (optional)"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="h-8.5 text-xs rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={addingAdmin}
                  className="h-8.5 text-xs font-bold rounded-xl gap-1.5"
                >
                  {addingAdmin ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  <span>Add Administrator</span>
                </Button>
              </form>

              {adminSuccessMsg && (
                <p className="text-xs font-semibold text-emerald-500">{adminSuccessMsg}</p>
              )}
              {adminErrorMsg && (
                <p className="text-xs font-semibold text-red-500">{adminErrorMsg}</p>
              )}
            </div>

            {/* Admins Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {systemAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="p-4 rounded-2xl border border-border/70 bg-card/30 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-sm shrink-0">
                      {admin.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-foreground truncate">
                        {admin.name || admin.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{admin.email}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 shrink-0">
                    {admin.email === "jeanniyonkuru29@gmail.com" ? "Superadmin" : "Admin"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT & EXPORT LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-3">
            {downloads.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <Clock className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No export events logged yet</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold">
                      <tr>
                        <th className="p-3">Shop / Business</th>
                        <th className="p-3">Network</th>
                        <th className="p-3">Dial Code</th>
                        <th className="p-3">Export Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {downloads.slice(0, 50).map((dl) => (
                        <tr key={dl.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-sans font-bold text-foreground">
                            {dl.business_name}
                          </td>
                          <td className="p-3">{dl.network}</td>
                          <td className="p-3 text-primary font-bold">{dl.dial_code}</td>
                          <td className="p-3 text-muted-foreground font-sans">
                            {new Date(dl.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin QR Emergency Re-Print Modal */}
      <Dialog open={!!selectedQrForPrint} onOpenChange={() => setSelectedQrForPrint(null)}>
        <DialogContent className="max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Admin Emergency Card Re-Print</DialogTitle>
            <DialogDescription className="text-xs">
              Re-printing tent card for {selectedQrForPrint?.business_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedQrForPrint && (
            <div className="flex flex-col items-center py-4 space-y-4">
              <div
                ref={printCardRef}
                className="w-64 p-5 rounded-2xl border-2 border-foreground/20 bg-white text-slate-900 flex flex-col items-center text-center shadow-lg"
              >
                <div className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase mb-2">
                  {selectedQrForPrint.network}
                </div>
                <h4 className="font-extrabold text-base text-slate-900">
                  {selectedQrForPrint.business_name}
                </h4>
                <div className="p-2 bg-white rounded-xl shadow-inner border my-2">
                  <QRCodeSVG value={`tel:${selectedQrForPrint.dial_code}`} size={160} />
                </div>
                <p className="font-mono text-xs font-bold text-slate-950">
                  {selectedQrForPrint.dial_code}
                </p>
              </div>

              <Button
                onClick={() => window.print()}
                className="w-full text-xs font-bold gap-2 rounded-xl"
              >
                <Printer className="size-4" />
                <span>Print Counter Card</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
