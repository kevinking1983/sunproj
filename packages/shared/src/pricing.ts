/**
 * Bill computation shared by the app (cart preview) and mirrored in SQL (place_order).
 * Keep both in sync: the database is the source of truth at checkout.
 */
import type { Paise } from "./types";

export const HANDLING_FEE: Paise = 500; // ₹5 per order
export const SMALL_ORDER_FEE: Paise = 2000; // ₹20 when subtotal is below the store minimum
export const MAX_TIP: Paise = 10000;

export interface StoreFees {
  min_order_amount: Paise;
  delivery_fee: Paise;
  free_delivery_above: Paise;
}

export interface CouponRule {
  code: string;
  discount_type: "flat" | "percent" | "free_delivery";
  discount_value: Paise; // percent uses whole numbers (10 = 10%)
  max_discount: Paise | null;
  min_order_amount: Paise;
}

export interface Bill {
  subtotal: Paise;
  mrp_total: Paise;
  item_savings: Paise;
  discount: Paise;
  delivery_fee: Paise;
  small_order_fee: Paise;
  handling_fee: Paise;
  tip: Paise;
  total: Paise;
  coupon_code: string | null;
  coupon_error: string | null;
}

export const couponDiscount = (subtotal: Paise, deliveryFee: Paise, c: CouponRule | null): { discount: Paise; freeDelivery: boolean; error: string | null } => {
  if (!c) return { discount: 0, freeDelivery: false, error: null };
  if (subtotal < c.min_order_amount) {
    return { discount: 0, freeDelivery: false, error: `Add items worth ₹${Math.ceil((c.min_order_amount - subtotal) / 100)} more to use ${c.code}` };
  }
  if (c.discount_type === "free_delivery") return { discount: deliveryFee, freeDelivery: true, error: null };
  let discount = c.discount_type === "flat" ? c.discount_value : Math.floor((subtotal * c.discount_value) / 100);
  if (c.max_discount !== null) discount = Math.min(discount, c.max_discount);
  return { discount: Math.min(discount, subtotal), freeDelivery: false, error: null };
};

export const computeBill = (
  lines: { price: Paise; mrp: Paise; quantity: number }[],
  store: StoreFees,
  coupon: CouponRule | null,
  tip: Paise = 0,
): Bill => {
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const mrp_total = lines.reduce((n, l) => n + l.mrp * l.quantity, 0);
  const baseDelivery = subtotal >= store.free_delivery_above ? 0 : store.delivery_fee;
  const small_order_fee = subtotal > 0 && subtotal < store.min_order_amount ? SMALL_ORDER_FEE : 0;
  const { discount, freeDelivery, error } = couponDiscount(subtotal, baseDelivery, coupon);
  const delivery_fee = freeDelivery ? 0 : baseDelivery;
  const applied = freeDelivery ? 0 : discount;
  const handling_fee = subtotal > 0 ? HANDLING_FEE : 0;
  const safeTip = Math.max(0, Math.min(tip, MAX_TIP));
  const total = Math.max(0, subtotal - applied) + delivery_fee + small_order_fee + handling_fee + safeTip;
  return {
    subtotal,
    mrp_total,
    item_savings: mrp_total - subtotal,
    discount: freeDelivery ? baseDelivery : applied,
    delivery_fee,
    small_order_fee,
    handling_fee,
    tip: safeTip,
    total,
    coupon_code: coupon && !error ? coupon.code : null,
    coupon_error: error,
  };
};
