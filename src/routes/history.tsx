import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { History, ReceiptText, ShoppingBag } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { OrderHistoryList } from "@/components/OrderHistoryList";
import { PaymentHistoryList } from "@/components/PaymentHistoryList";
import {
  IshyuraClient,
  type OrderRecord,
  type PaymentRequestRecord,
  type UserProfile,
} from "@/lib/ishyura-client";

interface HistorySearch {
  tab?: "payments" | "orders";
}

export const Route = createFileRoute("/history")({
  validateSearch: (search: Record<string, unknown>): HistorySearch => ({
    tab: search.tab === "orders" ? "orders" : search.tab === "payments" ? "payments" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Payments & Orders — Ishyura" },
      {
        name: "description",
        content: "Your payment submissions and stand or sticker orders in one place.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const search = Route.useSearch();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"payments" | "orders">(search.tab || "payments");

  const [payments, setPayments] = useState<PaymentRequestRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadPayments = useCallback(async (user: UserProfile | null) => {
    if (!user) return;
    setPaymentsLoading(true);
    try {
      setPayments(await IshyuraClient.listPaymentRequests(user.id || user.phone_number));
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      setOrders(await IshyuraClient.listOrders());
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = IshyuraClient.getCurrentUser();
    setCurrentUser(user);
    setHydrated(true);
    if (user) {
      // Both lists load at once so switching tabs is instant.
      void loadPayments(user);
      void loadOrders();
    }
  }, [loadPayments, loadOrders]);

  const handleDeleteOrder = async (order: OrderRecord) => {
    setNotice(null);
    setDeletingId(order.id);
    try {
      const res = await IshyuraClient.deleteOrder(order.id);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setNotice({ ok: true, text: res.message });
    } catch (err: unknown) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "This order could not be deleted.",
      });
      void loadOrders();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout currentUser={currentUser} onUserChange={setCurrentUser}>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-5">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <History className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Your history</h1>
            <p className="text-xs text-muted-foreground">
              Payments you have submitted and the stands and stickers you have ordered.
            </p>
          </div>
        </div>

        {!hydrated ? (
          <div className="h-40" />
        ) : !currentUser ? (
          <div className="p-10 rounded-2xl border border-dashed border-border/80 text-center space-y-3">
            <p className="text-sm font-bold text-foreground">Sign in to see your history</p>
            <p className="text-xs text-muted-foreground">
              Your payments and orders are saved to your account.
            </p>
            <Button asChild size="sm" className="text-xs font-bold">
              <Link to="/">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2" role="tablist" aria-label="History">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "payments"}
                onClick={() => setTab("payments")}
                className={`flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-colors ${
                  tab === "payments"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <ReceiptText className="size-3.5" />
                <span>Payments</span>
                <span className="text-[10px] opacity-80">{payments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "orders"}
                onClick={() => setTab("orders")}
                className={`flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-colors ${
                  tab === "orders"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="size-3.5" />
                <span>Orders</span>
                <span className="text-[10px] opacity-80">{orders.length}</span>
              </button>
            </div>

            {tab === "payments" ? (
              <PaymentHistoryList
                payments={payments}
                loading={paymentsLoading}
                onRefresh={() => loadPayments(currentUser)}
              />
            ) : (
              <OrderHistoryList
                orders={orders}
                loading={ordersLoading}
                deletingId={deletingId}
                notice={notice}
                onRefresh={loadOrders}
                onDelete={handleDeleteOrder}
                onBrowse={undefined}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
