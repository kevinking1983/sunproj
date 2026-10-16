import { supabase } from "@/lib/supabase";
import type { OrderStatus, PaymentMethod } from "@ration/shared";

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  unit_label: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  mrp: number;
  line_total: number;
}

export interface OrderEvent {
  id: number;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  store_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  handling_fee: number;
  tip: number;
  total: number;
  coupon_code: string | null;
  promised_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  rider_id: string | null;
  customer_note: string | null;
  address_snapshot: { line1: string; line2: string | null; landmark: string | null; city: string; pincode: string; label: string; lat: number; lng: number };
  created_at: string;
  order_items: OrderItem[];
  order_events?: OrderEvent[];
}

const ORDER_COLUMNS =
  "id, order_number, store_id, status, payment_method, subtotal, discount, delivery_fee, handling_fee, tip, total, coupon_code, promised_at, delivered_at, cancelled_at, cancel_reason, rider_id, customer_note, address_snapshot, created_at, order_items(id, product_id, name, unit_label, image_url, quantity, unit_price, mrp, line_total)";

export interface PlaceOrderInput {
  store_id: string;
  address_id: string;
  items: { product_id: string; quantity: number }[];
  payment_method: PaymentMethod;
  coupon_code?: string | null;
  tip?: number;
  note?: string | null;
}

export interface RazorpayCheckout {
  key_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { contact?: string };
  theme: { color: string };
}

export interface PlaceOrderResult {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  checkout: RazorpayCheckout | null;
}

export class OrderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const invoke = async <T>(name: string, body: Record<string, unknown>, headers?: Record<string, string>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>(name, { body, headers });
  if (error) {
    // Edge functions return { error, message } JSON with a 4xx status; surface it.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = (await ctx.json()) as { error?: string; message?: string };
        throw new OrderError(payload.error ?? "INTERNAL", payload.message ?? error.message);
      } catch (e) {
        if (e instanceof OrderError) throw e;
      }
    }
    throw new OrderError("INTERNAL", error.message);
  }
  return data as T;
};

export const ordersApi = {
  place: (input: PlaceOrderInput, idempotencyKey: string) => invoke<PlaceOrderResult>("place-order", { ...input }, { "Idempotency-Key": idempotencyKey }),

  verifyPayment: (input: { order_id: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    invoke<{ order_id: string; status: OrderStatus }>("verify-payment", { ...input }),

  cancel: (order_id: string, reason?: string) => invoke<{ order_id: string; status: OrderStatus; refund_online: number }>("cancel-order", { order_id, reason }),

  list: async (): Promise<Order[]> => {
    const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },

  get: async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from("orders")
      .select(`${ORDER_COLUMNS}, order_events(id, status, note, created_at)`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Order | null) ?? null;
  },
};

export const coerceOrderError = (e: unknown): string => {
  if (e instanceof OrderError) {
    switch (e.code) {
      case "OUT_OF_STOCK":
        return `${e.message} is out of stock. Remove it to continue.`;
      case "STORE_CLOSED":
        return "The store is closed right now. Please try again later.";
      case "ADDRESS_NOT_SERVICEABLE":
        return "This address is outside the delivery area of your store.";
      case "COUPON_INVALID":
        return "That coupon code is not valid.";
      case "COUPON_MIN_ORDER":
        return "Your order is below the minimum for this coupon.";
      case "COUPON_ALREADY_USED":
      case "COUPON_EXHAUSTED":
        return "This coupon has already been used.";
      case "COUPON_FIRST_ORDER_ONLY":
        return "This coupon is only for first orders.";
      case "INSUFFICIENT_WALLET":
        return "Your RATION wallet does not have enough balance.";
      case "RAZORPAY_NOT_CONFIGURED":
        return "Online payment is not set up yet. Choose cash on delivery.";
      default:
        return e.message || "Could not place the order.";
    }
  }
  return e instanceof Error ? e.message : "Could not place the order.";
};
