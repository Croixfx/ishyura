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
} from "lucide-react";
import { IshyuraClient, type QrDraft } from "@/lib/ishyura-client";
import { MONETIZATION_PRICES, generateRequestReference } from "@/lib/payment";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground mb-1">
            <div className="size-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Lock className="size-4 text-foreground" />
            </div>
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">{description}</DialogDescription>
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
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Price Callout */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground">Applicable Fee</span>
                <p className="text-[11px] text-muted-foreground">
                  Standard Rwanda merchant pricing
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {price.toLocaleString()} RWF
                </span>
              </div>
            </div>

            {/* Telecom Payment Guide */}
            <div className="p-3 rounded-xl border border-border/60 bg-card text-xs space-y-2">
              <p className="font-bold text-foreground">How to Pay:</p>
              <div className="space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <div>
                  • <strong>MTN MoMo:</strong> Pay to MoMo Merchant code:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded font-bold">234567</code> (Ishyura
                  Rwanda)
                </div>
                <div>
                  • <strong>Airtel Money:</strong> Pay to Till number:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded font-bold">123456</code>
                </div>
              </div>
            </div>

            {/* Reference Input */}
            <div className="space-y-1.5">
              <Label htmlFor="req-ref" className="text-xs font-semibold">
                Transaction Reference / SMS Code
              </Label>
              <Input
                id="req-ref"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                placeholder="e.g. PAY-839201 or MoMo TxID"
                className="font-mono text-sm h-10"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Enter your transaction ID from telecom confirmation SMS.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="req-notes" className="text-xs font-semibold">
                Sender Phone or Note (Optional)
              </Label>
              <Input
                id="req-notes"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="e.g. Paid from 0788123456"
                className="text-xs h-10"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="rounded-xl text-xs font-bold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                <span>Submit for Verification</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
