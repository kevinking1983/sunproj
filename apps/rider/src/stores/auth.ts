import { createProfileApi, type Profile } from "@ration/api";
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

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
  refreshProfile: async () => {
    const id = get().session?.user.id;
    if (!id) return;
    const profile = await profileApi.get(id).catch(() => null);
    if (profile) set({ profile });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "signed_out" });
  },
}));

export const isRider = (p: Profile | null) => p?.role === "rider";
