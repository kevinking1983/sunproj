import { createAddressesApi } from "@ration/api";

import { supabase } from "@/lib/supabase";

export type { Address, AddressInput, AddressLabel } from "@ration/api";
export const addressesApi = createAddressesApi(supabase);
