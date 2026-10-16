"use client";

import type { RazorpayCheckout } from "@ration/api";

import { env } from "./env";

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class PaymentCancelled extends Error {
  constructor() {
    super("Payment was cancelled");
  }
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (resp: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(s);
  });

export const PENDING_ORDER_KEY = "ration.pendingOrder";

/**
 * Opens checkout. With the real provider the promise resolves in-page; with the mock
 * gateway (open-source test stack) the browser navigates away and /payment/return
 * finishes verification using the order id kept in sessionStorage.
 */
export const openCheckout = async (orderId: string, checkout: RazorpayCheckout): Promise<RazorpaySuccess> => {
  if (env.paymentProvider === "mock") {
    sessionStorage.setItem(PENDING_ORDER_KEY, orderId);
    const redirect = `${window.location.origin}/payment/return`;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- external mock gateway URL
    window.location.href = `${env.mockGatewayUrl}/checkout?order_id=${encodeURIComponent(checkout.razorpay_order_id)}&redirect=${encodeURIComponent(redirect)}`;
    return new Promise(() => undefined); // navigation takes over
  }
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: checkout.key_id,
      order_id: checkout.razorpay_order_id,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      theme: checkout.theme,
      retry: { enabled: true, max_count: 3 },
      handler: (resp: RazorpaySuccess) => resolve(resp),
      modal: { ondismiss: () => reject(new PaymentCancelled()) },
    });
    rzp.on("payment.failed", (resp) => reject(new Error(resp.error?.description ?? "Payment failed")));
    rzp.open();
  });
};
