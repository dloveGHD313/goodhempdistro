"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { brand } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

const primaryLinks = [
  { label: "🏠 Feed", href: "/newsfeed" },
  { label: "🛍️ Shop", href: "/products" },
  { label: "🧭 Discover", href: "/discover" },
  { label: "🎪 Events", href: "/events" },
];

const communityLinks = [
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "📝 Blog", href: "/blog" },
];

const businessLinksBase = [
  { label: "🏪 Vendors", href: "/vendors" },
  { label: "🛠️ Services", href: "/services" },
  { label: "🏢 Wholesale", href: "/wholesale" },
  { label: "💰 Affiliate", href: "/affiliate" },
  { label: "🤝 Vendor Registration", href: "/vendor-registration" },
];

export default function Nav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vendorStatus, setVendorStatus] = useState<{
    isVendor: boolean;
    isSubscribed: boolean;
    isAdmin: boolean;
  }>({ isVendor: false, isSubscribed: false, isAdmin: false });
  const [consumerStatus, setConsumerStatus] = useState<{
    isSubscribed: boolean;
    isAdmin: boolean;
  }>({ isSubscribed: false, isAdmin: false });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setIsLoggedIn(!!data.user);
      if (data.user) {
        let response: Response | null = null;
        let consumerResponse: Response | null = null;
        try {
          response = await fetch("/api/vendor/status", { cache: "no-store" });
          consumerResponse = await fetch("/api/consumer/status", { cache: "no-store" });
        } catch (err) {
          console.error("[Nav] vendor status fetch failed", err);
        }
        if (response && response.ok) {
          const payload = await response.json();
          setVendorStatus({
            isVendor: Boolean(payload?.isVendor),
            isSubscribed: Boolean(payload?.isSubscribed),
            isAdmin: Boolean(payload?.isAdmin),
          });
          setIsAdmin(Boolean(payload?.isAdmin));
        }
        if (consumerResponse && consumerResponse.ok) {
          const payload = await consumerResponse.json();
          setConsumerStatus({
            isSubscribed: Boolean(payload?.isSubscribed),
            isAdmin: Boolean(payload?.isAdmin),
          });
        }
      } else {
        setVendorStatus({ isVendor: false, isSubscribed: false, isAdmin: false });
        setConsumerStatus({ isSubscribed: false, isAdmin: false });
      }
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

  const accountHref = "/account";
  const showBilling = vendorStatus.isSubscribed || vendorStatus.isAdmin;

  const vendorLink = vendorStatus.isAdmin
    ? { label: "🏪 Vendor Dashboard", href: "/vendors/dashboard" }
    : vendorStatus.isVendor
      ? vendorStatus.isSubscribed
        ? { label: "🏪 Vendor Dashboard", href: "/vendors/dashboard" }
        : { label: "💳 Vendor Plans", href: "/pricing?tab=vendor&reason=subscription_required" }
      : { label: "🤝 Vendor Registration", href: "/vendor-registration" };

  const vendorLinks = vendorStatus.isAdmin
    ? [vendorLink, { label: "💳 Vendor Plans", href: "/pricing?tab=vendor" }]
    : [vendorLink];

  const consumerLink =
    consumerStatus.isSubscribed || consumerStatus.isAdmin
      ? { label: "⭐ My Subscription", href: "/account/subscription" }
      : { label: "⬆️ Upgrade", href: "/pricing?tab=consumer" };

  const consumerRewardsLink =
    consumerStatus.isSubscribed || consumerStatus.isAdmin
      ? { label: "🎁 Rewards", href: "/account/subscription" }
      : null;

  const businessLinks = [
    ...businessLinksBase.filter((link) => link.href !== vendorLink.href),
    ...vendorLinks,
  ];

  const accountLinks = [
    { label: "Account Overview", href: "/account" },
    { label: "Favorites", href: "/account/favorites" },
    ...(consumerStatus.isSubscribed || consumerStatus.isAdmin
      ? [{ label: "Rewards", href: "/account/subscription" }]
      : []),
    ...(showBilling ? [{ label: "Billing", href: "/vendors/billing" }] : []),
    ...(isLoggedIn ? [consumerLink] : []),
  ];

  return (
    <nav aria-label="Main Navigation" className="flex items-center justify-between w-full">
      {/* Logo/Brand - Visible on all sizes */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
        <BrandLogo size={44} className="hidden sm:block" />
        <BrandLogo size={36} className="sm:hidden" />
        <span className="font-bold text-xs sm:text-sm brand-title">
          {brand.name}
        </span>
      </Link>

      {/* Desktop nav - hidden on mobile */}
      <div className="hidden lg:flex items-center gap-6">
        {primaryLinks.map((link) => (
          <Link key={link.href} href={link.href} className="nav-link text-sm">
            {link.label}
          </Link>
        ))}

        <div className="relative group">
          <button type="button" className="nav-link text-sm flex items-center gap-1">
            Community <span className="text-xs">▼</span>
          </button>
          <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
            {communityLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="relative group">
          <button type="button" className="nav-link text-sm flex items-center gap-1">
            Business <span className="text-xs">▼</span>
          </button>
          <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[220px]">
            {businessLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="relative group">
            <Link href="/admin/vendors" className="nav-link text-sm flex items-center gap-1">
              ⚙️ Admin
              <span className="text-xs">▼</span>
            </Link>
            <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px]">
              <Link href="/admin/vendors" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                👥 Vendor Applications
              </Link>
              <Link href="/admin/products" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                📦 Product Review
              </Link>
              <Link href="/admin/events" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                📅 Event Review
              </Link>
              <Link href="/admin/services" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                🛠️ Service Review
              </Link>
              <Link href="/admin/inquiries" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                💬 Service Inquiries
              </Link>
              <Link href="/admin/categories" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                📁 Categories
              </Link>
            </div>
          </div>
        )}

        {isLoggedIn ? (
          <div className="relative group">
            <Link href={accountHref} className="nav-link text-sm flex items-center gap-1">
              Account
              <span className="text-xs">▼</span>
            </Link>
            <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
              {accountLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Link href={accountHref} className="nav-link text-sm">
            Account
          </Link>
        )}
      </div>

      {/* Mobile/Tablet: Join Free + Menu Hamburger */}
      <div className="flex items-center gap-2 lg:hidden">
        <Link href="/get-started" className="btn-primary text-sm py-2 px-4">
          Join Free
        </Link>
        <button
          type="button"
          aria-label="Open Menu"
          onClick={() => setDrawerOpen(true)}
          className="text-2xl p-2"
          style={{ color: brand.colors.lime }}
        >
          ☰
        </button>
      </div>

      {/* Desktop: Join / Logout */}
      <div className="hidden lg:flex items-center gap-4">
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm hover:opacity-80 transition nav-logout"
          >
            Logout
          </button>
        )}
        <Link href="/get-started" className="btn-primary text-sm py-2 px-4">
          Join Free
        </Link>
      </div>

      {/* Mobile drawer - full screen overlay style */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden nav-overlay"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="fixed left-0 top-0 bottom-0 w-72 shadow-2xl overflow-y-auto transform transition-transform nav-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header with Logo */}
            <div className="p-6 flex items-center justify-between nav-drawer-header">
              <Link href="/" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
                <BrandLogo size={32} />
                <span className="font-bold text-sm brand-title">Good Hemp</span>
              </Link>
              <button 
                type="button" 
                onClick={() => setDrawerOpen(false)} 
                className="text-2xl hover:scale-110 transition"
                style={{ color: brand.colors.orange }}
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
                className="btn-primary text-center py-3 mb-4 font-bold"
                onClick={() => setDrawerOpen(false)}
              >
                🚀 Join Free
              </Link>

              <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Primary</div>
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Community</div>
              </div>
              {communityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Business</div>
              </div>
              {businessLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Admin links */}
              {isAdmin && (
                <>
                  <div className="border-t mt-2 pt-2 nav-drawer-header">
                    <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Admin</div>
                  </div>
                  <Link
                    href="/admin/vendors"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    👥 Vendor Applications
                  </Link>
                  <Link
                    href="/admin/vendors/integrity"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    🔍 Vendor Integrity
                  </Link>
                  <Link
                    href="/admin/products"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    📦 Product Review
                  </Link>
                  <Link
                    href="/admin/events"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    📅 Event Review
                  </Link>
                  <Link
                    href="/admin/services"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    🛠️ Service Review
                  </Link>
                  <Link
                    href="/admin/inquiries"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    💬 Service Inquiries
                  </Link>
                  <Link
                    href="/admin/categories"
                    className="px-4 py-3 rounded-lg text-base drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    📁 Categories
                  </Link>
                </>
              )}

              {/* Account & Logout */}
              <div className="border-t mt-4 pt-4 nav-drawer-header">
                <Link
                  href={accountHref}
                  className="px-4 py-3 rounded-lg text-base block drawer-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  {isLoggedIn ? "👤 Account" : "🔐 Login"}
                </Link>
                {isLoggedIn && (
                  <Link
                    href="/account/favorites"
                    className="px-4 py-3 rounded-lg text-base block drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    ⭐ Favorites
                  </Link>
                )}
                {isLoggedIn && showBilling && (
                  <Link
                    href="/vendors/billing"
                    className="px-4 py-3 rounded-lg text-base block drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    💳 Billing
                  </Link>
                )}
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg text-base mt-2 nav-logout"
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
