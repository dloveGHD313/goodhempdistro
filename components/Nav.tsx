"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const staticLinks = [
  { label: "Products", href: "/products" },
  { label: "Vendors", href: "/vendors" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Nav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
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

  const accountHref = isLoggedIn ? "/dashboard" : "/login";

  return (
    <nav aria-label="Main Navigation" className="flex items-center gap-4">
      {staticLinks.map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-green-400 transition">
          {link.label}
        </Link>
      ))}
      <Link href={accountHref} className="hover:text-green-400 transition">
        Account
      </Link>
      {isLoggedIn && (
        <button
          type="button"
          onClick={handleLogout}
          className="hover:text-green-400 transition"
        >
          Logout
        </button>
      )}
    </nav>
  );
}
