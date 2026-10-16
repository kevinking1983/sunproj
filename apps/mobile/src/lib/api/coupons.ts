import { supabase } from "@/lib/supabase";
import type { CouponRule } from "@ration/shared";

export interface Coupon extends CouponRule {
  id: string;
  title: string;
  description: string | null;
  first_order_only: boolean;
}

export const couponsApi = {
  list: async (): Promise<Coupon[]> => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, title, description, discount_type, discount_value, max_discount, min_order_amount, first_order_only")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`);
    if (error) throw error;
    return (data ?? []) as Coupon[];
  },
};
