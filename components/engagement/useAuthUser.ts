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
    supabase.auth.getUser().then(({ data }) => {
      setState({
        userId: data.user?.id || null,
        email: data.user?.email || null,
        loading: false,
      });
    });
  }, []);

  return state;
}
