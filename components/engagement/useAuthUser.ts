"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type AuthState = {
  userId: string | null;
  email: string | null;
  loading: boolean;
};

export default function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({
    userId: null,
    email: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const updateState = (user: { id: string; email?: string | null } | null) => {
      if (!active) return;
      setState({
        userId: user?.id || null,
        email: user?.email || null,
        loading: false,
      });
    };

    supabase.auth.getUser().then(({ data }) => updateState(data.user ?? null));
    const listener = supabase.auth.onAuthStateChange
      ? supabase.auth.onAuthStateChange((_event, session) => updateState(session?.user ?? null))
      : null;

    return () => {
      active = false;
      listener?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  return state;
}
