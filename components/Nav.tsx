"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import { brand } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";
import { HoverLift } from "@/components/motion";
import {
  NAV_PRIMARY,
  NAV_COMMUNITY,
  NAV_BUSINESS,
  NAV_ADMIN,
  NAV_PUBLIC,
  NAV_MOBILE_DISCOVERY,
  NAV_SERVICES,
  shouldHideNav,
  getCtaNav,
  DEFAULT_NAV_CTX,
  type NavContext,
  type AppRole,
  type UserRole,
  type VendorPlanStatus,
  type ConsumerPlanStatus,
} from "@/lib/nav";

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
  const [consumerLoaded, setConsumerLoaded] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

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
        setConsumerLoaded(false);
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

      try {
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
      } finally {
        setConsumerLoaded(true);
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

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
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
      setConsumerLoaded(false); // fix: reset consumerLoaded on logout to prevent CTA flash regression
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

  const navPrimaryLinks = isLoggedIn ? NAV_PRIMARY.filter((l) => l.href !== "/welcome") : NAV_PRIMARY;
  const desktopPrimaryLinks = navPrimaryLinks.filter(
    (link) => link.href !== "/welcome" && (isLoggedIn || link.href !== "/newsfeed")
  );
  const mobilePublicLinks = NAV_PUBLIC;
  const mobileDiscoveryLinks = NAV_MOBILE_DISCOVERY;
  const mobilePrimaryLinks = navPrimaryLinks.filter((link) => !NAV_PUBLIC.some((p) => p.href === link.href));
  const mobileCommunityLinks = NAV_COMMUNITY;
  const businessLinks = NAV_BUSINESS;
  const mobileBusinessLinks = businessLinks;
  const servicesLinks = NAV_SERVICES;

  // Build canonical NavContext from existing auth state so getCtaNav is model-driven.
  const navRoles: AppRole[] = [];
  if (isVendorUser) navRoles.push("vendor");
  if (isAdmin) navRoles.push("admin");

  const navRole: UserRole = !isLoggedIn
    ? "public"
    : isAdmin
      ? "admin"
      : isVendorUser
        ? "vendor"
        : "user";

  const navVendorPlan: VendorPlanStatus = !isVendorUser
    ? "unknown"
    : isVendorSubscribed
      ? "starter"
      : "none";

  const navConsumerPlan: ConsumerPlanStatus =
    !isLoggedIn
      ? "unknown"
      : !consumerLoaded
        ? "unknown"
        : consumerStatus.isSubscribed
          ? "basic"
          : "none";

  const navCtx: NavContext = {
    ...DEFAULT_NAV_CTX,
    isLoggedIn,
    roles: navRoles,
    role: navRole,
    vendorPlan: navVendorPlan,
    consumerPlan: navConsumerPlan,
  };
  const ctaItems = getCtaNav(navCtx);

  if (shouldHideNav(pathname)) return null;

  return (
    <nav ref={navRef} aria-label="Main Navigation" className="flex items-center justify-between w-full gap-4">
      {/* Logo/Brand - Visible on all sizes */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
        <BrandLogo size={44} className="hidden sm:block" />
        <BrandLogo size={36} className="sm:hidden" />
        <span className="font-bold text-xs sm:text-sm brand-title">
          {brand.name}
        </span>
      </Link>

      {/* Desktop nav - hidden on mobile; primary links only */}
      <div className="hidden md:flex items-center gap-6 flex-1 min-w-0 justify-center overflow-x-auto scrollbar-hide">
        {desktopPrimaryLinks.map((link) => (
          <HoverLift key={link.href} as="span">
            <Link href={link.href} className="nav-link text-sm whitespace-nowrap">
              {link.label}
            </Link>
          </HoverLift>
        ))}

        <div className="relative group">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "community" ? null : "community"))}
            className="nav-link text-sm whitespace-nowrap flex items-center gap-1"
          >
            Community <span className="text-xs">▼</span>
          </button>
          <div className={`absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all z-50 min-w-[200px] ${openMenu === "community" ? "opacity-100 visible" : "opacity-0 invisible"} group-hover:opacity-100 group-hover:visible`}>
            {NAV_COMMUNITY.map((link) => (
              <HoverLift key={link.href} as="span">
                <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm whitespace-nowrap">
                  {link.label}
                </Link>
              </HoverLift>
            ))}
          </div>
        </div>

        <div className="relative group">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "business" ? null : "business"))}
            className="nav-link text-sm whitespace-nowrap flex items-center gap-1"
          >
            Business <span className="text-xs">▼</span>
          </button>
          <div className={`absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all z-50 min-w-[220px] ${openMenu === "business" ? "opacity-100 visible" : "opacity-0 invisible"} group-hover:opacity-100 group-hover:visible`}>
            {businessLinks.map((link) => (
              <HoverLift key={link.href} as="span">
                <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm whitespace-nowrap">
                  {link.label}
                </Link>
              </HoverLift>
            ))}
          </div>
        </div>

        <div className="relative group">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === "services" ? null : "services"))}
            className="nav-link text-sm whitespace-nowrap flex items-center gap-1"
          >
            Services <span className="text-xs">▼</span>
          </button>
          <div className={`absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all z-50 min-w-[220px] ${openMenu === "services" ? "opacity-100 visible" : "opacity-0 invisible"} group-hover:opacity-100 group-hover:visible`}>
            {servicesLinks.map((link) => (
              <HoverLift key={link.href} as="span">
                <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm whitespace-nowrap">
                  {link.label}
                </Link>
              </HoverLift>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="relative group">
            <HoverLift as="span">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === "admin" ? null : "admin"))}
                className="nav-link text-sm whitespace-nowrap flex items-center gap-1"
              >
                ⚙️ Admin
                <span className="text-xs">▼</span>
              </button>
            </HoverLift>
            <div className={`absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all z-50 min-w-[180px] ${openMenu === "admin" ? "opacity-100 visible" : "opacity-0 invisible"} group-hover:opacity-100 group-hover:visible`}>
              {NAV_ADMIN.map((link) => (
                <HoverLift key={link.href} as="span">
                  <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm whitespace-nowrap">
                    {link.label}
                  </Link>
                </HoverLift>
              ))}
            </div>
          </div>
        )}

        {isLoggedIn && (
          <div className="relative group">
            <HoverLift as="span">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === "account" ? null : "account"))}
                className="nav-link text-sm whitespace-nowrap flex items-center gap-1"
              >
                Account
                <span className="text-xs">▼</span>
              </button>
            </HoverLift>
            <div className={`absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all z-50 min-w-[200px] ${openMenu === "account" ? "opacity-100 visible" : "opacity-0 invisible"} group-hover:opacity-100 group-hover:visible`}>
              {accountLinks.map((link) => (
                <HoverLift key={link.href} as="span">
                  <Link href={link.href} className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm whitespace-nowrap">
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

      {/* Mobile: hamburger + Account/CTA items */}
      <div className="flex md:hidden items-center gap-3 shrink-0">
        {isLoggedIn ? (
          <HoverLift as="span" className="shrink-0">
            <Link href={accountHref} className="btn-ghost text-sm py-2 px-4 whitespace-nowrap">
              Account
            </Link>
          </HoverLift>
        ) : (
          ctaItems.map((item) => (
            <HoverLift key={item.id} as="span" className="shrink-0">
              <Link
                href={item.href}
                className={
                  item.id === "cta-sign-in"
                    ? "btn-ghost text-sm py-2 px-4 whitespace-nowrap"
                    : "btn-primary text-sm py-2 px-4 whitespace-nowrap"
                }
              >
                {item.label}
              </Link>
            </HoverLift>
          ))
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

      {/* Desktop right: model-driven CTAs via getCtaNav (Join Free / Sign in / Add Product) */}
      <div className="hidden md:flex items-center gap-4 shrink-0 ml-2">
        {ctaItems.map((item) => (
          <HoverLift key={item.id} as="span" className="shrink-0">
            <Link
              href={item.href}
              className={
                item.id === "cta-sign-in"
                  ? "btn-ghost text-sm py-2 px-4 whitespace-nowrap"
                  : "btn-primary text-sm py-2 px-4 whitespace-nowrap"
              }
            >
              {item.label}
            </Link>
          </HoverLift>
        ))}
      </div>

      {/* Mobile drawer - full-height slide-in panel */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden nav-overlay"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
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

            {/* Drawer Content — same links as desktop, 44px min tap target */}
            <div className="p-6 flex flex-col gap-2">
              {/* Prominent CTA: logged in → Account hub; logged out → model-driven CTAs */}
              {isLoggedIn ? (
                <Link
                  href="/account"
                  className="btn-primary text-center py-3 mb-3 font-bold min-h-[44px] flex items-center justify-center"
                  onClick={() => setDrawerOpen(false)}
                >
                  Account
                </Link>
              ) : (
                ctaItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={
                      item.id === "cta-sign-in"
                        ? "btn-ghost text-center py-3 mb-4 font-semibold min-h-[44px] flex items-center justify-center"
                        : "btn-primary text-center py-3 mb-3 font-bold min-h-[44px] flex items-center justify-center"
                    }
                    onClick={() => setDrawerOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))
              )}

              <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Public</div>
              {mobilePublicLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {mobileDiscoveryLinks.length > 0 && (
                <>
                  <div className="border-t mt-2 pt-2 nav-drawer-header">
                    <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Discover</div>
                  </div>
                  {mobileDiscoveryLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                      onClick={() => setDrawerOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Primary</div>
              </div>
              {mobilePrimaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Community</div>
              </div>
              {mobileCommunityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <button
                  type="button"
                  onClick={() => setOpenMenu((m) => (m === "mobile-business" ? null : "mobile-business"))}
                  className="px-4 py-2 text-xs uppercase text-muted font-semibold w-full text-left"
                >
                  Business
                </button>
              </div>
              {openMenu === "mobile-business" &&
                mobileBusinessLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                    onClick={() => setDrawerOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

              <div className="border-t mt-2 pt-2 nav-drawer-header">
                <button
                  type="button"
                  onClick={() => setOpenMenu((m) => (m === "mobile-services" ? null : "mobile-services"))}
                  className="px-4 py-2 text-xs uppercase text-muted font-semibold w-full text-left"
                >
                  Services
                </button>
              </div>
              {openMenu === "mobile-services" &&
                servicesLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                    onClick={() => setDrawerOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

              {isAdmin && (
                <>
                  <div className="border-t mt-2 pt-2 nav-drawer-header">
                    <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Admin</div>
                  </div>
                  {NAV_ADMIN.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                      onClick={() => setDrawerOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}

              {isLoggedIn && (
                <>
                  <div className="border-t mt-4 pt-4 nav-drawer-header">
                    <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Account</div>
                  </div>
                  {accountLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                      onClick={() => setDrawerOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      handleLogout();
                      setDrawerOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg text-base nav-logout min-h-[44px] flex items-center"
                  >
                    🚪 Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
