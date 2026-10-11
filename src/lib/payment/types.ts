/**
 * Payment domain types for Ishyura stands.
 * Logical instruction is separate from network-specific USSD syntax
 * and from QR / NFC physical representations.
 */

export type PaymentProvider = "mtn" | "airtel" | "ekash";

export type PaymentMethod = "merchant_code" | "phone";

export type PaymentMode = "FIXED_AMOUNT" | "CUSTOMER_AMOUNT";

export type QrEncoding = "tel_ussd" | "https_pay";

export type StandStatus = "active" | "revoked";

export type DestinationStatus = "active" | "revoked";

export type NfcUriKind = "tel_ussd" | "https_pay";

export const PAYMENT_INSTRUCTION_VERSION = 1;

export interface PaymentInstruction {
  version: number;
  provider: PaymentProvider;
  method: PaymentMethod;
  destination: string;
  amount: number | null;
  currency: "RWF";
  publicStandId?: string;
}

export interface PaymentDestinationRecord {
  id: string;
  merchantId: string;
  displayName: string | null;
  network: string;
  paymentMethod: PaymentMethod;
  recipientCode: string;
  currency: "RWF";
  status: DestinationStatus;
  version: number;
}

export interface PaymentStandIdentity {
  /** Internal database id (`qr_codes.id`). Used by existing `/p/:id` URLs. */
  standId: string;
  /** Public stand token. Never required to equal standId. */
  publicId: string;
  configVersion: number;
  paymentMode: PaymentMode;
  status: StandStatus;
  destinationId?: string | null;
}

export interface NfcPayload {
  /** Single NDEF URI record. Device behavior is tested independently. */
  uri: string;
  kind: NfcUriKind;
  recordType: "U";
}

export interface StandPayloads {
  standId: string;
  publicId: string;
  configVersion: number;
  paymentMode: PaymentMode;
  encoding: QrEncoding;
  instruction: PaymentInstruction;
  ussd: string;
  onlineUrl: string;
  offlineTelUri: string;
  /** Exact value encoded in the printed QR. */
  qrValue: string;
  nfc: NfcPayload;
}

export type ProductMode = "offline" | "online";

export type EntitlementType =
  | "offline_generation"
  | "pdf_download"
  | "pro_subscription";

export type EntitlementStatus = "active" | "expired" | "revoked";

export type PaymentRequestStatus = "pending" | "approved" | "rejected";

export type PaymentRequestProductType =
  | "offline_generation"
  | "pdf_download"
  | "pro_subscription"
  | "physical_stand";

export interface MerchantEntitlementRecord {
  id: string;
  merchant_id: string;
  entitlement_type: EntitlementType;
  granted_count: number;
  consumed_count: number;
  status: EntitlementStatus;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequestRecord {
  id: string;
  request_reference: string;
  merchant_id: string;
  merchant_phone: string;
  product_type: PaymentRequestProductType;
  amount: number;
  currency: "RWF";
  payment_method: string;
  submitted_reference?: string | null;
  proof_notes?: string | null;
  status: PaymentRequestStatus;
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntitlementEventRecord {
  id: string;
  merchant_id: string;
  request_id?: string | null;
  event_type: string;
  entitlement_type: string;
  quantity: number;
  details?: string | null;
  created_at: string;
}

export const MONETIZATION_PRICES = {
  extra_offline_generation: 2000, // 2,000 RWF per additional direct USSD QR
  pdf_download: 1000,             // 1,000 RWF per high-res PDF print card export
  pro_monthly: 5000,              // 5,000 RWF / month for Dynamic PRO Smart Stands & live bills
} as const;

