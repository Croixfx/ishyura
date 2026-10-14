import type {
  EntitlementStatus,
  EntitlementType,
  PaymentRequestProductType,
  PaymentRequestStatus,
} from "./types";

/**
 * Check if a merchant is entitled to generate an offline QR stand.
 * 1st generation is included free for registered merchants (granted >= 1).
 * Subsequent generations require approved entitlements.
 */
export function canGenerateOffline(granted: number, consumed: number): boolean {
  if (!Number.isSafeInteger(granted) || granted < 1) return false;
  return consumed < granted;
}

/**
 * Check if a merchant is entitled to download an official PDF print card.
 */
export function canDownloadPdf(granted: number, consumed: number): boolean {
  if (!Number.isSafeInteger(granted) || granted < 1) return false;
  return consumed < granted;
}

/**
 * Check if PRO subscription is currently active.
 */
export function isProActive(
  entitlement?: {
    status: EntitlementStatus | string;
    expires_at?: string | null;
  } | null,
): boolean {
  if (!entitlement) return false;
  if (entitlement.status !== "active") return false;
  if (!entitlement.expires_at) return true; // Lifetime or open-ended active
  const expiry = new Date(entitlement.expires_at).getTime();
  return !isNaN(expiry) && expiry > Date.now();
}

/**
 * Generate a collision-resistant, human-friendly payment request reference.
 * Example: 'PAY-839201'
 */
export function generateRequestReference(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `PAY-${num}`;
}

export function formatProductTypeLabel(type: PaymentRequestProductType): string {
  switch (type) {
    case "offline_generation":
      return "Additional Offline QR Stand";
    case "pdf_download":
      return "Printable PDF Download Output";
    case "pro_subscription":
      return "Ishyura PRO Monthly Subscription";
    case "physical_stand":
      return "Physical Merchant Stand";
    default:
      return type;
  }
}
