"use client";

import type { Profile } from "@ration/api";
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { profileApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface AuthState {
  status: "loading" | "signed_out" | "signed_in";
  session: Session | null;
  profile: Profile | null;
  storeId: string | null;
  setStoreId: (id: string | null) => void;
  initialise: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,
  storeId: null,
  setStoreId: (storeId) => set({ storeId }),
  initialise: () => {
    const load = async (session: Session | null) => {
      const profile = session ? await profileApi.get(session.user.id).catch(() => null) : null;
      set({ session, profile, status: session ? "signed_in" : "signed_out" });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user.id !== get().session?.user.id) void load(session);
    });
    return () => sub.subscription.unsubscribe();
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "signed_out" });
  },
}));

export const isStaff = (p: Profile | null) => !!p && (p.role === "store_staff" || p.role === "admin");
