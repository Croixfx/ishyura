import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, MessageSquare, QrCode, LogIn } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { InquiryDialog } from "@/components/InquiryDialog";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { type UserProfile, isAdminUser, knownPhone } from "@/lib/ishyura-client";
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
  /** A message shown across the top of the page (for example after an account was deactivated). */
  notice?: string;
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
  notice,
}: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [publicNavOpen, setPublicNavOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  // 0. AUTH HYDRATION SKELETON: Display clean app shell skeleton during initial load/refresh
  if (isAuthLoading) {
    return <AppShellSkeleton />;
  }

  // 1. UNLOGGED VISITOR: Flawlessly scrollable layout with fixed header & dedicated scroll viewport
  if (!currentUser) {
    const scrollToSection = (id: string) => {
      setPublicNavOpen(false);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    };

    return (
      <div className="h-dvh max-h-dvh w-full bg-background text-foreground flex flex-col overflow-hidden">
        {notice && (
          <div
            role="alert"
            className="shrink-0 bg-destructive px-4 py-2.5 text-center text-xs font-bold text-destructive-foreground"
          >
            {notice}
          </div>
        )}
        {/* Public Top Header */}
        <header className="z-40 border-b border-border/60 bg-background/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3">
            <div className="size-8 sm:size-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm shadow-xs">
              <QrCode className="size-4.5 sm:size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight">Ishyura</span>
                <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
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
              onClick={() => scrollToSection("products")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("how-it-works")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("hardware-section")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Stands &amp; Hardware
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("pricing")}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("faq")}
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
              className="hidden sm:inline-flex text-xs font-bold h-8.5 rounded-xl px-3 sm:px-4 border-border/80 hover:bg-muted"
            >
              <LogIn className="size-3.5 sm:mr-1.5" />
              <span>Sign In</span>
            </Button>
            <Button
              size="sm"
              onClick={onOpenAuthDialog}
              className="text-xs font-bold h-8.5 rounded-xl px-3.5 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              Get Started
            </Button>
            {/* Mobile Icon for remaining navigation links */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden size-8.5 p-0 rounded-xl border border-border/80 text-foreground"
              onClick={() => setPublicNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="size-4.5" />
            </Button>
          </div>
        </header>

        {/* Mobile Navigation Drawer for Unlogged Visitors */}
        {publicNavOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setPublicNavOpen(false)}
            />
            <div className="relative z-50 ml-auto w-72 max-w-[80vw] h-full bg-card border-l border-border p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-foreground text-background flex items-center justify-center font-black text-xs">
                      <QrCode className="size-4" />
                    </div>
                    <span className="font-extrabold text-sm">Ishyura Rwanda</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 rounded-lg"
                    onClick={() => setPublicNavOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <nav className="flex flex-col gap-2.5 text-sm font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => scrollToSection("products")}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>Products</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("how-it-works")}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>How It Works</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("hardware-section")}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>Stands &amp; Hardware</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("pricing")}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>Pricing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("faq")}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>FAQ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPublicNavOpen(false);
                      setInquiryOpen(true);
                    }}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left hover:text-foreground hover:bg-muted/50 transition-colors text-sky-600 dark:text-sky-400 font-bold"
                  >
                    <MessageSquare className="size-4" />
                    <span>Contact Support</span>
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t border-border/60 space-y-2">
                <Button
                  variant="outline"
                  className="w-full text-xs font-bold rounded-xl h-9.5 justify-center gap-1.5"
                  onClick={() => {
                    setPublicNavOpen(false);
                    if (onOpenAuthDialog) onOpenAuthDialog();
                  }}
                >
                  <LogIn className="size-3.5" />
                  <span>Sign In</span>
                </Button>
                <Button
                  className="w-full text-xs font-bold rounded-xl h-9.5 bg-primary text-primary-foreground justify-center"
                  onClick={() => {
                    setPublicNavOpen(false);
                    if (onOpenAuthDialog) onOpenAuthDialog();
                  }}
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}

        <main
          id="ishyura-public-scroll"
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
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
        defaultPhone={knownPhone(currentUser) || undefined}
      />
    </div>
  );
}
