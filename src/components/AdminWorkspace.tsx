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
  AlertCircle,
  Package,
  Truck,
  Phone,
  MapPin,
  Printer,
  Search,
  UserPlus,
  Mail,
  Lock,
  Unlock,
  ExternalLink,
  Store,
  Clock,
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

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [systemAdmins, setSystemAdmins] = useState<AdminUserRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadEventRecord[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

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

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        statsData,
        inquiriesData,
        ordersData,
        qrsData,
        merchantsData,
        adminsData,
        downloadsData,
      ] = await Promise.all([
        IshyuraClient.getAdminStats(adminKey).catch(() => null),
        IshyuraClient.getAdminInquiries(adminKey).catch(() => []),
        IshyuraClient.getAdminOrders(adminKey).catch(() => []),
        IshyuraClient.getAdminQrCodes(adminKey).catch(() => []),
        IshyuraClient.getAdminMerchants(adminKey).catch(() => []),
        IshyuraClient.getAdminAdmins(adminKey).catch(() => []),
        IshyuraClient.getAdminDownloads(adminKey).catch(() => []),
      ]);

      setStats(statsData);
      setInquiries(inquiriesData);
      setOrders(ordersData);
      setQrCodes(qrsData);
      setMerchants(merchantsData);
      setSystemAdmins(adminsData);
      setDownloads(downloadsData);
    } catch (err) {
      console.error("Error loading admin data", err);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

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

  const filteredInquiries = inquiries.filter(
    (i) =>
      i.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.sender_phone.includes(searchQuery) ||
      i.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.message.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredOrders = orders.filter(
    (o) =>
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_phone.includes(searchQuery) ||
      o.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.delivery_location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Stats Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">
              Live Administration
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
            Ishyura Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logged in as{" "}
            <strong className="text-foreground">
              {currentUser.email || currentUser.phone_number}
            </strong>{" "}
            (Superadmin)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAdminData}
            disabled={loading}
            className="h-8 text-xs font-semibold gap-1.5 rounded-xl shadow-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh Data</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onTabChange?.("inquiries")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === "inquiries"
                ? "border-sky-500 bg-sky-500/10 shadow-sm"
                : "border-border/60 bg-card/40 hover:bg-card/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Client Messages</span>
              <MessageSquare className="size-4 text-sky-500" />
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{stats.totalInquiries}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {stats.newInquiries > 0 ? (
                <span className="font-bold text-amber-500">● {stats.newInquiries} unread</span>
              ) : (
                <span className="text-emerald-500">All resolved</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTabChange?.("orders")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === "orders"
                ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                : "border-border/60 bg-card/40 hover:bg-card/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Stand Orders</span>
              <Package className="size-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{stats.totalOrders}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {stats.pendingOrders > 0 ? (
                <span className="font-bold text-amber-500">
                  ● {stats.pendingOrders} pending dispatch
                </span>
              ) : (
                <span className="text-emerald-500">All fulfilled</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTabChange?.("qrs")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === "qrs"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/60 bg-card/40 hover:bg-card/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Merchant QRs</span>
              <QrCode className="size-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{stats.totalQrCodes}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Active merchant codes</p>
          </button>

          <button
            type="button"
            onClick={() => onTabChange?.("merchants")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeTab === "merchants"
                ? "border-purple-500 bg-purple-500/10 shadow-sm"
                : "border-border/60 bg-card/40 hover:bg-card/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Registered Merchants</span>
              <Users className="size-4 text-purple-500" />
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{stats.totalMerchants}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Verified accounts</p>
          </button>
        </div>
      )}

      {/* Global Tab Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${activeTab}... (e.g. phone, client name, order #, code)`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-card/40 rounded-xl border-border/70 text-xs"
        />
      </div>

      {/* TAB CONTENT: 1. Client Inquiries / Messages */}
      {activeTab === "inquiries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="size-4 text-sky-500" />
              <span>Incoming Client Messages ({filteredInquiries.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct inquiries submitted by Rwandan merchants
            </p>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border/80 text-center bg-card/20">
              <MessageSquare className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-bold text-foreground">No client messages found</p>
              <p className="text-xs text-muted-foreground mt-1">
                When merchants send questions from the support dialog, their messages appear here
                immediately.
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
                      : "border-border/60 bg-card/30 opacity-80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          inquiry.status === "new"
                            ? "bg-sky-500 text-white"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {inquiry.status === "new" ? "New Ticket" : "Resolved"}
                      </span>
                      <h3 className="font-bold text-sm text-foreground">{inquiry.subject}</h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>{new Date(inquiry.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="py-3">
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {inquiry.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs">
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
                        <span>Reply on WhatsApp</span>
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

      {/* TAB CONTENT: 2. Physical Merchandise Orders */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Package className="size-4 text-emerald-500" />
              <span>Stand & Sticker Orders ({filteredOrders.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Orders for acrylic stands & vinyl stickers
            </p>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border/80 text-center bg-card/20">
              <Package className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-bold text-foreground">No orders found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Orders placed for physical stands or sticker packs will be tracked here.
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        {order.order_number}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          order.status === "pending"
                            ? "bg-amber-500 text-amber-950 font-black"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {order.item_type === "acrylic_stand"
                          ? "1x A6 Acrylic Tabletop Stand"
                          : order.item_type === "vinyl_stickers"
                            ? "Pack of 5 Waterproof Stickers"
                            : "Complete Merchant Bundle"}
                      </span>
                    </div>

                    <span className="text-sm font-extrabold text-foreground">
                      {order.total_price.toLocaleString()} RWF
                    </span>
                  </div>

                  <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Shop / Business:</p>
                      <p className="font-bold text-foreground mt-0.5">{order.business_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contact & Phone:</p>
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="font-bold text-primary mt-0.5 block hover:underline"
                      >
                        {order.customer_name} ({order.customer_phone})
                      </a>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Delivery Location:</p>
                      <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="size-3 text-rose-500" />
                        <span>{order.delivery_location}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      Created: {new Date(order.created_at).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant={order.status === "pending" ? "default" : "outline"}
                      onClick={() => handleToggleOrderStatus(order.id, order.status)}
                      className="h-7 text-xs font-semibold rounded-lg px-3"
                    >
                      {order.status === "pending" ? "Mark Dispatched / Delivered" : "Mark Pending"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: 3. Merchant QR Registry (Single Generation Oversight) */}
      {activeTab === "qrs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <span>Merchant QR Registry ({filteredQrs.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                All registered payment tent cards across Rwanda with verified dial codes.
              </p>
            </div>
          </div>

          {unlockMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{unlockMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filteredQrs.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border/80 text-center bg-card/20">
              <QrCode className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-bold text-foreground">No QR cards found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredQrs.map((qr) => (
                <div
                  key={qr.id}
                  className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {qr.business_name || "Payment Card"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {qr.network}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID: {qr.id}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      Printed &amp; Active
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/40 font-mono text-xs text-foreground flex items-center justify-between">
                    <span>{qr.dial_code}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(qr.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
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

      {/* TAB CONTENT: 4. Registered Merchants Directory */}
      {activeTab === "merchants" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="size-4 text-purple-500" />
              <span>Merchants Directory ({filteredMerchants.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">Accounts authenticated on Ishyura</p>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-3">Phone / Account</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Registration Status</th>
                      <th className="p-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredMerchants.map((merchant) => (
                      <tr key={merchant.id} className="hover:bg-muted/20">
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
                            Active
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

      {/* TAB CONTENT: 5. Platform Admins */}
      {activeTab === "admins" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-rose-500" />
              <span>Platform Administrators ({systemAdmins.length})</span>
            </h2>
          </div>

          <div className="p-5 rounded-2xl border border-border/70 bg-card/40 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Grant Administrator Access</h3>
            <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Google Email (e.g. name@gmail.com)"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
                className="h-9 text-xs rounded-xl"
              />
              <Input
                placeholder="Full Name (optional)"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
              <Button
                type="submit"
                disabled={addingAdmin}
                className="h-9 text-xs font-bold rounded-xl gap-1.5"
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
            {adminErrorMsg && <p className="text-xs font-semibold text-red-500">{adminErrorMsg}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {systemAdmins.map((admin) => (
              <div
                key={admin.id}
                className="p-4 rounded-2xl border border-border/70 bg-card/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-sm">
                    {admin.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-foreground">{admin.name || admin.email}</p>
                    <p className="text-[11px] text-muted-foreground">{admin.email}</p>
                  </div>
                </div>

                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                  {admin.email === "jeanniyonkuru29@gmail.com" ? "Superadmin" : "Admin"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 6. Audit & System Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">
              Recent Download & Tent Card Exports ({downloads.length})
            </h2>
          </div>

          <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">Shop / Business</th>
                    <th className="p-3">Network</th>
                    <th className="p-3">Dial Code</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {downloads.slice(0, 30).map((dl) => (
                    <tr key={dl.id} className="hover:bg-muted/20">
                      <td className="p-3 font-sans font-bold text-foreground">
                        {dl.business_name}
                      </td>
                      <td className="p-3">{dl.network}</td>
                      <td className="p-3 text-primary">{dl.dial_code}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(dl.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
