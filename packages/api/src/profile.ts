import type { Client } from "./client";

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  role: "customer" | "rider" | "store_staff" | "admin";
  referral_code: string | null;
  wallet_balance: number;
}

export interface WalletTx {
  id: number;
  amount: number;
  kind: string;
  note: string | null;
  created_at: string;
}

const PROFILE_COLUMNS = "id, phone, full_name, email, role, referral_code, wallet_balance";

export const createProfileApi = (client: Client) => ({
  get: async (userId: string): Promise<Profile | null> => {
    const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (error) throw error;
    return (data as Profile | null) ?? null;
  },

  update: async (userId: string, input: { full_name?: string | null; email?: string | null }): Promise<void> => {
    const { error } = await client.from("profiles").update(input).eq("id", userId);
    if (error) throw error;
  },

  applyReferral: async (code: string): Promise<boolean> => {
    const { data, error } = await client.rpc("apply_referral_code", { p_code: code });
    if (error) throw error;
    return !!data;
  },

  walletTransactions: async (): Promise<WalletTx[]> => {
    const { data, error } = await client.from("wallet_transactions").select("id, amount, kind, note, created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  },
});
