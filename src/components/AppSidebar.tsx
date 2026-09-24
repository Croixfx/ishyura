import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  QrCode,
  Package,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
  ShoppingBag,
  Store,
  MessageSquare,
  Sparkles,
  Smartphone,
  CreditCard,
  Building2,
  Clock,
  HelpCircle,
  ChevronRight,
  Users,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IshyuraClient, type UserProfile, isAdminUser } from "@/lib/ishyura-client";

interface AppSidebarProps {
  currentUser?: UserProfile | null;
  onUserChange?: (user: UserProfile | null) => void;
  onOpenAuthDialog?: () => void;
  onOpenInquiry?: () => void;
  onNavigate?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  inquiryCount?: number;
  orderCount?: number;
}

export function AppSidebar({
  currentUser: initialUser,
  onUserChange,
  onOpenAuthDialog,
  onOpenInquiry,
  onNavigate,
  activeTab = "generator",
  onSelectTab,
  inquiryCount = 0,
  orderCount = 0,
}: AppSidebarProps) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(initialUser || null);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = initialUser !== undefined ? initialUser : IshyuraClient.getCurrentUser();
    setCurrentUser(user);

    try {
      const theme = localStorage.getItem("ishyura-theme");
      const isDarkMode = theme !== "light";
      setIsDark(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // ignore
    }
  }, [initialUser]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("ishyura-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("ishyura-theme", "light");
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const { signInWithGoogleReal } = await import("@/lib/firebase-auth");
      const googleRes = await signInWithGoogleReal();
      if (googleRes?.email) {
        const user = await IshyuraClient.signInWithGoogle({
          email: googleRes.email,
          name: googleRes.name || googleRes.email.split("@")[0],
          sub: googleRes.uid,
        });
        setCurrentUser(user);
        if (onUserChange) onUserChange(user);
      }
    } catch (err) {
      console.error("Sidebar Google Sign-in error:", err);
      if (onOpenAuthDialog) {
        onOpenAuthDialog();
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { logoutGoogle } = await import("@/lib/firebase-auth");
      await logoutGoogle();
    } catch {
      // ignore
    }
    IshyuraClient.logout();
    setCurrentUser(null);
    if (onUserChange) onUserChange(null);
  };

  const isAdmin = mounted && isAdminUser(currentUser);

  const handleTabClick = (tabKey: string) => {
    if (onSelectTab) {
      onSelectTab(tabKey);
    }
    onNavigate?.();
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen border-r border-border/60 bg-card/60 backdrop-blur-xl select-none">
      {/* 1. Sticky Brand Header */}
      <div className="p-4 border-b border-border/40 shrink-0">
        <Link
          to="/"
          onClick={() => {
            handleTabClick(isAdmin ? "inquiries" : "generator");
          }}
          className="flex items-center gap-3 group"
        >
          <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0 font-bold text-sm">
            <QrCode className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base tracking-tight text-foreground">Ishyura</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                RW
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {isAdmin ? "Admin Operations Portal" : "Payment QR & Stand Studio"}
            </p>
          </div>
        </Link>
      </div>

      {/* 2. Independently Scrollable Left Tab Navigation List */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-5">
        {/* ADMIN EXCLUSIVE NAVIGATION */}
        {isAdmin ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-black tracking-wider text-primary uppercase">
                Admin Control
              </p>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                Privileged
              </span>
            </div>

            {/* 1. Client Messages / Inquiries (Critical) */}
            <button
              type="button"
              onClick={() => handleTabClick("inquiries")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "inquiries"
                  ? "bg-sky-500 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MessageSquare className="size-4 shrink-0 text-sky-400 group-hover:scale-105" />
                <span className="truncate">Client Messages</span>
              </div>
              {inquiryCount > 0 ? (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950">
                  {inquiryCount}
                </span>
              ) : (
                <span className="text-[9px] opacity-70">Inbox</span>
              )}
            </button>

            {/* 2. Merchandise Orders */}
            <button
              type="button"
              onClick={() => handleTabClick("orders")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "orders"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Package className="size-4 shrink-0 text-emerald-400 group-hover:scale-105" />
                <span className="truncate">Stand & Sticker Orders</span>
              </div>
              {orderCount > 0 ? (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950">
                  {orderCount}
                </span>
              ) : (
                <span className="text-[9px] opacity-70">Orders</span>
              )}
            </button>

            {/* 3. Single Generation QR Registry */}
            <button
              type="button"
              onClick={() => handleTabClick("qrs")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "qrs"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <QrCode className="size-4 shrink-0 text-amber-400 group-hover:scale-105" />
                <span className="truncate">Merchant QR Registry</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Active
              </span>
            </button>

            {/* 4. Merchants Directory */}
            <button
              type="button"
              onClick={() => handleTabClick("merchants")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "merchants"
                  ? "bg-purple-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="size-4 shrink-0 text-purple-400 group-hover:scale-105" />
                <span className="truncate">Merchants Directory</span>
              </div>
            </button>

            {/* 5. Platform Admins */}
            <button
              type="button"
              onClick={() => handleTabClick("admins")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "admins"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="size-4 shrink-0 text-rose-400 group-hover:scale-105" />
                <span className="truncate">System Admins</span>
              </div>
            </button>

            {/* 6. System & Audit Logs */}
            <button
              type="button"
              onClick={() => handleTabClick("logs")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                activeTab === "logs"
                  ? "bg-muted text-foreground shadow-xs font-bold border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="size-4 shrink-0 text-muted-foreground group-hover:scale-105" />
                <span className="truncate">Audit & Export Logs</span>
              </div>
            </button>
          </div>
        ) : (
          /* MERCHANT NAVIGATION */
          <div className="space-y-4">
            {/* Merchant Tools Section */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-black tracking-wider text-muted-foreground/70 uppercase mb-1.5">
                Merchant Studio
              </p>

              {/* 1. Payment QR Generator */}
              <button
                type="button"
                onClick={() => handleTabClick("generator")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                  activeTab === "generator"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <QrCode
                    className={`size-4 shrink-0 ${
                      activeTab === "generator"
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  <span className="truncate">Payment Tent Card</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    activeTab === "generator"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Generator
                </span>
              </button>

              {/* 2. My Cards & Records (Without rendering actual QR) */}
              <button
                type="button"
                onClick={() => handleTabClick("records")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                  activeTab === "records"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CreditCard
                    className={`size-4 shrink-0 ${
                      activeTab === "records"
                        ? "text-primary-foreground"
                        : "text-sky-500 group-hover:text-foreground"
                    }`}
                  />
                  <span className="truncate">My Cards & Records</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    activeTab === "records"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  }`}
                >
                  Saved
                </span>
              </button>
            </div>

            {/* Physical Stands & Merchandise Section */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-black tracking-wider text-muted-foreground/70 uppercase mb-1.5">
                Counter Hardware
              </p>

              <button
                type="button"
                onClick={() => handleTabClick("store")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                  activeTab === "store"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShoppingBag
                    className={`size-4 shrink-0 ${
                      activeTab === "store" ? "text-primary-foreground" : "text-emerald-500"
                    }`}
                  />
                  <span className="truncate">Stands & Stickers</span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    activeTab === "store"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  Order
                </span>
              </button>
            </div>

            {/* Support Section for Merchants */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-black tracking-wider text-muted-foreground/70 uppercase mb-1.5">
                Support
              </p>

              <button
                type="button"
                onClick={() => {
                  if (onOpenInquiry) {
                    onOpenInquiry();
                  }
                  onNavigate?.();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="size-4 text-sky-500" />
                  <span>Contact Ishyura Support</span>
                </div>
                <ChevronRight className="size-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Sticky User Profile & Theme Settings at Bottom */}
      <div className="p-3 border-t border-border/40 bg-muted/10 shrink-0 space-y-2">
        {mounted && currentUser ? (
          <div className="p-2.5 rounded-xl border border-border/60 bg-background/80 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`size-7 rounded-full flex items-center justify-center shrink-0 font-black text-xs ${
                    isAdmin
                      ? "bg-rose-500/15 border border-rose-500/30 text-rose-500"
                      : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isAdmin ? "A" : currentUser.email ? currentUser.email[0].toUpperCase() : "M"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {currentUser.name || currentUser.email || currentUser.phone_number}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isAdmin
                      ? currentUser.email === "jeanniyonkuru29@gmail.com"
                        ? "Superadmin (Owner)"
                        : "System Admin"
                      : "Merchant Account"}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full h-7 text-[11px] text-muted-foreground hover:text-red-500 justify-start px-2 gap-1.5"
            >
              <LogOut className="size-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        ) : (
          <div>
            <Button
              size="sm"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full h-8 text-xs font-bold gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
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
          </div>
        )}

        {/* Currency & Theme Toggle */}
        <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-muted-foreground">
          <span className="font-semibold text-[10px]">Rwanda · RWF</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-muted transition-colors text-foreground"
            title="Toggle theme"
          >
            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
