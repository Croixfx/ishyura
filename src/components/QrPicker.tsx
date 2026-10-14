import { useEffect, useState } from "react";
import { Globe, Loader2, QrCode, Radio, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IshyuraClient, type QRCodeRecord } from "@/lib/ishyura-client";

interface QrPickerProps {
  /** Signed-in user; orders are only possible for QR codes you have already generated. */
  signedIn: boolean;
  value: string | null;
  onChange: (qr: QRCodeRecord | null) => void;
  /** Optionally pre-select a QR (for example the card that was just generated). */
  preferredId?: string | null;
}

/** Lists the merchant's generated payment QR codes so they can choose what to print. */
export function QrPicker({ signedIn, value, onChange, preferredId }: QrPickerProps) {
  const [qrs, setQrs] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const list = await IshyuraClient.listQrCodes();
      setQrs(list);
      const chosen = list.find((q) => q.id === (value ?? preferredId));
      if (chosen && chosen.id !== value) onChange(chosen);
      if (!chosen && value) onChange(null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (signedIn) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 p-4 text-center space-y-1">
        <p className="text-xs font-bold text-foreground">Sign in to order</p>
        <p className="text-[11px] text-muted-foreground">
          Orders are made for the payment QR codes you have generated. Sign in, then pick one here.
        </p>
      </div>
    );
  }

  if (loading && qrs.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your payment QR codes...
      </div>
    );
  }

  if (!loading && qrs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 space-y-2 text-center">
        <QrCode className="size-5 mx-auto text-amber-600" />
        <p className="text-xs font-bold text-foreground">
          {failed ? "We could not load your QR codes" : "Generate a payment QR first"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {failed
            ? "Check your connection and try again."
            : "We print stands and stickers for the QR codes you have created, so we know exactly which payment to put on them."}
        </p>
        {failed ? (
          <Button type="button" size="sm" variant="outline" onClick={load} className="text-xs h-8">
            <RefreshCw className="size-3.5 mr-1.5" />
            Try again
          </Button>
        ) : (
          <Button asChild size="sm" className="text-xs h-8">
            <Link to="/">Generate a QR</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Payment QR to print">
      {qrs.map((qr) => {
        const online = Boolean(qr.is_dynamic);
        const selected = qr.id === value;
        return (
          <button
            key={qr.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(qr)}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
              selected
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-border/70 bg-card/60 hover:border-emerald-500/50"
            }`}
          >
            <div
              className={`size-9 shrink-0 rounded-lg flex items-center justify-center ${
                online
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              }`}
            >
              {online ? <Globe className="size-4" /> : <Radio className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">
                {qr.business_name || "Payment QR"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {qr.network || "Mobile Money"} · {qr.dial_code}
                {qr.amount ? ` · ${Number(qr.amount).toLocaleString()} RWF` : ""}
              </p>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                online
                  ? "border-purple-500/30 text-purple-600 dark:text-purple-400"
                  : "border-sky-500/30 text-sky-600 dark:text-sky-400"
              }`}
            >
              {online ? "Online" : "Offline"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
