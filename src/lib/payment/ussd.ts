import { buildRwandaUssdString } from "../momo-formatters";
import {
  PAYMENT_INSTRUCTION_VERSION,
  type PaymentInstruction,
  type PaymentMethod,
  type PaymentProvider,
} from "./types";

/**
 * Maps legacy UI / DB network labels onto provider keys.
 * Does not invent new USSD formats — generation still uses momo-formatters.
 */
export function mapNetworkToProvider(network: string | null | undefined): PaymentProvider {
  const net = (network || "").toLowerCase();
  if (net.includes("equity") || net.includes("ekash")) return "ekash";
  if (net.includes("airtel")) return "airtel";
  return "mtn";
}

export function mapPaymentTypeToMethod(paymentType: string | null | undefined): PaymentMethod {
  return paymentType === "phone" ? "phone" : "merchant_code";
}

export function providerToNetworkLabel(provider: PaymentProvider): string {
  if (provider === "ekash") return "Equity Bank (eKash)";
  if (provider === "airtel") return "Airtel Money";
  return "MTN MoMo";
}

export function methodToLegacyPaymentType(method: PaymentMethod): "momo_code" | "phone" {
  return method === "phone" ? "phone" : "momo_code";
}

export function normalizeAmount(amount?: number | null): number | null {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function createPaymentInstruction(input: {
  network: string;
  paymentType?: string | null;
  destination: string;
  amount?: number | null;
  publicStandId?: string;
  provider?: PaymentProvider;
  method?: PaymentMethod;
}): PaymentInstruction {
  const provider = input.provider || mapNetworkToProvider(input.network);
  const method = input.method || mapPaymentTypeToMethod(input.paymentType);
  return {
    version: PAYMENT_INSTRUCTION_VERSION,
    provider,
    method,
    destination: input.destination,
    amount: normalizeAmount(input.amount),
    currency: "RWF",
    publicStandId: input.publicStandId,
  };
}

function generateForProvider(instruction: PaymentInstruction, provider: PaymentProvider): string {
  return buildRwandaUssdString(
    providerToNetworkLabel(provider),
    methodToLegacyPaymentType(instruction.method),
    instruction.destination,
    instruction.amount,
  );
}

/**
 * Provider-specific USSD generators.
 * MTN and Airtel currently share the existing *182* formats in this repository.
 */
export const UssdGenerator = {
  mtn(instruction: PaymentInstruction): string {
    return generateForProvider(instruction, "mtn");
  },
  airtel(instruction: PaymentInstruction): string {
    return generateForProvider(instruction, "airtel");
  },
  ekash(instruction: PaymentInstruction): string {
    return generateForProvider(instruction, "ekash");
  },
  generate(instruction: PaymentInstruction): string {
    if (instruction.provider === "ekash") return UssdGenerator.ekash(instruction);
    if (instruction.provider === "airtel") return UssdGenerator.airtel(instruction);
    return UssdGenerator.mtn(instruction);
  },
};

export function generateUssd(instruction: PaymentInstruction): string {
  return UssdGenerator.generate(instruction);
}

/** USSD body without trailing `#`, for the existing online amount-append UI. */
export function ussdBaseWithoutHash(instruction: PaymentInstruction): string {
  return generateUssd({ ...instruction, amount: null }).replace(/#$/, "");
}

/** iPhone-tested dialer URI: tel: + encodeURIComponent(full USSD). */
export function generateTelUri(ussd: string): string {
  return `tel:${encodeURIComponent(ussd)}`;
}
