import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PaymentRequestRecord } from "@/lib/ishyura-client";

const PRODUCT_LABELS: Record<string, string> = {
  offline_qr_generation: "Additional offline QR",
  offline_generation: "Additional offline QR",
  pdf_download: "High-resolution card download",
  pdf_export: "High-resolution card download",
  pro_monthly: "PRO subscription (1 month)",
  pro_subscription: "PRO subscription (1 month)",
  dynamic_pro_subscription: "PRO subscription (1 month)",
};

interface PaymentHistoryListProps {
  payments: PaymentRequestRecord[];
  loading: boolean;
  onRefresh: () => void;
}

/** A merchant's payment submissions, newest first, with the admin's decision on each. */
export function PaymentHistoryList({ payments, loading, onRefresh }: PaymentHistoryListProps) {
  const totalPaid = payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Payment History</h2>
          <p className="text-xs text-muted-foreground">
            Every payment you have submitted and whether it was approved.
            {payments.length > 0 && (
              <>
                {" "}
                Approved so far:{" "}
                <span className="font-bold text-foreground tabular-nums">
                  {totalPaid.toLocaleString()} RWF
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs h-8 gap-1.5 shrink-0"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
          <span>Refresh</span>
        </Button>
      </div>

      {loading && payments.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
          <span>Loading your payments...</span>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center space-y-2">
          <Clock className="size-8 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No payments yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            When you pay for an extra QR, PRO or a card download, the payment and the decision on it
            will be listed here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-black text-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border/60 font-mono">
                    {p.reference_code}
                  </code>
                  <span className="text-xs font-semibold text-foreground">
                    {PRODUCT_LABELS[p.requested_entitlement] || p.requested_entitlement}
                  </span>
                </div>
                {p.status === "pending" ? (
                  <Badge className="w-fit text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/15 gap-1.5 py-1 px-3">
                    <Clock className="size-3" />
                    <span>Waiting for approval</span>
                  </Badge>
                ) : p.status === "approved" ? (
                  <Badge className="w-fit text-[11px] font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 gap-1.5 py-1 px-3">
                    <CheckCircle2 className="size-3" />
                    <span>Approved</span>
                  </Badge>
                ) : (
                  <Badge className="w-fit text-[11px] font-bold border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/15 gap-1.5 py-1 px-3">
                    <AlertCircle className="size-3" />
                    <span>Declined</span>
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[11px] text-muted-foreground">Amount</p>
                  <p className="font-bold text-foreground tabular-nums">
                    {p.amount.toLocaleString()} {p.currency || "RWF"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Submitted</p>
                  <p className="font-medium text-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                {p.reviewed_at && (
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      {p.status === "approved" ? "Approved" : "Reviewed"}
                    </p>
                    <p className="font-medium text-foreground">
                      {new Date(p.reviewed_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {p.status === "rejected" && p.rejection_reason && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-200">
                  <span className="font-bold mr-1.5">Administrator note:</span>
                  <span>{p.rejection_reason}</span>
                </div>
              )}

              {p.status === "approved" && p.fulfilled_qr_id && (
                <Button asChild size="sm" className="h-8 text-xs font-bold gap-1.5 rounded-xl">
                  <Link to="/" search={{ tab: "records", card: p.fulfilled_qr_id }}>
                    <Download className="size-3.5" />
                    <span>View &amp; Download your QR</span>
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
