/** Hand-written domain types. Generated DB types land in database.types.ts via `npm run db:types`. */

export type Paise = number; // all money is stored as integer paise

export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "accepted"
  | "packing"
  | "ready"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cod" | "ration_wallet";

export type PaymentStatus = "created" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded";

export interface Money {
  amount: Paise;
  currency: "INR";
}

export const formatInr = (paise: Paise): string => {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
};
