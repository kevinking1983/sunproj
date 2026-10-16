import { createStoresApi } from "@ration/api";

import { supabase } from "@/lib/supabase";

export type { ServingStore } from "@ration/api";
export const findServingStore = createStoresApi(supabase).findServing;
