import type { OrderStatus } from "@ration/shared";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Order placed",
  accepted: "Store is preparing",
  packing: "Packing your items",
  ready: "Ready for pickup",
  picked_up: "Picked up by rider",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const STATUS_STEPS: OrderStatus[] = ["placed", "packing", "out_for_delivery", "delivered"];

/** Index into STATUS_STEPS for the progress tracker; -1 for cancelled/refunded. */
export const stepIndex = (status: OrderStatus): number => {
  switch (status) {
    case "pending_payment":
    case "placed":
      return 0;
    case "accepted":
    case "packing":
    case "ready":
      return 1;
    case "picked_up":
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return -1;
  }
};

export const isActiveStatus = (status: OrderStatus): boolean => !["delivered", "cancelled", "refunded"].includes(status);
export const isCancellableStatus = (status: OrderStatus): boolean => ["pending_payment", "placed", "accepted"].includes(status);

/** Store-side progression used by the admin board. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "packing",
  packing: "ready",
  ready: "picked_up",
  picked_up: "out_for_delivery",
  out_for_delivery: "delivered",
};
