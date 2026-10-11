import { getDynamicPayUrl } from "../ishyura-client";
import { inferPaymentMode, inferQrEncoding } from "./identity";
import {
  type NfcPayload,
  type PaymentInstruction,
  type PaymentMode,
  type QrEncoding,
  type StandPayloads,
} from "./types";
import { createPaymentInstruction, generateTelUri, generateUssd } from "./ussd";

export interface BuildStandPayloadsInput {
  standId: string;
  publicId: string;
  configVersion?: number;
  isDynamic?: boolean | number | null;
  encoding?: QrEncoding;
  paymentMode?: PaymentMode;
  network: string;
  paymentType?: string | null;
  destination: string;
  amount?: number | null;
  /** When omitted, uses getDynamicPayUrl (window origin in the browser). */
  origin?: string;
}

function dynamicPayUrl(publicId: string, origin?: string): string {
  if (origin) {
    return `${origin.replace(/\/$/, "")}/p/${publicId}`;
  }
  return getDynamicPayUrl(publicId);
}

/**
 * Produces the online-first QR value and its USSD dial fallback. Dynamic stands
 * encode the HTTPS URL; offline use depends on the page being available in cache.
 */
export function buildStandPayloads(input: BuildStandPayloadsInput): StandPayloads {
  const encoding = input.encoding || inferQrEncoding(input.isDynamic);
  const amount = typeof input.amount === "number" ? input.amount : null;
  const paymentMode = input.paymentMode || inferPaymentMode(amount);
  const configVersion = input.configVersion ?? 1;

  const instruction: PaymentInstruction = createPaymentInstruction({
    network: input.network,
    paymentType: input.paymentType,
    destination: input.destination,
    amount,
    publicStandId: input.publicId,
  });

  const ussd = generateUssd(instruction);
  const telUri = generateTelUri(ussd);
  const httpsUrl = dynamicPayUrl(input.publicId, input.origin);

  const qrValue = encoding === "https_pay" ? httpsUrl : telUri;

  const nfc: NfcPayload = {
    uri: qrValue,
    kind: encoding,
    recordType: "U",
  };

  return {
    standId: input.standId,
    publicId: input.publicId,
    configVersion,
    paymentMode,
    encoding,
    instruction,
    ussd,
    onlineUrl: httpsUrl,
    offlineTelUri: telUri,
    qrValue,
    nfc,
  };
}
