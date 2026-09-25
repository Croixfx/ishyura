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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Trash2,
  Edit3,
  PlusCircle,
  Sparkles,
  Download,
  AlertCircle,
  Save,
  Zap,
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
  const [qrNetworkFilter, setQrNetworkFilter] = useState<"all" | "MTN" | "Airtel" | "Equity">(
    "all",
  );
  const [qrTypeFilter, setQrTypeFilter] = useState<"all" | "dynamic" | "static" | "fixed_price">(
    "all",
  );

  // QR Print & Unlock Modal
  const [selectedQrForPrint, setSelectedQrForPrint] = useState<QRCodeRecord | null>(null);
  const [unlockingQrId, setUnlockingQrId] = useState<string | null>(null);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const printCardRef = useRef<HTMLDivElement>(null);

  // QR CRUD Modals State
  const [createQrDialogOpen, setCreateQrDialogOpen] = useState(false);
  const [newQrBusinessName, setNewQrBusinessName] = useState("");
  const [newQrPhone, setNewQrPhone] = useState("");
  const [newQrNetwork, setNewQrNetwork] = useState("MTN MoMo");
  const [newQrPaymentType, setNewQrPaymentType] = useState<"momo_code" | "phone">("momo_code");
  const [newQrAccountValue, setNewQrAccountValue] = useState("");
  const [newQrAmount, setNewQrAmount] = useState("");
  const [newQrItemName, setNewQrItemName] = useState("");
  const [newQrIsDynamic, setNewQrIsDynamic] = useState(false);
  const [creatingQr, setCreatingQr] = useState(false);

  // Edit QR State
  const [editQrDialogOpen, setEditQrDialogOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<QRCodeRecord | null>(null);
  const [editQrBusinessName, setEditQrBusinessName] = useState("");
  const [editQrPhone, setEditQrPhone] = useState("");
  const [editQrNetwork, setEditQrNetwork] = useState("MTN MoMo");
  const [editQrPaymentType, setEditQrPaymentType] = useState<"momo_code" | "phone">("momo_code");
  const [editQrAccountValue, setEditQrAccountValue] = useState("");
  const [editQrAmount, setEditQrAmount] = useState("");
  const [editQrItemName, setEditQrItemName] = useState("");
  const [editQrIsDynamic, setEditQrIsDynamic] = useState(false);
  const [updatingQr, setUpdatingQr] = useState(false);

  // Delete Confirm State
  const [deleteConfirmQr, setDeleteConfirmQr] = useState<QRCodeRecord | null>(null);
  const [deletingQr, setDeletingQr] = useState(false);

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

  // Helper to build USSD
  const buildUssdCode = (net: string, type: string, val: string, amt?: number | null) => {
    const cleanDigits = val.replace(/[^0-9]/g, "");
    if (net.toLowerCase().includes("equity") || net.toLowerCase().includes("ekash")) {
      return amt ? `*555*2*${cleanDigits}*${Math.round(amt)}#` : `*555*2*${cleanDigits}#`;
    }
    const prefix = type === "momo_code" ? "*182*8*1*" : "*182*1*1*";
    return amt ? `${prefix}${cleanDigits}*${Math.round(amt)}#` : `${prefix}${cleanDigits}#`;
  };

  // Handle Admin Creating QR
  const handleCreateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQrBusinessName.trim() || !newQrAccountValue.trim()) return;
    setCreatingQr(true);
    try {
      const numAmt = newQrAmount.trim() ? parseFloat(newQrAmount) : null;
      const cleanDigits = newQrAccountValue.replace(/[^0-9]/g, "");
      const ussd = buildUssdCode(newQrNetwork, newQrPaymentType, cleanDigits, numAmt);

      const created = await IshyuraClient.createAdminQrCode(adminKey, {
        business_name: newQrBusinessName.trim(),
        phone_number: newQrPhone.trim() || cleanDigits,
        network: newQrNetwork,
        payment_type: newQrPaymentType,
        dial_code: ussd,
        amount: numAmt,
        item_name: newQrItemName.trim() || null,
        is_dynamic: newQrIsDynamic ? 1 : 0,
      });

      setQrCodes((prev) => [created, ...prev]);
      if (stats) setStats({ ...stats, totalQrCodes: stats.totalQrCodes + 1 });
      setUnlockMsg(`Created QR card for ${created.business_name} (${created.network}).`);
      setTimeout(() => setUnlockMsg(null), 4000);

      // Reset & close
      setNewQrBusinessName("");
      setNewQrPhone("");
      setNewQrAccountValue("");
      setNewQrAmount("");
      setNewQrItemName("");
      setNewQrIsDynamic(false);
      setCreateQrDialogOpen(false);
    } catch (err) {
      console.error("Failed to create QR", err);
    } finally {
      setCreatingQr(false);
    }
  };

  // Handle Starting Edit QR
  const handleStartEditQr = (qr: QRCodeRecord) => {
    setEditingQr(qr);
    setEditQrBusinessName(qr.business_name || "");
    setEditQrPhone(qr.phone_number || "");
    setEditQrNetwork(qr.network || "MTN MoMo");
    setEditQrPaymentType((qr.payment_type as "momo_code" | "phone") || "momo_code");
    const digits = (qr.dial_code || "").replace(/[^0-9]/g, "");
    setEditQrAccountValue(digits || qr.phone_number || "");
    setEditQrAmount(qr.amount ? String(qr.amount) : "");
    setEditQrItemName(qr.item_name || "");
    setEditQrIsDynamic(Boolean(qr.is_dynamic));
    setEditQrDialogOpen(true);
  };

  // Handle Admin Updating QR
  const handleUpdateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQr || !editQrBusinessName.trim() || !editQrAccountValue.trim()) return;
    setUpdatingQr(true);
    try {
      const numAmt = editQrAmount.trim() ? parseFloat(editQrAmount) : null;
      const cleanDigits = editQrAccountValue.replace(/[^0-9]/g, "");
      const ussd = buildUssdCode(editQrNetwork, editQrPaymentType, cleanDigits, numAmt);

      const updated = await IshyuraClient.updateAdminQrCode(adminKey, editingQr.id, {
        business_name: editQrBusinessName.trim(),
        phone_number: editQrPhone.trim() || cleanDigits,
        network: editQrNetwork,
        payment_type: editQrPaymentType,
        dial_code: ussd,
        amount: numAmt,
        item_name: editQrItemName.trim() || null,
        is_dynamic: editQrIsDynamic ? 1 : 0,
      });

      setQrCodes((prev) => prev.map((q) => (q.id === editingQr.id ? { ...q, ...updated } : q)));
      setUnlockMsg(
        `Updated details for ${updated.business_name}. Existing prints route to new data!`,
      );
      setTimeout(() => setUnlockMsg(null), 4000);
      setEditQrDialogOpen(false);
      setEditingQr(null);
    } catch (err) {
      console.error("Failed to update QR", err);
    } finally {
      setUpdatingQr(false);
    }
  };

  // Handle Admin Deleting QR (which releases duplicate lock so merchant can print/generate again)
  const handleDeleteQr = async () => {
    if (!deleteConfirmQr) return;
    setDeletingQr(true);
    try {
      await IshyuraClient.deleteAdminQrCode(adminKey, deleteConfirmQr.id);
      setQrCodes((prev) => prev.filter((q) => q.id !== deleteConfirmQr.id));
      if (stats) setStats({ ...stats, totalQrCodes: Math.max(0, stats.totalQrCodes - 1) });
      setUnlockMsg(
        `QR Card deleted for ${deleteConfirmQr.business_name}. The merchant is now unlocked and can generate or print a new card.`,
      );
      setTimeout(() => setUnlockMsg(null), 5000);
      setDeleteConfirmQr(null);
    } catch (err) {
      console.error("Failed to delete QR", err);
    } finally {
      setDeletingQr(false);
    }
  };

  // Handle Downloading PNG for Admin Print Modal
  const handleDownloadPrintCard = async () => {
    if (!printCardRef.current || !selectedQrForPrint) return;
    setDownloadingCard(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(printCardRef.current, { pixelRatio: 3 });
      const link = document.createElement("a");
      const netSlug = selectedQrForPrint.network.replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `${selectedQrForPrint.business_name.replace(/\s+/g, "_")}_${netSlug}_card.png`;
      link.href = dataUrl;
      link.click();
      IshyuraClient.recordDownload({
        business_name: selectedQrForPrint.business_name,
        network: selectedQrForPrint.network,
        dial_code: selectedQrForPrint.dial_code,
        phone_number: selectedQrForPrint.phone_number,
        file_format: "png",
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to download card PNG", err);
    } finally {
      setDownloadingCard(false);
    }
  };

  // Handle unlocking single print
  const handleUnlockQr = async (qrId: string) => {
    setUnlockingQrId(qrId);
    setUnlockMsg(null);
    try {
      await IshyuraClient.unlockQr(adminKey, qrId);
      setQrCodes((prev) => prev.filter((q) => q.id !== qrId));
      if (stats) setStats({ ...stats, totalQrCodes: Math.max(0, stats.totalQrCodes - 1) });
      setUnlockMsg(
        `QR Card ${qrId} unlocked and cleared. The merchant can now generate and print a new card without restrictions.`,
      );
      setTimeout(() => setUnlockMsg(null), 5000);
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

  const filteredQrs = qrCodes.filter((q) => {
    const qText =
      `${q.business_name || ""} ${q.dial_code || ""} ${q.phone_number || ""} ${q.owner_id || ""} ${q.network || ""} ${q.item_name || ""}`.toLowerCase();
    if (searchQuery.trim() && !qText.includes(searchQuery.toLowerCase().trim())) {
      return false;
    }
    if (qrNetworkFilter !== "all") {
      if (qrNetworkFilter === "MTN" && !q.network.toLowerCase().includes("mtn")) return false;
      if (qrNetworkFilter === "Airtel" && !q.network.toLowerCase().includes("airtel")) return false;
      if (qrNetworkFilter === "Equity" && !q.network.toLowerCase().includes("equity")) return false;
    }
    if (qrTypeFilter !== "all") {
      if (qrTypeFilter === "dynamic" && !q.is_dynamic) return false;
      if (qrTypeFilter === "static" && q.is_dynamic) return false;
      if (qrTypeFilter === "fixed_price" && (!q.amount || q.amount <= 0)) return false;
    }
    return true;
  });

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

        {/* TAB 3: MERCHANT QR REGISTRY (Full Admin CRUD) */}
        {activeTab === "qrs" && (
          <div className="space-y-4">
            {/* Quick Stats & Summary for QR Registry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-card/60 border border-border/70 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  Total QRs
                </span>
                <p className="text-lg font-black text-foreground">{qrCodes.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Sparkles className="size-2.5" />
                  Dynamic PRO
                </span>
                <p className="text-lg font-black text-amber-700 dark:text-amber-300">
                  {qrCodes.filter((q) => Boolean(q.is_dynamic)).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                  Fixed Price
                </span>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {qrCodes.filter((q) => Boolean(q.amount && q.amount > 0)).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-primary">Matching</span>
                <p className="text-lg font-black text-primary">{filteredQrs.length}</p>
              </div>
            </div>

            {/* Action & Filter Bar for QR Registry */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card/40 border border-border/70 p-3.5 rounded-2xl">
              <div>
                <h2 className="text-sm font-black text-foreground">Merchant Payment QR Registry</h2>
                <p className="text-xs text-muted-foreground">
                  Full administrative authority to create, edit, reprint, or delete QR codes and
                  manage single-generation locks.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Network Filter */}
                <Select
                  value={qrNetworkFilter}
                  onValueChange={(val) =>
                    setQrNetworkFilter(val as "all" | "MTN" | "Airtel" | "Equity")
                  }
                >
                  <SelectTrigger className="h-8 text-xs font-semibold w-32 rounded-xl bg-background">
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="MTN">MTN MoMo</SelectItem>
                    <SelectItem value="Airtel">Airtel Money</SelectItem>
                    <SelectItem value="Equity">Equity eKash</SelectItem>
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select
                  value={qrTypeFilter}
                  onValueChange={(val) =>
                    setQrTypeFilter(val as "all" | "dynamic" | "static" | "fixed_price")
                  }
                >
                  <SelectTrigger className="h-8 text-xs font-semibold w-36 rounded-xl bg-background">
                    <SelectValue placeholder="QR Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="dynamic">Dynamic PRO</SelectItem>
                    <SelectItem value="static">Static Free</SelectItem>
                    <SelectItem value="fixed_price">Pre-set Price</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={() => setCreateQrDialogOpen(true)}
                  className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-primary shadow-xs shrink-0"
                >
                  <PlusCircle className="size-3.5" />
                  <span>Create Merchant QR</span>
                </Button>
              </div>
            </div>

            {unlockMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in-50">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{unlockMsg}</span>
              </div>
            )}

            {filteredQrs.length === 0 ? (
              <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center bg-card/20 space-y-2">
                <QrCode className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No QR payment cards found</p>
                <p className="text-xs text-muted-foreground">
                  Click &quot;Create Merchant QR&quot; above to issue an official payment card on
                  behalf of any merchant.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredQrs.map((qr) => (
                  <div
                    key={qr.id}
                    className="p-4 rounded-2xl border border-border/70 bg-card/40 space-y-3 flex flex-col justify-between shadow-2xs hover:border-border transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-foreground truncate">
                            {qr.business_name || "Payment Card"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {qr.network}
                            </span>
                            {Boolean(qr.is_dynamic) && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                <Sparkles className="size-2.5" />
                                PRO DYNAMIC
                              </span>
                            )}
                            {qr.amount && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                {qr.amount.toLocaleString()} RWF
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                          Active
                        </span>
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-muted/40 font-mono text-xs text-foreground flex items-center justify-between">
                        <span className="font-bold truncate mr-2">{qr.dial_code}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-sans">
                          {new Date(qr.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {qr.phone_number && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Owner Phone:{" "}
                          <strong className="text-foreground">{qr.phone_number}</strong>
                        </p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedQrForPrint(qr)}
                        className="h-7 text-xs font-semibold gap-1 rounded-lg px-2"
                        title="View and print official counter card"
                      >
                        <Printer className="size-3" />
                        <span>Print</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEditQr(qr)}
                        className="h-7 text-xs font-semibold gap-1 rounded-lg px-2"
                        title="Edit merchant details, number or price"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={unlockingQrId === qr.id}
                        onClick={() => handleUnlockQr(qr.id)}
                        className="h-7 text-xs font-semibold text-amber-500 hover:text-amber-600 gap-1 px-2"
                        title="Release single-generation lock so merchant can print again"
                      >
                        <Unlock className="size-3" />
                        <span>Unlock</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirmQr(qr)}
                        className="h-7 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 px-2"
                        title="Permanently delete QR and release lock"
                      >
                        <Trash2 className="size-3" />
                        <span>Delete</span>
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

      {/* 1. Admin Create Merchant QR Modal */}
      <Dialog open={createQrDialogOpen} onOpenChange={setCreateQrDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
              <PlusCircle className="size-5 text-primary" />
              <span>Create Merchant QR Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Directly issue an official payment QR code for a shop or merchant.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateQr} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Shop / Business Name</Label>
              <Input
                required
                value={newQrBusinessName}
                onChange={(e) => setNewQrBusinessName(e.target.value)}
                placeholder="e.g. Chez Aline Boutique"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Payment Network</Label>
                <Select value={newQrNetwork} onValueChange={setNewQrNetwork}>
                  <SelectTrigger className="h-9 text-xs">
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
                <Label className="text-xs font-bold text-foreground">Payment Type</Label>
                <Select
                  value={newQrPaymentType}
                  onValueChange={(v) => setNewQrPaymentType(v as "momo_code" | "phone")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momo_code">Merchant Code</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  {newQrPaymentType === "momo_code" ? "MoMo Pay / Till Code" : "Account Phone"}
                </Label>
                <Input
                  required
                  value={newQrAccountValue}
                  onChange={(e) => setNewQrAccountValue(e.target.value)}
                  placeholder="e.g. 123456 or 0788123456"
                  className="h-9 font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Owner Phone (Optional)</Label>
                <Input
                  value={newQrPhone}
                  onChange={(e) => setNewQrPhone(e.target.value)}
                  placeholder="e.g. 0788111222"
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Fixed Price (RWF) (Optional)
                </Label>
                <Input
                  type="number"
                  value={newQrAmount}
                  onChange={(e) => setNewQrAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="h-9 font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Item Name (Optional)</Label>
                <Input
                  value={newQrItemName}
                  onChange={(e) => setNewQrItemName(e.target.value)}
                  placeholder="e.g. Lunch Buffet"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border/60">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground cursor-pointer">
                  Dynamic Smart QR
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Allows changing number later without reprinting
                </p>
              </div>
              <Switch checked={newQrIsDynamic} onCheckedChange={setNewQrIsDynamic} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateQrDialogOpen(false)}
                className="text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingQr}
                size="sm"
                className="text-xs font-bold rounded-xl gap-1.5 bg-primary"
              >
                {creatingQr ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>{creatingQr ? "Creating..." : "Create Merchant QR"}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Admin Edit Merchant QR Modal */}
      <Dialog open={editQrDialogOpen} onOpenChange={setEditQrDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
              <Edit3 className="size-5 text-primary" />
              <span>Edit Merchant QR Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify business name, destination phone number, or pre-filled amount.
            </DialogDescription>
          </DialogHeader>

          {editingQr && (
            <form onSubmit={handleUpdateQr} className="space-y-3.5 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Shop / Business Name</Label>
                <Input
                  required
                  value={editQrBusinessName}
                  onChange={(e) => setEditQrBusinessName(e.target.value)}
                  placeholder="Business Name"
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Payment Network</Label>
                  <Select value={editQrNetwork} onValueChange={setEditQrNetwork}>
                    <SelectTrigger className="h-9 text-xs">
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
                  <Label className="text-xs font-bold text-foreground">Payment Type</Label>
                  <Select
                    value={editQrPaymentType}
                    onValueChange={(v) => setEditQrPaymentType(v as "momo_code" | "phone")}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="momo_code">Merchant Code</SelectItem>
                      <SelectItem value="phone">Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {editQrPaymentType === "momo_code" ? "MoMo / Till Code" : "Account Phone"}
                  </Label>
                  <Input
                    required
                    value={editQrAccountValue}
                    onChange={(e) => setEditQrAccountValue(e.target.value)}
                    placeholder="e.g. 123456 or 0788123456"
                    className="h-9 font-mono font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Owner Phone</Label>
                  <Input
                    value={editQrPhone}
                    onChange={(e) => setEditQrPhone(e.target.value)}
                    placeholder="e.g. 0788111222"
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Fixed Price (RWF)</Label>
                  <Input
                    type="number"
                    value={editQrAmount}
                    onChange={(e) => setEditQrAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="h-9 font-mono font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Item Name</Label>
                  <Input
                    value={editQrItemName}
                    onChange={(e) => setEditQrItemName(e.target.value)}
                    placeholder="e.g. Lunch Buffet"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border/60">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-foreground cursor-pointer">
                    Dynamic Smart QR
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Routes via Cloudflare Edge without reprinting
                  </p>
                </div>
                <Switch checked={editQrIsDynamic} onCheckedChange={setEditQrIsDynamic} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditQrDialogOpen(false)}
                  className="text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updatingQr}
                  size="sm"
                  className="text-xs font-bold rounded-xl gap-1.5 bg-primary"
                >
                  {updatingQr ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  <span>{updatingQr ? "Saving..." : "Save Changes"}</span>
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. Delete QR Confirmation Modal */}
      <Dialog open={!!deleteConfirmQr} onOpenChange={(open) => !open && setDeleteConfirmQr(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-destructive">
              <Trash2 className="size-5" />
              <span>Delete QR &amp; Unlock Merchant</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the payment QR card for{" "}
              <strong className="text-foreground">{deleteConfirmQr?.business_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs space-y-2 text-destructive dark:text-rose-200">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle className="size-4 shrink-0" />
              <span>Single-Generation Lock Will Be Released</span>
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-rose-100/90">
              Deleting this QR code will permanently erase it from the registry. The
              single-generation duplicate blocker will be cleared immediately, allowing the merchant
              to generate or print a brand new card.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmQr(null)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingQr}
              onClick={handleDeleteQr}
              className="text-xs font-bold rounded-xl gap-1.5 shadow-xs"
            >
              {deletingQr ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>{deletingQr ? "Deleting..." : "Yes, Delete & Unlock"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Admin High-Resolution Card View & Re-Print Modal */}
      <Dialog open={!!selectedQrForPrint} onOpenChange={() => setSelectedQrForPrint(null)}>
        <DialogContent className="max-w-md bg-card border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              <span>Official Merchant Counter Card</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preview and export counter tent card for {selectedQrForPrint?.business_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedQrForPrint && (
            <div className="flex flex-col items-center py-2 space-y-4">
              {/* High-Fidelity Printable Card */}
              <div
                ref={printCardRef}
                className="w-72 overflow-hidden rounded-2xl bg-white text-slate-900 border-2 border-slate-200 shadow-2xl flex flex-col items-center text-center pb-5"
              >
                <div
                  className={`h-3 w-full ${
                    selectedQrForPrint.network.includes("Equity")
                      ? "bg-rose-800"
                      : selectedQrForPrint.network.includes("Airtel")
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
                    {selectedQrForPrint.business_name}
                  </h3>

                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                    <span>{selectedQrForPrint.network}</span>
                  </div>

                  {/* QR Code */}
                  <div className="mt-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-md">
                    <QRCodeSVG
                      value={
                        selectedQrForPrint.is_dynamic
                          ? `${window.location.origin}/p/${selectedQrForPrint.id}`
                          : `tel:${selectedQrForPrint.dial_code}`
                      }
                      size={180}
                      level="H"
                    />
                  </div>

                  {/* Dial Code Display */}
                  <div className="mt-3 w-full rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      {selectedQrForPrint.payment_type === "momo_code"
                        ? "Merchant Pay Code"
                        : "Recipient Phone"}
                    </p>
                    <p className="font-mono text-sm font-black text-slate-950">
                      {selectedQrForPrint.dial_code}
                    </p>
                  </div>

                  {selectedQrForPrint.amount && (
                    <div className="mt-2 w-full rounded-xl bg-amber-50 border border-amber-200 px-3 py-1">
                      <p className="text-[10px] font-bold text-amber-800 uppercase">
                        {selectedQrForPrint.item_name || "Fixed Amount"}
                      </p>
                      <p className="text-base font-black text-slate-900">
                        {selectedQrForPrint.amount.toLocaleString()} RWF
                      </p>
                    </div>
                  )}

                  <p className="mt-2.5 text-[10px] text-slate-500">
                    Scan with camera &amp; tap Call to pay • Ishyura.rw
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={handleDownloadPrintCard}
                  disabled={downloadingCard}
                  variant="outline"
                  className="w-full text-xs font-bold gap-1.5 rounded-xl border-border"
                >
                  {downloadingCard ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>{downloadingCard ? "Saving..." : "Download PNG"}</span>
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
    </div>
  );
}
