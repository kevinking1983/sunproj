import { createCouponsApi } from "@ration/api";

import { supabase } from "@/lib/supabase";

export type { Coupon } from "@ration/api";
export const couponsApi = createCouponsApi(supabase);
