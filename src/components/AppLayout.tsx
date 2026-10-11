import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, MessageSquare, QrCode, LogIn } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { InquiryDialog } from "@/components/InquiryDialog";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { type UserProfile, isAdminUser } from "@/lib/ishyura-client";
import { Button } from "@/components/ui/button";
import { AppShellSkeleton } from "@/components/AppShellSkeleton";

interface AppLayoutProps {
  children: React.ReactNode;
  currentUser?: UserProfile | null;
  onUserChange?: (user: UserProfile | null) => void;
  onOpenAuthDialog?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  inquiryCount?: number;
  orderCount?: number;
  isAuthLoading?: boolean;
}

export function AppLayout({
  children,
  currentUser,
  onUserChange,
  onOpenAuthDialog,
  activeTab = "generator",
  onSelectTab,
  inquiryCount = 0,
  orderCount = 0,
  isAuthLoading = false,
}: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  // 0. AUTH HYDRATION SKELETON: Display clean app shell skeleton during initial load/refresh
  if (isAuthLoading) {
    return <AppShellSkeleton />;
  }

  // 1. UNLOGGED VISITOR: Flawlessly scrollable layout with fixed header & dedicated scroll viewport
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        {/* Public Top Header */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm shadow-xs">
              <QrCode className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight">Ishyura</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                  Rwanda
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Counter Payment QR &amp; Smart Stands
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("hardware-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Stands &amp; Hardware
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton />
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenAuthDialog}
              className="text-xs font-bold h-8.5 rounded-xl px-3 sm:px-4 border-border/80 hover:bg-muted"
            >
              <LogIn className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
            <Button
              size="sm"
              onClick={onOpenAuthDialog}
              className="text-xs font-bold h-8.5 rounded-xl px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              Get Started
            </Button>
          </div>
        </header>

        {/* Natural page flow ensuring smooth full-page scrolling without clipping or double scroll */}
        <main className="flex-1 w-full">
          {children}
        </main>

        <InquiryDialog open={inquiryOpen} onOpenChange={setInquiryOpen} defaultPhone={undefined} />
      </div>
    );
  }

  // 2. AUTHENTICATED USER (Admin or Merchant): Premium UI with Left Tab
  return (
    <div className="fixed inset-0 w-full h-full bg-background text-foreground overflow-hidden flex">
      {/* Desktop Left Sidebar (Fixed & Scrollable on its own) */}
      <div className="hidden lg:flex h-full shrink-0">
        <AppSidebar
          currentUser={currentUser}
          onUserChange={onUserChange}
          onOpenAuthDialog={onOpenAuthDialog}
          onOpenInquiry={() => setInquiryOpen(true)}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          inquiryCount={inquiryCount}
          orderCount={orderCount}
        />
      </div>

      {/* Mobile Drawer Navigation Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] h-full bg-card shadow-2xl flex flex-col">
            <div className="absolute top-3 right-3 z-10">
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <AppSidebar
              currentUser={currentUser}
              onUserChange={(user) => {
                if (onUserChange) onUserChange(user);
                setMobileNavOpen(false);
              }}
              onOpenAuthDialog={() => {
                if (onOpenAuthDialog) onOpenAuthDialog();
                setMobileNavOpen(false);
              }}
              onOpenInquiry={() => {
                setMobileNavOpen(false);
                setInquiryOpen(true);
              }}
              onNavigate={() => setMobileNavOpen(false)}
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              inquiryCount={inquiryCount}
              orderCount={orderCount}
            />
          </div>
        </div>
      )}

      {/* Main Window: Scrollable independently next to left tab */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Mobile Header only (hidden on desktop) */}
        <header className="flex items-center justify-between border-b border-border/50 bg-card/60 backdrop-blur-md px-4 py-2.5 lg:hidden shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="size-8 p-0 rounded-lg"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                I
              </div>
              <span className="font-extrabold text-sm tracking-tight">Ishyura</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            {!isAdminUser(currentUser) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInquiryOpen(true)}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <MessageSquare className="size-3.5 text-sky-500" />
                <span className="text-xs">Support</span>
              </Button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>

      {/* Global Inquiry Dialog accessible for merchants */}
      <InquiryDialog
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        defaultPhone={currentUser?.phone_number}
      />
    </div>
  );
}
