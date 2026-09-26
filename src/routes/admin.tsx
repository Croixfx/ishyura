import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import { IshyuraClient, type UserProfile, isAdminUser } from "@/lib/ishyura-client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogIn, Loader2 } from "lucide-react";
import { signInWithGoogleReal } from "@/lib/firebase-auth";

interface AdminSearch {
  tab?: string;
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    return {
      tab: (search.tab as string) || "inquiries",
    };
  },
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

function AdminPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(searchParams.tab || "inquiries");

  useEffect(() => {
    const user = IshyuraClient.getSavedUser();
    setCurrentUser(user);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (searchParams.tab) {
      setActiveTab(searchParams.tab);
    }
  }, [searchParams.tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate({ to: "/admin", search: { tab } });
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const googleRes = await signInWithGoogleReal();
      if (googleRes?.email) {
        const user = await IshyuraClient.signInWithGoogle({
          email: googleRes.email,
          name: googleRes.name || googleRes.email.split("@")[0],
          sub: googleRes.uid,
        });
        setCurrentUser(user);
      }
    } catch (err) {
      console.error("Admin sign in failed", err);
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // If not admin:
  if (!currentUser || !isAdminUser(currentUser)) {
    return (
      <AppLayout currentUser={currentUser} onUserChange={setCurrentUser}>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl border border-border/80 bg-card shadow-2xl text-center space-y-4">
            <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="size-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                Admin Access Required
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                This portal is strictly restricted to platform administrators assigned in the system
                registry. Please sign in with an authorized email (e.g. jeanniyonkuru29@gmail.com).
              </p>
            </div>
            <Button
              onClick={handleGoogleSignIn}
              className="w-full h-10 text-xs font-bold gap-2 rounded-xl shadow-md"
            >
              <LogIn className="size-4" />
              <span>Sign In with Admin Google Account</span>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      currentUser={currentUser}
      onUserChange={setCurrentUser}
      activeTab={activeTab}
      onSelectTab={handleTabChange}
    >
      <div className="p-4 sm:p-6 lg:p-8">
        <AdminWorkspace
          activeTab={activeTab}
          currentUser={currentUser}
          onTabChange={handleTabChange}
        />
      </div>
    </AppLayout>
  );
}
