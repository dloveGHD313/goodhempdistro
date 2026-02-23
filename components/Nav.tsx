"use client";
import { useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import { brand } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";
import { HoverLift } from "@/components/motion";

const primaryLinks = [
  { label: "👋 Welcome", href: "/welcome" },
  { label: "🏠 Feed", href: "/newsfeed" },
  { label: "🛍️ Shop", href: "/products" },
  { label: "🧭 Discover", href: "/discover" },
  { label: "🎪 Events", href: "/events" },
  { label: "📺 Episodes", href: "/learning-with-jax" },
];

const communityLinks = [
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "📝 Blog", href: "/blog" },
];

/** Business dropdown: vertical navigation only. No Vendor Dashboard, Vendor Plans, or Affiliate Portal (those live in Account). */
const businessLinks = [
  { label: "🏪 Vendors", href: "/vendors" },
  { label: "🛠️ Services", href: "/services" },
  { label: "🏢 Wholesale", href: "/wholesale" },
  { label: "🚚 Logistics", href: "/logistics" },
  { label: "🚗 Driver Network", href: "/logistics/apply" },
  { label: "🤝 Vendor Registration", href: "/vendor-registration" },
];

const HIDE_NAV_PATHS = ["/signup", "/login", "/get-started", "/onboarding"];

function shouldHideNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
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
  const [driverStatus, setDriverStatus] = useState<{
    hasAccess: boolean;
    isApproved: boolean;
  }>({ hasAccess: false, isApproved: false });
  const [isAffiliate, setIsAffiliate] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const refreshStatus = async (user: { id: string } | null) => {
      if (!active) return;
      setIsLoggedIn(Boolean(user));

      if (!user) {
        setVendorStatus({ isVendor: false, isSubscribed: false, isAdmin: false });
        setConsumerStatus({ isSubscribed: false, isAdmin: false });
        setIsAdmin(false);
        setDriverStatus({ hasAccess: false, isApproved: false });
        setIsAffiliate(false);
        return;
      }

      let response: Response | null = null;
      let consumerResponse: Response | null = null;
      let driverResponse: Response | null = null;
      try {
        response = await fetch("/api/vendor/status", { cache: "no-store" });
        consumerResponse = await fetch("/api/consumer/status", { cache: "no-store" });
        driverResponse = await fetch("/api/driver/me", { cache: "no-store" });
      } catch (err) {
        console.error("[Nav] vendor status fetch failed", err);
      }

      if (!active) return;

      if (response && response.ok) {
        const payload = await response.json();
        setVendorStatus({
          isVendor: Boolean(payload?.isVendor),
          isSubscribed: Boolean(payload?.isSubscribed),
          isAdmin: Boolean(payload?.isAdmin),
        });
        setIsAdmin(Boolean(payload?.isAdmin));
      } else {
        setVendorStatus({ isVendor: false, isSubscribed: false, isAdmin: false });
      }

      if (consumerResponse && consumerResponse.ok) {
        const payload = await consumerResponse.json();
        setConsumerStatus({
          isSubscribed: Boolean(payload?.isSubscribed),
          isAdmin: Boolean(payload?.isAdmin),
        });
        if (payload?.isAdmin) {
          setIsAdmin(true);
        }
      } else {
        setConsumerStatus({ isSubscribed: false, isAdmin: false });
      }

      if (driverResponse && driverResponse.ok) {
        const payload = await driverResponse.json();
        setDriverStatus({
          hasAccess: Boolean(payload?.driver || payload?.application),
          isApproved: payload?.driver?.status === "approved",
        });
      } else {
        setDriverStatus({ hasAccess: false, isApproved: false });
      }

      try {
        const { data: affiliate } = await supabase
          .from("affiliates")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        setIsAffiliate(Boolean(affiliate?.id));
      } catch (err) {
        console.warn("[Nav] affiliate lookup failed", err);
        setIsAffiliate(false);
      }

      try {
        const profileRes = await fetch("/api/profile", { cache: "no-store" });
        if (active && profileRes.ok) {
          const data = (await profileRes.json()) as { profile?: { role?: string; roles?: string[] } };
          const p = data?.profile;
          const profile =
            p && (p.role != null || Array.isArray(p.roles))
              ? { role: p.role ?? null, roles: p.roles ?? null }
              : null;
          if (profile && hasRole(profile, "admin")) setIsAdmin(true);
        }
      } catch (err) {
        console.warn("[Nav] profile fetch failed", err);
      }
    };

    supabase.auth.getUser().then(({ data }) => refreshStatus(data.user ?? null));
    const authListener = supabase.auth.onAuthStateChange
      ? supabase.auth.onAuthStateChange((_event, session) => {
          refreshStatus(session?.user ?? null);
        })
      : null;

    return () => {
      active = false;
      authListener?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    flushSync(() => {
      setDrawerOpen(false);
      setIsLoggedIn(false);
      setIsAdmin(false);
      setVendorStatus({ isVendor: false, isSubscribed: false, isAdmin: false });
      setConsumerStatus({ isSubscribed: false, isAdmin: false });
      setDriverStatus({ hasAccess: false, isApproved: false });
      setIsAffiliate(false);
    });
    const supabase = createSupabaseBrowserClient();
    try {
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Ignore errors – still redirect
    }
    router.replace("/");
    router.refresh();
  }, [router]);

  const accountHref = isLoggedIn ? "/account" : "/login";
  const showBilling = vendorStatus.isSubscribed || vendorStatus.isAdmin;
  const isVendorUser = vendorStatus.isVendor || vendorStatus.isAdmin;
  const isVendorSubscribed = vendorStatus.isSubscribed || vendorStatus.isAdmin;

  const consumerLink =
    consumerStatus.isSubscribed || consumerStatus.isAdmin
      ? { label: "⭐ My Subscription", href: "/account/subscription" }
      : { label: "⬆️ Upgrade", href: "/pricing?tab=consumer" };

  const dashboardLinks: { label: string; href: string }[] = [];
  if (isLoggedIn) {
    if (isVendorUser) dashboardLinks.push({ label: "Vendor Dashboard", href: "/vendors/dashboard" });
    if (driverStatus.hasAccess) dashboardLinks.push({ label: "Driver Portal", href: "/driver/dashboard" });
    if (isAffiliate) dashboardLinks.push({ label: "Affiliate Portal", href: "/affiliate/portal" });
  }
  const accountLinksRaw = [
    { label: "Account Overview", href: "/account" },
    ...dashboardLinks,
    ...(isLoggedIn ? [{ label: "Go to Feed", href: "/newsfeed" }] : []),
    { label: "Favorites", href: "/account/favorites" },
    ...(consumerStatus.isSubscribed || consumerStatus.isAdmin
      ? [{ label: "Rewards", href: "/account/subscription" }]
      : []),
    ...(showBilling ? [{ label: "Billing", href: "/vendors/billing" }] : []),
    ...(isLoggedIn ? [consumerLink] : []),
    ...(isLoggedIn && isVendorUser && !isVendorSubscribed
      ? [{ label: "Upgrade", href: "/pricing?tab=vendor" }]
      : []),
    ...(isLoggedIn && !isAffiliate ? [{ label: "Become an Affiliate", href: "/affiliate" }] : []),
  ];
  const seenHref = new Set<string>();
  const accountLinks = accountLinksRaw.filter((link) => {
    if (seenHref.has(link.href)) return false;
    seenHref.add(link.href);
    return true;
  });

  const navPrimaryLinks = isLoggedIn ? primaryLinks.filter((l) => l.href !== "/welcome") : primaryLinks;

  if (shouldHideNav(pathname)) return null;

  return (
    <nav aria-label="Main Navigation" className="flex items-center justify-between w-full gap-4">
      {/* Logo/Brand - Visible on all sizes */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
        <BrandLogo size={44} className="hidden sm:block" />
        <BrandLogo size={36} className="sm:hidden" />
        <span className="font-bold text-xs sm:text-sm brand-title">
          {brand.name}
        </span>
      </Link>

      {/* Desktop nav - hidden on mobile; Welcome excluded when logged in */}
      <div className="hidden lg:flex items-center gap-6 min-w-0 flex-1 justify-center">
        {navPrimaryLinks.map((link) => (
          <HoverLift key={link.href} as="span">
            <Link href={link.href} className="nav-link text-sm">
              {link.label}
            </Link>
          </HoverLift>
        ))}

        <div className="relative group">
          <button type="button" className="nav-link text-sm flex items-center gap-1">
            Community <span className="text-xs">▼</span>
          </button>
          <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
            {communityLinks.map((link) => (
              <HoverLift key={link.href} as="span">
                <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  {link.label}
                </Link>
              </HoverLift>
            ))}
          </div>
        </div>

        <div className="relative group">
          <button type="button" className="nav-link text-sm flex items-center gap-1">
            Business <span className="text-xs">▼</span>
          </button>
          <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[220px]">
            {businessLinks.map((link) => (
              <HoverLift key={link.href} as="span">
                <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  {link.label}
                </Link>
              </HoverLift>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="relative group">
            <HoverLift as="span">
              <Link href="/admin/vendors" className="nav-link text-sm flex items-center gap-1">
                ⚙️ Admin
                <span className="text-xs">▼</span>
              </Link>
            </HoverLift>
            <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px]">
              <HoverLift as="span">
                <Link href="/admin/vendors" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  👥 Vendor Applications
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/products" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  📦 Product Review
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/events" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  📅 Event Review
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/services" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  🛠️ Service Review
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/inquiries" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  💬 Service Inquiries
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/categories" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  📁 Categories
                </Link>
              </HoverLift>
              <HoverLift as="span">
                <Link href="/admin/drivers" className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                  🚗 Drivers
                </Link>
              </HoverLift>
            </div>
          </div>
        )}

        {isLoggedIn && (
          <div className="relative group">
            <HoverLift as="span">
              <Link href={accountHref} className="nav-link text-sm flex items-center gap-1">
                Account
                <span className="text-xs">▼</span>
              </Link>
            </HoverLift>
            <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
              {accountLinks.map((link) => (
                <HoverLift key={link.href} as="span">
                  <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm">
                    {link.label}
                  </Link>
                </HoverLift>
              ))}
              <div className="border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-[var(--surface)]/80 text-sm nav-logout"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile/Tablet: when logged in only Account + Menu; when logged out Join Free + Sign in + Menu */}
      <div className="flex items-center gap-3 lg:hidden shrink-0">
        {isLoggedIn ? (
          <HoverLift as="span" className="shrink-0">
            <Link href={accountHref} className="btn-ghost text-sm py-2 px-4 whitespace-nowrap">
              Account
            </Link>
          </HoverLift>
        ) : (
          <>
            <HoverLift as="span" className="shrink-0">
              <Link href="/get-started" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                Join Free
              </Link>
            </HoverLift>
            <HoverLift as="span" className="shrink-0">
              <Link href="/login" className="btn-ghost text-sm py-2 px-4 whitespace-nowrap">
                Sign in
              </Link>
            </HoverLift>
          </>
        )}
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

      {/* Desktop right: when logged out, Join Free + Sign in with gap; when logged in, single Account only (no extra CTA) */}
      <div className="hidden lg:flex items-center gap-4 shrink-0 ml-2">
        {isLoggedIn ? null : (
          <>
            <HoverLift as="span" className="shrink-0">
              <Link href="/get-started" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                Join Free
              </Link>
            </HoverLift>
            <HoverLift as="span" className="shrink-0">
              <Link href="/login" className="btn-ghost text-sm py-2 px-4 whitespace-nowrap">
                Sign in
              </Link>
            </HoverLift>
          </>
        )}
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
              {/* Prominent CTA in drawer: when logged in single Account hub; when logged out Join Free + Sign in */}
              {isLoggedIn ? (
                <Link
                  href="/account"
                  className="btn-primary text-center py-3 mb-3 font-bold"
                  onClick={() => setDrawerOpen(false)}
                >
                  Account
                </Link>
              ) : (
                <>
                  <Link
                    href="/get-started"
                    className="btn-primary text-center py-3 mb-3 font-bold"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Join Free
                  </Link>
                  <Link
                    href="/login"
                    className="btn-ghost text-center py-2 mb-4 font-semibold"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Sign in
                  </Link>
                </>
              )}

              <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Primary</div>
              {navPrimaryLinks.map((link) => (
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
