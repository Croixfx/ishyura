import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  PhoneCall,
  Copy,
  Check,
  QrCode as QrIcon,
  Smartphone,
} from "lucide-react";
import { IshyuraClient, type QrDraft } from "@/lib/ishyura-client";
import {
  MONETIZATION_PRICES,
  PLATFORM_MOMO_CODE,
  PLATFORM_PAYEE_NAME,
  generateRequestReference,
} from "@/lib/payment";
import { buildRwandaUssdString } from "@/lib/momo-formatters";
import { PaymentQrCode } from "@/components/PaymentQrCode";

interface PaymentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entitlementType: "offline_qr_generation" | "pdf_download" | "pro_monthly";
  merchantId: string;
  merchantPhone: string;
  /** What the merchant was creating; the QR is made for them as soon as an admin approves. */
  draft?: QrDraft | null;
  onSuccess?: () => void;
}

export function PaymentRequestDialog({
  open,
  onOpenChange,
  entitlementType,
  merchantId,
  merchantPhone,
  draft,
  onSuccess,
}: PaymentRequestDialogProps) {
  const [referenceCode, setReferenceCode] = useState(() => generateRequestReference());
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [payMode, setPayMode] = useState<"dial" | "qr">("dial");
  const [copiedCode, setCopiedCode] = useState(false);

  const price =
    entitlementType === "pro_monthly"
      ? MONETIZATION_PRICES.pro_monthly
      : entitlementType === "pdf_download"
        ? MONETIZATION_PRICES.pdf_download
        : MONETIZATION_PRICES.extra_offline_generation;

  const title =
    entitlementType === "pro_monthly"
      ? "Upgrade to Dynamic PRO Stand"
      : entitlementType === "pdf_download"
        ? "High-Resolution PDF Card Export"
        : "Additional Offline QR Generation";

  const description =
    entitlementType === "pro_monthly"
      ? "Unlock remotely editable counter bills, edge payment pages, and analytics."
      : entitlementType === "pdf_download"
        ? "Unlock a high-resolution download of your official card."
        : "Your included free generation has been consumed. Top up to generate an additional stand.";

  const ussdString = buildRwandaUssdString("MTN MoMo", "momo_code", PLATFORM_MOMO_CODE, price);
  const telUri = `tel:${encodeURIComponent(ussdString)}`;

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(PLATFORM_MOMO_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceCode.trim()) {
      setError("Please provide a payment reference code or transaction ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await IshyuraClient.createPaymentRequest({
        merchant_id: merchantId,
        merchant_phone: merchantPhone,
        requested_entitlement: entitlementType,
        amount: price,
        reference_code: referenceCode.trim().toUpperCase(),
        evidence_notes: evidenceNotes.trim() || undefined,
        draft: draft || undefined,
      });

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit payment request.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError(null);
    setEvidenceNotes("");
    setReferenceCode(generateRequestReference());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-foreground">
            <div className="size-7 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
              <Lock className="size-3.5 text-foreground" />
            </div>
            <DialogTitle className="text-sm sm:text-base font-bold truncate">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-foreground">Payment Request Submitted!</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Reference <strong>{referenceCode}</strong> has been logged. Ishyura administrators
                review and approve requests promptly.
                {draft
                  ? " Once it is approved, your QR card is created automatically. Open your dashboard to view and download it."
                  : ""}
              </p>
            </div>
            <Button onClick={handleClose} className="rounded-xl text-xs font-bold w-full">
              Got It
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {error && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Price Callout */}
            <div className="p-3 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Amount Due
                </span>
                <p className="text-xs font-bold text-foreground">
                  Official Platform Fee
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-foreground">
                  {price.toLocaleString()} RWF
                </span>
              </div>
            </div>

            {/* Smooth Payment Options Switch */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/50">
                <button
                  type="button"
                  onClick={() => setPayMode("dial")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    payMode === "dial"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="size-3.5" />
                  <span>Dial on Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode("qr")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    payMode === "qr"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <QrIcon className="size-3.5" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {payMode === "dial" ? (
                <div className="p-3 rounded-xl border border-border/60 bg-card text-xs space-y-2.5 animate-in fade-in duration-200">
                  {/* One-Tap Direct Dial */}
                  <a
                    href={telUri}
                    className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
                  >
                    <PhoneCall className="size-4" />
                    <span>1-Tap Dial ({ussdString})</span>
                  </a>

                  {/* MoMo Code Details with One-Tap Copy */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          MoMo Code:
                        </span>
                        <code className="text-xs font-black text-foreground font-mono">
                          {PLATFORM_MOMO_CODE}
                        </code>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Registered to: <strong className="text-foreground">{PLATFORM_PAYEE_NAME}</strong>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCode}
                      className="h-7 px-2.5 text-[11px] font-bold shrink-0 gap-1 rounded-lg"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-border/60 bg-card text-xs space-y-2.5 animate-in fade-in duration-200 flex flex-col items-center">
                  <div className="rounded-xl bg-white p-2.5 flex flex-col items-center shadow-xs border border-border/40">
                    <PaymentQrCode
                      standId="ishyura-fee"
                      network="MTN MoMo"
                      paymentType="momo_code"
                      destination={PLATFORM_MOMO_CODE}
                      amount={price}
                      isDynamic={false}
                      size={135}
                      compact
                    />
                    <p className="text-[10px] font-bold text-slate-800 mt-1">
                      Scan camera to pay {price.toLocaleString()} RWF
                    </p>
                  </div>
                  <div className="text-center text-[10.5px] text-muted-foreground">
                    MoMo Code: <strong className="text-foreground">{PLATFORM_MOMO_CODE}</strong> ({PLATFORM_PAYEE_NAME})
                  </div>
                </div>
              )}
            </div>

            {/* Reference Input */}
            <div className="space-y-1">
              <Label htmlFor="req-ref" className="text-xs font-semibold">
                Transaction Reference / SMS Code
              </Label>
              <Input
                id="req-ref"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                placeholder="e.g. PAY-839201 or MoMo TxID"
                className="font-mono text-xs sm:text-sm h-9"
                required
              />
              <p className="text-[9.5px] text-muted-foreground">
                Enter telecom SMS confirmation TxID or keep generated reference.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1">
              <Label htmlFor="req-notes" className="text-xs font-semibold">
                Sender Phone or Note (Optional)
              </Label>
              <Input
                id="req-notes"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="e.g. Paid from 0788123456"
                className="text-xs h-9"
              />
            </div>

            <div className="pt-1 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="rounded-xl text-xs h-8.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="rounded-xl text-xs font-bold h-8.5 bg-foreground text-background hover:bg-foreground/90 gap-1.5"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                <span>Submit Verification</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
