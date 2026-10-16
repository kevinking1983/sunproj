/**
 * Razorpay Checkout wrapper. The native SDK is only available in a development/production
 * build (not Expo Go); we load it lazily so the rest of the app runs without it.
 */
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import type { RazorpayCheckout } from "@/lib/api/orders";
import { env } from "@/lib/env";

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

type RazorpayModule = { open(options: Record<string, unknown>): Promise<RazorpaySuccess> };

const loadRazorpay = (): RazorpayModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-razorpay") as { default?: RazorpayModule } & RazorpayModule;
    return mod.default ?? mod;
  } catch {
    return null;
  }
};

/**
 * Open-source test stack: the mock gateway's hosted checkout page returns through the
 * app's deep link with the same three fields Razorpay's SDK resolves with.
 */
const openMockCheckout = async (checkout: RazorpayCheckout): Promise<RazorpaySuccess> => {
  const redirect = Linking.createURL("payment");
  const url = `${env.mockGatewayUrl}/checkout?order_id=${encodeURIComponent(checkout.razorpay_order_id)}&redirect=${encodeURIComponent(redirect)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== "success") throw new PaymentCancelled();
  const params = Linking.parse(result.url).queryParams ?? {};
  const read = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  if (read("error") === "PAYMENT_CANCELLED") throw new PaymentCancelled();
  if (read("error")) throw new Error("Payment failed (mock)");
  const success = { razorpay_order_id: read("razorpay_order_id"), razorpay_payment_id: read("razorpay_payment_id"), razorpay_signature: read("razorpay_signature") };
  if (!success.razorpay_payment_id || !success.razorpay_signature) throw new Error("Mock checkout returned no payment");
  return success;
};

export const openRazorpayCheckout = async (checkout: RazorpayCheckout): Promise<RazorpaySuccess> => {
  if (env.paymentProvider === "mock") return openMockCheckout(checkout);
  const Razorpay = loadRazorpay();
  if (!Razorpay) throw new Error("Online payments need a development build of the app (react-native-razorpay is a native module).");
  try {
    return await Razorpay.open({
      key: checkout.key_id,
      order_id: checkout.razorpay_order_id,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      theme: checkout.theme,
      retry: { enabled: true, max_count: 3 },
    });
  } catch (e) {
    const err = e as { code?: number | string; description?: string };
    // Razorpay rejects with code 0 / "PAYMENT_CANCELLED" style payloads on user dismissal.
    if (err?.code === 0 || err?.code === 2 || /cancel/i.test(err?.description ?? "")) throw new PaymentCancelled();
    throw new Error(err?.description ?? "Payment failed");
  }
};
