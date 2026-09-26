/**
 * Rwanda Mobile Money & USSD Formatter Utilities
 * Ensures accurate extraction and formatting of Merchant Codes (MoMo Pay / Airtel Money / Equity eKash)
 * and eliminates duplicate prefix bugs (e.g. prepending 18281 to 729710).
 */

export interface ParsedPaymentCode {
  cleanCode: string;
  amount: number | null;
  paymentType: "momo_code" | "phone";
  network: "MTN MoMo" | "Airtel Money" | "Equity Bank (eKash)";
  ussdString: string;
}

/**
 * Extracts ONLY the pure merchant code or phone number from a USSD string or contaminated digit string.
 *
 * Examples:
 *   "*182*8*1*729710#"       -> "729710"
 *   "*182*8*1*729710*5000#"  -> "729710"
 *   "18281729710"            -> "729710"
 *   "*182*1*1*0788123456#"   -> "0788123456"
 *   "*555*2*729710#"         -> "729710"
 *   "729710"                 -> "729710"
 */
export function extractMerchantOrAccountCode(
  rawInput: string | undefined | null,
  fallback: string | null | undefined = "",
): string {
  const safeFallback = fallback || "";
  if (!rawInput) return safeFallback;
  const trimmed = rawInput.trim();
  if (!trimmed) return safeFallback;

  // 1. MoMo Pay / Airtel Merchant: *182*8*1*<CODE># or *182*8*1*<CODE>*<AMOUNT>#
  const momoMerchantMatch = trimmed.match(/^\*182\*8\*1\*([0-9A-Za-z]+)(?:\*[0-9]+)?#/);
  if (momoMerchantMatch && momoMerchantMatch[1]) {
    return momoMerchantMatch[1];
  }

  // 2. MoMo / Airtel P2P Phone: *182*1*1*<PHONE># or *182*1*1*<PHONE>*<AMOUNT>#
  const momoPhoneMatch = trimmed.match(/^\*182\*1\*1\*([0-9]+)(?:\*[0-9]+)?#/);
  if (momoPhoneMatch && momoPhoneMatch[1]) {
    return momoPhoneMatch[1];
  }

  // 3. Equity Bank eKash: *555*2*<CODE># or *555*2*<CODE>*<AMOUNT>#
  const ekashMatch = trimmed.match(/^\*555\*2\*([0-9A-Za-z]+)(?:\*[0-9]+)?#/);
  if (ekashMatch && ekashMatch[1]) {
    return ekashMatch[1];
  }

  // 4. Generic USSD pattern *...*<CODE># or *...*<CODE>*<AMOUNT>#
  const genericMatch = trimmed.match(/\*([0-9]{4,12})(?:\*[0-9]+)?#/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1];
  }

  // 5. If pure digits or alphanumeric code (e.g. "729710" or "0788123456")
  // Check if it starts with the legacy mashed prefixes:
  // "18281" + "729710" -> length 11 -> return "729710"
  const digitsOnly = trimmed.replace(/[^0-9]/g, "");

  if (digitsOnly.startsWith("18281") && digitsOnly.length > 5) {
    const candidate = digitsOnly.slice(5);
    if (candidate.length >= 4 && candidate.length <= 10) {
      return candidate;
    }
  }

  if (digitsOnly.startsWith("18211") && digitsOnly.length > 5) {
    const candidate = digitsOnly.slice(5);
    if (candidate.length >= 8 && candidate.length <= 12) {
      return candidate;
    }
  }

  if (digitsOnly.startsWith("5552") && digitsOnly.length > 4) {
    const candidate = digitsOnly.slice(4);
    if (candidate.length >= 4 && candidate.length <= 12) {
      return candidate;
    }
  }

  // If already clean code
  if (digitsOnly.length > 0) {
    return digitsOnly;
  }

  return trimmed || safeFallback;
}

/**
 * Builds the canonical Rwandan USSD dial string without prefix duplication.
 */
export function buildRwandaUssdString(
  network: string,
  paymentType: "momo_code" | "phone" | string,
  cleanCode: string,
  amount?: number | null,
): string {
  const code = extractMerchantOrAccountCode(cleanCode);
  const net = (network || "").toLowerCase();
  const numAmount =
    typeof amount === "number" && !isNaN(amount) && amount > 0 ? Math.round(amount) : null;

  if (net.includes("equity") || net.includes("ekash")) {
    return numAmount ? `*555*2*${code}*${numAmount}#` : `*555*2*${code}#`;
  }

  if (paymentType === "phone") {
    return numAmount ? `*182*1*1*${code}*${numAmount}#` : `*182*1*1*${code}#`;
  }

  // Default: MoMo Pay / Airtel Merchant Code
  return numAmount ? `*182*8*1*${code}*${numAmount}#` : `*182*8*1*${code}#`;
}

export interface MultiNetworkUssdOptions {
  cleanCode: string;
  amount: number | null;
  paymentType: "momo_code" | "phone" | string;
  mtnUssd: string;
  airtelUssd: string;
  equityUssd: string;
}

/**
 * Returns formatted USSD dial strings for all three major Rwandan payment networks (MTN, Airtel, Equity eKash)
 * for a given merchant/recipient code.
 */
export function getAllNetworkDialStrings(
  rawCode: string,
  amount?: number | null,
  paymentType: "momo_code" | "phone" | string = "momo_code",
): MultiNetworkUssdOptions {
  const cleanCode = extractMerchantOrAccountCode(rawCode);
  const numAmount =
    typeof amount === "number" && !isNaN(amount) && amount > 0 ? Math.round(amount) : null;

  const mtnUssd =
    paymentType === "phone"
      ? numAmount
        ? `*182*1*1*${cleanCode}*${numAmount}#`
        : `*182*1*1*${cleanCode}#`
      : numAmount
        ? `*182*8*1*${cleanCode}*${numAmount}#`
        : `*182*8*1*${cleanCode}#`;

  const airtelUssd =
    paymentType === "phone"
      ? numAmount
        ? `*182*1*1*${cleanCode}*${numAmount}#`
        : `*182*1*1*${cleanCode}#`
      : numAmount
        ? `*182*8*1*${cleanCode}*${numAmount}#`
        : `*182*8*1*${cleanCode}#`;

  const equityUssd = numAmount ? `*555*2*${cleanCode}*${numAmount}#` : `*555*2*${cleanCode}#`;

  return {
    cleanCode,
    amount: numAmount,
    paymentType,
    mtnUssd,
    airtelUssd,
    equityUssd,
  };
}

export type DetectedCarrier = "mtn" | "airtel" | "equity" | "unknown";

/**
 * Inspects request headers, Cloudflare ASN / AS Organization, and client IP
 * to automatically determine if the person scanning the QR code is on MTN Rwanda, Airtel Rwanda, or Equity eKash.
 */
export function detectCarrierFromRequest(request: Request): {
  detected: DetectedCarrier;
  carrierName: string;
  source: string;
} {
  try {
    const url = new URL(request.url);
    const qCarrier = (
      url.searchParams.get("carrier") ||
      url.searchParams.get("sim") ||
      url.searchParams.get("net") ||
      ""
    ).toLowerCase();

    if (qCarrier.includes("mtn"))
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "parameter" };
    if (qCarrier.includes("airtel"))
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "parameter" };
    if (qCarrier.includes("equity") || qCarrier.includes("ekash"))
      return { detected: "equity", carrierName: "Equity Bank eKash", source: "parameter" };

    // Check cookie preference if scanner visited before
    const cookie = request.headers.get("cookie") || "";
    if (cookie.includes("ishyura_scanner_sim=airtel")) {
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "cookie" };
    }
    if (cookie.includes("ishyura_scanner_sim=equity")) {
      return { detected: "equity", carrierName: "Equity Bank eKash", source: "cookie" };
    }
    if (cookie.includes("ishyura_scanner_sim=mtn")) {
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "cookie" };
    }

    // Check operator / carrier headers from telecom gateways & proxies
    const carrierHeader = (
      request.headers.get("x-carrier") ||
      request.headers.get("x-operator") ||
      request.headers.get("x-network-info") ||
      request.headers.get("x-up-calling-line-id") ||
      ""
    ).toLowerCase();

    if (carrierHeader.includes("mtn") || carrierHeader.includes("rwandacell")) {
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "carrier_header" };
    }
    if (carrierHeader.includes("airtel") || carrierHeader.includes("tigo")) {
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "carrier_header" };
    }
    if (carrierHeader.includes("equity") || carrierHeader.includes("ekash")) {
      return { detected: "equity", carrierName: "Equity Bank eKash", source: "carrier_header" };
    }

    const cf = (request as unknown as { cf?: Record<string, unknown> }).cf;
    const asOrg = String(cf?.asOrganization || "").toLowerCase();
    const asn = Number(cf?.asn || 0);

    // 1. MTN Rwanda Network (AS37075, AS37228, AS36947)
    if (
      asOrg.includes("mtn") ||
      asOrg.includes("rwandacell") ||
      asOrg.includes("scancom") ||
      asn === 37075 ||
      asn === 37228 ||
      asn === 36947
    ) {
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "network_asn" };
    }

    // 2. Airtel Rwanda Network (AS37153, AS37340, Tigo)
    if (
      asOrg.includes("airtel") ||
      asOrg.includes("tigo") ||
      asOrg.includes("bharti") ||
      asn === 37153 ||
      asn === 37340
    ) {
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "network_asn" };
    }

    // 3. Equity Bank Rwanda / eKash
    if (asOrg.includes("equity") || asOrg.includes("ekash")) {
      return { detected: "equity", carrierName: "Equity Bank eKash", source: "network_asn" };
    }

    // 4. Client IP Prefix Check for Rwandan Mobile Operators
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";

    if (
      clientIp.startsWith("197.243.") ||
      clientIp.startsWith("41.186.") ||
      clientIp.startsWith("105.178.") ||
      clientIp.startsWith("105.179.") ||
      clientIp.startsWith("196.12.136.") ||
      clientIp.startsWith("102.134.") ||
      clientIp.startsWith("154.68.") ||
      clientIp.startsWith("41.74.")
    ) {
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "carrier_ip" };
    }

    if (
      clientIp.startsWith("197.156.") ||
      clientIp.startsWith("41.216.") ||
      clientIp.startsWith("196.223.238.") ||
      clientIp.startsWith("102.217.") ||
      clientIp.startsWith("41.222.")
    ) {
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "carrier_ip" };
    }

    const ua = request.headers.get("user-agent")?.toLowerCase() || "";
    if (ua.includes("mtn"))
      return { detected: "mtn", carrierName: "MTN Rwanda", source: "user_agent" };
    if (ua.includes("airtel"))
      return { detected: "airtel", carrierName: "Airtel Rwanda", source: "user_agent" };
  } catch {
    // ignore parsing errors
  }

  return { detected: "unknown", carrierName: "Unknown", source: "none" };
}
