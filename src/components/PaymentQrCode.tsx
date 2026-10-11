import { QRCodeSVG } from "qrcode.react";
import { buildStandPayloads, publicIdFromInternalId } from "../lib/payment";

interface PaymentQrCodeProps {
  standId: string;
  publicId?: string | null;
  configVersion?: number | null;
  network: string;
  paymentType: string;
  destination: string;
  amount?: number | null;
  isDynamic?: boolean | number;
  size?: number;
  compact?: boolean;
}

export function PaymentQrCode({
  standId,
  publicId,
  configVersion,
  network,
  paymentType,
  destination,
  amount,
  isDynamic,
  size = 180,
  compact = false,
}: PaymentQrCodeProps) {
  const payloads = buildStandPayloads({
    standId,
    publicId: publicId || publicIdFromInternalId(standId),
    configVersion: configVersion ?? 1,
    isDynamic,
    network,
    paymentType,
    destination,
    amount,
  });
  const qrClass = compact
    ? "flex min-w-0 flex-col items-center gap-1"
    : "flex min-w-0 flex-col items-center gap-2";
  const labelClass = compact
    ? "text-[8px] font-bold uppercase tracking-wide text-slate-600"
    : "text-[9px] font-bold uppercase tracking-wide text-slate-600";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={qrClass}>
        <span className={labelClass}>
          {isDynamic ? "Scan once · online first, USSD fallback" : "Direct USSD · no internet"}
        </span>
        <QRCodeSVG
          value={payloads.qrValue}
          size={size}
          level={compact ? "M" : "H"}
          fgColor="#0f172a"
          bgColor="#ffffff"
        />
      </div>
      {isDynamic && (
        <p className="text-center text-[8px] leading-tight text-slate-500">
          Offline fallback is best-effort and requires this page to have been opened online on this
          device before.
        </p>
      )}
      {!isDynamic && !amount && (
        <p className="text-center text-[8px] leading-tight text-slate-500">
          The provider&apos;s USSD menu collects the amount.
        </p>
      )}
    </div>
  );
}
