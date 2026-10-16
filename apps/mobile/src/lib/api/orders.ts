import { createOrdersApi, describeOrderError } from "@ration/api";

import { supabase } from "@/lib/supabase";

export type { Order, OrderEvent, OrderItem, PlaceOrderInput, PlaceOrderResult, RazorpayCheckout } from "@ration/api";
export { OrderError } from "@ration/api";
export const ordersApi = createOrdersApi(supabase);
export const coerceOrderError = describeOrderError;
