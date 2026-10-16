import type { Client } from "./client";

export type AddressLabel = "home" | "work" | "other";

export interface Address {
  id: string;
  user_id: string;
  label: AddressLabel;
  recipient_name: string | null;
  recipient_phone: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  is_default: boolean;
  created_at: string;
}

export type AddressInput = Omit<Address, "id" | "user_id" | "created_at">;

const COLUMNS = "id, user_id, label, recipient_name, recipient_phone, line1, line2, landmark, city, state, pincode, lat, lng, is_default, created_at";

export const createAddressesApi = (client: Client) => ({
  list: async (): Promise<Address[]> => {
    const { data, error } = await client.from("addresses").select(COLUMNS).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Address[];
  },

  create: async (userId: string, input: AddressInput): Promise<Address> => {
    if (input.is_default) await client.from("addresses").update({ is_default: false }).eq("user_id", userId);
    const { data, error } = await client.from("addresses").insert({ ...input, user_id: userId }).select(COLUMNS).single();
    if (error) throw error;
    return data as Address;
  },

  update: async (userId: string, id: string, input: Partial<AddressInput>): Promise<Address> => {
    if (input.is_default) await client.from("addresses").update({ is_default: false }).eq("user_id", userId).neq("id", id);
    const { data, error } = await client.from("addresses").update(input).eq("id", id).select(COLUMNS).single();
    if (error) throw error;
    return data as Address;
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await client.from("addresses").delete().eq("id", id);
    if (error) throw error;
  },
});
