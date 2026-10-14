import { Loader2, MapPin, Package, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canDeleteOrder, type OrderRecord } from "@/lib/ishyura-client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  processing: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/30",
};

const ITEM_LABELS: Record<string, string> = {
  acrylic_stand: "Acrylic stand",
  vinyl_stickers: "Vinyl stickers (pack of 5)",
  smart_nfc_stand: "Smart NFC + QR stand",
  pro_bundle: "Merchant starter bundle",
  custom: "Custom branding stand",
};

interface OrderHistoryListProps {
  orders: OrderRecord[];
  loading: boolean;
  deletingId: string | null;
  notice: { ok: boolean; text: string } | null;
  onRefresh: () => void;
  onDelete: (order: OrderRecord) => void;
  /** Shown in the empty state, e.g. "Browse Merchandise". */
  onBrowse?: () => void;
  browseLabel?: string;
}

/** A merchant's saved orders, with status, the QR each one is for, and the delete rules. */
export function OrderHistoryList({
  orders,
  loading,
  deletingId,
  notice,
  onRefresh,
  onDelete,
  onBrowse,
  browseLabel = "Browse Merchandise",
}: OrderHistoryListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Order Tracking & History</h2>
          <p className="text-xs text-muted-foreground">
            Track your physical merchant stands and delivery statuses
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Package className="size-3.5" />
          )}
          <span>Refresh</span>
        </Button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg border text-xs ${
            notice.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
          <span>Loading your orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border/80 text-center space-y-3">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">No physical orders yet</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order your first custom acrylic stand or counter stickers today.
            </p>
          </div>
          {onBrowse && (
            <Button size="sm" onClick={onBrowse} className="text-xs font-semibold">
              {browseLabel}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {orders.map((order) => {
            const deletable = canDeleteOrder(order.status);
            return (
              <div
                key={order.id}
                className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-foreground">
                      {order.order_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}
                    >
                      {order.status}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {order.business_name}
                    </span>
                  </div>
                  {order.qr_label && (
                    <p className="text-[11px] text-muted-foreground">
                      For QR: <span className="font-semibold">{order.qr_label}</span>
                    </p>
                  )}
                  <p className="text-xs text-foreground font-medium">
                    {ITEM_LABELS[order.item_type] || order.item_type.replace(/_/g, " ")} (x
                    {order.quantity}) ·{" "}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {order.total_price.toLocaleString()} RWF
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    <span>{order.delivery_location}</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-muted-foreground block">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-xs font-semibold text-foreground block">
                    Contact: {order.customer_phone}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!deletable || deletingId === order.id}
                    title={
                      deletable
                        ? order.status === "pending"
                          ? "Cancel and remove this order"
                          : "Remove this order from your list"
                        : "Being processed: you can delete it after it is delivered"
                    }
                    onClick={() => onDelete(order)}
                    className="mt-2 h-7 text-[11px] gap-1.5"
                  >
                    {deletingId === order.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    <span>{order.status === "pending" ? "Cancel & delete" : "Delete"}</span>
                  </Button>
                  {!deletable && (
                    <span className="block text-[10px] text-muted-foreground mt-1">
                      In process: delete after delivery
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
