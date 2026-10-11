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
