import type { PaymentMode, QrEncoding, StandStatus } from "./types";

/**
 * Public stand token derived from the internal id but not equal to it.
 * Matches SQL backfill: 'ish_' || substr(replace(id, '-', ''), 1, 16)
 */
export function publicIdFromInternalId(internalId: string): string {
  const hex = (internalId || "").replace(/-/g, "");
  const slice = hex.slice(0, 16) || "0".repeat(16);
  return `ish_${slice}`;
}

export function inferPaymentMode(amount?: number | null): PaymentMode {
  if (typeof amount === "number" && !isNaN(amount) && amount > 0) {
    return "FIXED_AMOUNT";
  }
  return "CUSTOMER_AMOUNT";
}

export function inferQrEncoding(isDynamic?: boolean | number | null): QrEncoding {
  return isDynamic ? "https_pay" : "tel_ussd";
}

export function isStandPayable(status?: StandStatus | string | null): boolean {
  return !status || status === "active";
}

/**
 * CUSTOMER_AMOUNT offline limitation (existing USSD syntax):
 * Networks in this repo support a no-amount string (*182*8*1*CODE# / *555*2*CODE#)
 * so the telco menu collects the amount. Arbitrary keypad entry on the stand
 * is an online-only Ishyura UI, not an offline USSD feature.
 */
export const CUSTOMER_AMOUNT_OFFLINE_NOTE =
  "Offline CUSTOMER_AMOUNT uses the provider USSD menu (no amount in the string). Ishyura amount entry requires the online /p/:id page.";
