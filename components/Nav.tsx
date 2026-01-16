"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const desktopLinks = [
  { label: "News Feed", href: "/newsfeed" },
  { label: "Groups", href: "/groups" },
  { label: "Forums", href: "/forums" },
  { label: "Shop", href: "/products" },
  { label: "Blog", href: "/blog" },
  { label: "Wholesale", href: "/wholesale" },
  { label: "Events", href: "/events" },
  { label: "Vendor Registration", href: "/vendor-registration" },
  { label: "Affiliate", href: "/affiliate" },
];

export default function Nav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-4">
        {desktopLinks.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-[var(--accent-green)] transition">
            {link.label}
          </Link>
        ))}
        <Link href={accountHref} className="hover:text-[var(--accent-green)] transition">
          Account
        </Link>
        <Link href="/get-started" className="btn-cta">
          Get Started
        </Link>
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            className="hover:text-[var(--accent-orange)] transition"
          >
            Logout
          </button>
        )}
      </div>

      {/* Mobile icons + hamburger */}
      <div className="md:hidden flex items-center gap-3">
        <Link href="/search" aria-label="Search" className="text-[var(--accent-green)]">🔎</Link>
        <Link href="/cart" aria-label="Cart" className="text-[var(--accent-green)]">🛒</Link>
        <Link href={accountHref} aria-label="Account" className="text-[var(--accent-green)]">👤</Link>
        <button
          type="button"
          aria-label="Open Menu"
          onClick={() => setDrawerOpen(true)}
          className="text-[var(--accent-orange)] text-2xl"
        >
          ☰
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDrawerOpen(false)}>
          <div
            className="fixed left-0 top-0 bottom-0 w-80 bg-[var(--surface)] border-r border-[#233047] p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold">Menu</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              {desktopLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded hover:bg-[var(--surface-light)]"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/affiliate"
                className="px-3 py-2 rounded hover:bg-[var(--surface-light)]"
                onClick={() => setDrawerOpen(false)}
              >
                Affiliate
              </Link>
              <Link
                href={accountHref}
                className="px-3 py-2 rounded hover:bg-[var(--surface-light)]"
                onClick={() => setDrawerOpen(false)}
              >
                Account
              </Link>
              <Link
                href="/get-started"
                className="btn-cta text-center"
                onClick={() => setDrawerOpen(false)}
              >
                Get Started
              </Link>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setDrawerOpen(false);
                  }}
                  className="px-3 py-2 rounded hover:bg-[var(--surface-light)] text-left"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
