import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Global capture for beforeinstallprompt in case it fires before React mount
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt =
      e as BeforeInstallPromptEvent;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== "undefined") {
      return (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt || null;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed or running in PWA window)
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);
    setIsInstalled(isStandalone);

    // Detect iOS devices
    if (typeof window !== "undefined") {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const p = e as BeforeInstallPromptEvent;
      (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt = p;
      setDeferredPrompt(p);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== "undefined") {
        delete (window as unknown as { __pwaPrompt?: unknown }).__pwaPrompt;
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const promptToUse =
      deferredPrompt ||
      (typeof window !== "undefined"
        ? (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt
        : null);

    if (!promptToUse) return false;

    try {
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          delete (window as unknown as { __pwaPrompt?: unknown }).__pwaPrompt;
        }
        return true;
      }
    } catch (err) {
      console.warn("PWA prompt error:", err);
    }
    return false;
  };

  return {
    isInstallable: !!(
      deferredPrompt ||
      (typeof window !== "undefined" &&
        (window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent }).__pwaPrompt)
    ),
    isInstalled,
    isIOS,
    install,
  };
}
