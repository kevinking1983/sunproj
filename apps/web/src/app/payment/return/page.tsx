"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Spinner } from "@/components/ui";
import { ordersApi } from "@/lib/api";
import { PENDING_ORDER_KEY } from "@/lib/payments";
import { useCart } from "@/stores/cart";

/** Landing page for the mock gateway's hosted checkout (open-source test stack). */
function PaymentReturn() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Confirming your payment…");

  useEffect(() => {
    const orderId = sessionStorage.getItem(PENDING_ORDER_KEY);
    const error = params.get("error");
    const run = async () => {
      if (!orderId) return setMessage("No pending order found.");
      if (error) {
        await ordersApi.cancel(orderId, error === "PAYMENT_CANCELLED" ? "Payment cancelled" : "Payment failed").catch(() => undefined);
        sessionStorage.removeItem(PENDING_ORDER_KEY);
        setMessage(error === "PAYMENT_CANCELLED" ? "Payment was cancelled. Your cart is still here." : "Payment failed. Please try again.");
        setTimeout(() => router.replace("/checkout"), 1500);
        return;
      }
      try {
        await ordersApi.verifyPayment({
          order_id: orderId,
          razorpay_order_id: params.get("razorpay_order_id") ?? "",
          razorpay_payment_id: params.get("razorpay_payment_id") ?? "",
          razorpay_signature: params.get("razorpay_signature") ?? "",
        });
        sessionStorage.removeItem(PENDING_ORDER_KEY);
        useCart.getState().clear();
        router.replace(`/account/orders/${orderId}?placed=1`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not verify the payment.");
      }
    };
    void run();
  }, [params, router]);

  return <div className="py-20 text-center"><Spinner /><p className="mt-4 text-muted">{message}</p></div>;
}

export default function PaymentReturnPage() {
  return <Suspense><PaymentReturn /></Suspense>;
}
