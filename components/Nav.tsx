"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const navLinks = [
  { label: "🏠 Feed", href: "/newsfeed" },
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "🛍️ Shop", href: "/products" },
  { label: "📝 Blog", href: "/blog" },
  { label: "🏢 Wholesale", href: "/wholesale" },
  { label: "🎪 Events", href: "/events" },
  { label: "🤝 Vendor Registration", href: "/vendor-registration" },
  { label: "💰 Affiliate", href: "/affiliate" },
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
    <nav aria-label="Main Navigation" className="flex items-center justify-between w-full">
      {/* Logo/Brand - Visible on all sizes */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <Image
          src="/logo.png"
          alt="Good Hemp Distros Logo"
          width={40}
          height={40}
          className="hidden sm:block"
          priority
        />
        <Image
          src="/logo.png"
          alt="Good Hemp Distros Logo"
          width={32}
          height={32}
          className="sm:hidden"
          priority
        />
        <span className="hidden md:inline font-bold text-sm" style={{ color: "var(--gh-green)" }}>
          Good Hemp Distros
        </span>
      </Link>

      {/* Desktop nav - hidden on mobile */}
      <div className="hidden lg:flex items-center gap-6">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-[var(--gh-green)] transition text-sm">
            {link.label}
          </Link>
        ))}
        <Link href={accountHref} className="hover:text-[var(--gh-green)] transition text-sm">
          Account
        </Link>
      </div>

      {/* Mobile/Tablet: Get Started + Menu Hamburger */}
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/get-started" className="btn-cta text-sm py-2 px-4">
          Get Started
        </Link>
        <button
          type="button"
          aria-label="Open Menu"
          onClick={() => setDrawerOpen(true)}
          className="text-[var(--gh-green)] text-2xl p-2"
        >
          ☰
        </button>
      </div>

      {/* Desktop: Get Started button */}
      <div className="hidden lg:flex items-center gap-4">
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm hover:text-[var(--gh-amber)] transition"
          >
            Logout
          </button>
        )}
        <Link href="/get-started" className="btn-cta text-sm py-2 px-4">
          Get Started
        </Link>
      </div>

      {/* Mobile drawer - full screen overlay style */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="fixed left-0 top-0 bottom-0 w-72 bg-[var(--gh-surface)] shadow-2xl overflow-y-auto transform transition-transform"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRight: "2px solid var(--gh-green)" }}
          >
            {/* Drawer Header with Logo */}
            <div className="p-6 border-b border-[var(--gh-green)]/30 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
                <Image
                  src="/logo.png"
                  alt="Good Hemp Distros Logo"
                  width={32}
                  height={32}
                  priority
                />
                <span className="font-bold text-sm" style={{ color: "var(--gh-green)" }}>Good Hemp</span>
              </Link>
              <button 
                type="button" 
                onClick={() => setDrawerOpen(false)} 
                className="text-[var(--gh-amber)] text-2xl hover:scale-110 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 flex flex-col gap-2">
              {/* Prominent Get Started in drawer */}
              <Link
                href="/get-started"
                className="btn-cta text-center py-3 mb-4 font-bold"
                onClick={() => setDrawerOpen(false)}
              >
                🚀 Get Started
              </Link>

              {/* Main nav links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg hover:bg-[var(--gh-green)]/20 transition text-base"
                  style={{ borderLeft: "3px solid transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = "var(--gh-green)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = "transparent")}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Account & Logout */}
              <div className="border-t border-[var(--gh-green)]/30 mt-4 pt-4">
                <Link
                  href={accountHref}
                  className="px-4 py-3 rounded-lg hover:bg-[var(--gh-green)]/20 transition text-base block"
                  onClick={() => setDrawerOpen(false)}
                >
                  {isLoggedIn ? "📊 Dashboard" : "🔐 Login"}
                </Link>
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-[var(--gh-amber)]/20 transition text-base mt-2"
                  >
                    🚪 Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
