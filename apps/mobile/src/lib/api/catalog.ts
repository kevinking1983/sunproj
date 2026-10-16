import { createCatalogApi } from "@ration/api";

import { supabase } from "@/lib/supabase";

export type { Banner, Category, Product } from "@ration/api";
export const catalogApi = createCatalogApi(supabase);
