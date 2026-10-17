import { createRiderApi, createTrackingApi } from "@ration/api";

import { supabase } from "@/lib/supabase";

export const riderApi = createRiderApi(supabase);
export const trackingApi = createTrackingApi(supabase);
export { describeRiderError, RIDER_CAN_DECLINE, RIDER_NEXT } from "@ration/api";
