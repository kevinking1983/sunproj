import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  role: "customer" | "rider" | "store_staff" | "admin";
  referral_code: string | null;
  wallet_balance: number;
}

interface AuthState {
  status: "loading" | "signed_out" | "signed_in";
  session: Session | null;
  profile: Profile | null;
  initialise: () => () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const PROFILE_COLUMNS = "id, phone, full_name, email, role, referral_code, wallet_balance";

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,

  initialise: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, status: data.session ? "signed_in" : "signed_out" });
      if (data.session) void get().refreshProfile();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, status: session ? "signed_in" : "signed_out", profile: session ? get().profile : null });
      if (session) void get().refreshProfile();
    });
    return () => sub.subscription.unsubscribe();
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (data) set({ profile: data as Profile });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "signed_out" });
  },
}));
