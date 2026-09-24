import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, MessageSquare, QrCode } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { InquiryDialog } from "@/components/InquiryDialog";
import { type UserProfile } from "@/lib/ishyura-client";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
  currentUser?: UserProfile | null;
  onUserChange?: (user: UserProfile | null) => void;
  onOpenAuthDialog?: () => void;
}

export function AppLayout({
  children,
  currentUser,
  onUserChange,
  onOpenAuthDialog,
}: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Desktop Left Sidebar (Fixed & Scrollable on its own) */}
      <div className="hidden lg:flex h-full shrink-0">
        <AppSidebar
          currentUser={currentUser}
          onUserChange={onUserChange}
          onOpenAuthDialog={onOpenAuthDialog}
          onOpenInquiry={() => setInquiryOpen(true)}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInquiryOpen(true)}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <MessageSquare className="size-3.5 text-sky-500" />
              <span className="text-xs">Support</span>
            </Button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>

      {/* Global Inquiry Dialog accessible from all screens */}
      <InquiryDialog
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        defaultPhone={currentUser?.phone_number}
      />
    </div>
  );
}
