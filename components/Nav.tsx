"use client";
import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function Nav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data?.user);
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Ignore errors – still redirect
    }
    window.location.href = "/";
  }, []);

  return (
    <nav aria-label="Main Navigation">
      {isLoggedIn && (
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      )}
    </nav>
  );
}
