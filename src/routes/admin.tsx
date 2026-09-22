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
} from "lucide-react";
import {
  IshyuraClient,
  type AdminStats,
  type MerchantRecord,
  type InquiryRecord,
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

      const [merchantsList, inquiriesList] = await Promise.all([
        IshyuraClient.getAdminMerchants(keyToUse).catch(() => []),
        IshyuraClient.getAdminInquiries(keyToUse).catch(() => []),
      ]);
      setMerchants(merchantsList);
      setInquiries(inquiriesList);
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
      console.error("Failed to toggle status:", err);
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
                Secure Owner Management & Platform Reporting
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
                This is a restricted URL. Enter your administrative passcode to access merchant
                records, inquiries, and analytics.
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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-semibold">Registered Merchants</span>
                  <Users className="size-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-foreground">
                  {stats?.total_merchants ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">● Active</span>
                  <span>Soft &amp; full accounts</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-semibold">QR Payment Cards</span>
                  <QrCode className="size-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-foreground">
                  {stats?.total_qr_codes ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Total generated across networks
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-semibold">Inquiries / Support</span>
                  <MessageSquare className="size-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">
                    {stats?.total_inquiries ?? 0}
                  </span>
                  {(stats?.new_inquiries ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {stats?.new_inquiries} new
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Pending customer questions
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="text-xs font-semibold">Backend Engine</span>
                  <Database className="size-4 text-purple-500" />
                </div>
                <div className="text-sm font-bold text-foreground truncate mt-1">
                  {stats?.database_type || "Cloudflare D1"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Edge SQL synchronized</span>
                </div>
              </div>
            </div>

            {/* Admin Tabs */}
            <Tabs defaultValue="inquiries" className="w-full">
              <TabsList className="grid grid-cols-4 w-full h-10">
                <TabsTrigger value="inquiries" className="text-xs">
                  Inquiries ({inquiries.length})
                </TabsTrigger>
                <TabsTrigger value="merchants" className="text-xs">
                  Merchants ({merchants.length})
                </TabsTrigger>
                <TabsTrigger value="networks" className="text-xs">
                  Networks
                </TabsTrigger>
                <TabsTrigger value="export" className="text-xs">
                  CSV Export
                </TabsTrigger>
              </TabsList>

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
                              {inq.status === "new" ? "Mark Resolved" : "Reopen"}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/40">
                          <p className="font-semibold text-foreground">{inq.subject}</p>
                          <p className="mt-1 text-muted-foreground leading-relaxed whitespace-pre-wrap">
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
                    Merchants &amp; Users Registry
                  </h2>
                  <span className="text-xs text-muted-foreground">{merchants.length} total</span>
                </div>

                <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border/60">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Phone Number</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold">Cards Saved</th>
                          <th className="py-3 px-4 font-semibold">Registered</th>
                          <th className="py-3 px-4 font-semibold">Last Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {merchants.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              No merchant accounts found.
                            </td>
                          </tr>
                        ) : (
                          merchants.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/20">
                              <td className="py-3 px-4 font-bold text-foreground">
                                {m.phone_number}
                              </td>
                              <td className="py-3 px-4">
                                {m.is_fully_registered ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                                    <CheckCircle2 className="size-3" /> Full Account
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                                    <Clock className="size-3" /> Soft Verified
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold">{m.qr_count ?? 1}</td>
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

              {/* CSV EXPORT TAB */}
              <TabsContent value="export" className="mt-4 space-y-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Data Exports for Administration &amp; Accounting
                </h2>
                <p className="text-xs text-muted-foreground">
                  Export complete data records formatted for Microsoft Excel, Google Sheets, or
                  reporting.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <a
                    href={IshyuraClient.getAdminExportUrl(adminKey, "merchants")}
                    download="merchants_report.csv"
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                  >
                    <Download className="size-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Export Merchants</p>
                      <p className="text-[10px] text-muted-foreground">
                        Phone numbers &amp; registration dates
                      </p>
                    </div>
                  </a>

                  <a
                    href={IshyuraClient.getAdminExportUrl(adminKey, "qrs")}
                    download="qr_codes_report.csv"
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                  >
                    <Download className="size-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Export QR Cards</p>
                      <p className="text-[10px] text-muted-foreground">
                        All generated codes &amp; networks
                      </p>
                    </div>
                  </a>

                  <a
                    href={IshyuraClient.getAdminExportUrl(adminKey, "inquiries")}
                    download="inquiries_report.csv"
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors text-center gap-2"
                  >
                    <Download className="size-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Export Inquiries</p>
                      <p className="text-[10px] text-muted-foreground">
                        Customer questions &amp; feedback
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
