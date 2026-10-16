import { createProfileApi, type Profile } from "@ration/api";
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type { Profile };
const profileApi = createProfileApi(supabase);

interface AuthState {
  status: "loading" | "signed_out" | "signed_in";
  session: Session | null;
  profile: Profile | null;
  initialise: () => () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

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
    const profile = await profileApi.get(userId).catch(() => null);
    if (profile) set({ profile });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "signed_out" });
  },
}));
