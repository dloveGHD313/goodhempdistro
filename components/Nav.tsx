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
import {
  type NavContext,
  type NavItem,
  type AppRole,
  getDesktopPrimaryNav,
  getCommunityMenuNav,
  getBusinessMenuNav,
  getAdminMenuNav,
  getAccountMenuNav,
  getMobilePrimaryNav,
  getCtaNav,
  shouldHideNav,
} from "@/lib/nav";

// ── Shared link renderer helpers ──────────────────────────────────────────────
function DesktopDropdown({
  trigger,
  href,
  items,
}: {
  trigger: string;
  href?: string;
  items: NavItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="relative group">
      <HoverLift as="span">
        {href ? (
          <Link href={href} className="nav-link text-sm flex items-center gap-1">
            {trigger} <span className="text-xs">▼</span>
          </Link>
        ) : (
          <button type="button" className="nav-link text-sm flex items-center gap-1">
            {trigger} <span className="text-xs">▼</span>
          </button>
        )}
      </HoverLift>
      <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
        {items.map((item) => (
          <HoverLift key={item.id} as="span">
            <Link
              href={item.href}
              className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm"
            >
              {item.label}
            </Link>
          </HoverLift>
        ))}
      </div>
    </div>
  );
}

function DrawerSection({
  label,
  items,
  onClose,
}: {
  label: string;
  items: NavItem[];
  onClose: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="border-t mt-2 pt-2 nav-drawer-header">
        <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">{label}</div>
      </div>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
          onClick={onClose}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

// ── Extra account link type (for runtime-gated items not in config) ───────────
type ExtraLink = { id: string; label: string; href: string };

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
        console.error("[Nav] status fetch failed", err);
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
        if (payload?.isAdmin) setIsAdmin(true);
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
          const data = (await profileRes.json()) as {
            profile?: { role?: string; roles?: string[] };
          };
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

  // ── Build NavContext from live auth state ─────────────────────────────────
  const isVendorUser = vendorStatus.isVendor || vendorStatus.isAdmin;
  const isVendorSubscribed = vendorStatus.isSubscribed || vendorStatus.isAdmin;
  const showBilling = isVendorSubscribed;

  const roles: AppRole[] = [
    ...(isAdmin ? (["admin"] as AppRole[]) : []),
    ...(isVendorUser ? (["vendor"] as AppRole[]) : []),
  ];

  const navCtx: NavContext = {
    isLoggedIn,
    roles,
    hasWholesaleContext: false, // wholesale state not tracked in Nav currently
  };

  // ── Nav data from canonical config ────────────────────────────────────────
  // Desktop primary: exclude "welcome" when logged in (it's a one-time entry page)
  const desktopPrimaryAll = getDesktopPrimaryNav(navCtx);
  const desktopPrimary = isLoggedIn
    ? desktopPrimaryAll.filter((i) => i.id !== "welcome")
    : desktopPrimaryAll;

  const communityLinks = getCommunityMenuNav(navCtx);
  const businessLinks = getBusinessMenuNav(navCtx);
  const adminLinks = getAdminMenuNav(navCtx);
  const ctaLinks = getCtaNav(navCtx);

  // Mobile primary: split into Public section (audience=public) and Primary section (audience=authed)
  const mobilePrimaryAll = getMobilePrimaryNav(navCtx);
  const mobilePublicLinks = mobilePrimaryAll.filter((i) => i.audience === "public");
  const mobilePrimaryLinks = mobilePrimaryAll.filter((i) => i.audience !== "public");

  // Track every item id already rendered in earlier drawer sections.
  // This prevents any future nav item that spans multiple surfaces from appearing twice.
  const shownInDrawerPrimary = new Set<string>([
    ...mobilePublicLinks.map((i) => i.id),
    ...mobilePrimaryLinks.map((i) => i.id),
  ]);

  // Account menu: config-sourced base + runtime-gated supplements
  const accountMenuBase = getAccountMenuNav(navCtx);

  // Runtime-gated extras not representable as static config (driver, affiliate, dynamic upgrade)
  const extraAccountLinks: ExtraLink[] = [
    ...(driverStatus.hasAccess
      ? [{ id: "driverPortal", label: "🚗 Driver Portal", href: "/driver/dashboard" }]
      : []),
    ...(isAffiliate
      ? [{ id: "affiliatePortal", label: "🤝 Affiliate Portal", href: "/affiliate/portal" }]
      : []),
    // Consumer subscription: if subscribed show rewards label; if not show upgrade
    ...(isLoggedIn && !consumerStatus.isSubscribed && !consumerStatus.isAdmin
      ? [{ id: "consumerUpgrade", label: "⬆️ Upgrade Plan", href: "/pricing?tab=consumer" }]
      : []),
    // Vendor upgrade: only if vendor but not yet subscribed
    ...(isLoggedIn && isVendorUser && !isVendorSubscribed
      ? [{ id: "vendorUpgrade", label: "⬆️ Upgrade Vendor Plan", href: "/pricing?tab=vendor" }]
      : []),
    // Become an affiliate: only if not already one
    ...(isLoggedIn && !isAffiliate
      ? [{ id: "becomeAffiliate", label: "🤝 Become an Affiliate", href: "/affiliate" }]
      : []),
  ];

  // Combine: config items + extra items, deduped by href
  const seenHref = new Set<string>(accountMenuBase.map((i) => i.href));
  const filteredExtras = extraAccountLinks.filter((l) => {
    if (seenHref.has(l.href)) return false;
    seenHref.add(l.href);
    return true;
  });
  const accountLinks: (NavItem | ExtraLink)[] = [...accountMenuBase, ...filteredExtras];

  // Also inject billing link from config if not already present and vendor is subscribed
  const accountHref = isLoggedIn ? "/account" : "/login";

  if (shouldHideNav(pathname)) return null;

  return (
    <nav aria-label="Main Navigation" className="flex items-center justify-between w-full gap-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
        <BrandLogo size={44} className="hidden sm:block" />
        <BrandLogo size={36} className="sm:hidden" />
        <span className="font-bold text-xs sm:text-sm brand-title">{brand.name}</span>
      </Link>

      {/* Desktop primary nav row (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-6 min-w-0 flex-1 justify-center">
        {desktopPrimary.map((item) => (
          <HoverLift key={item.id} as="span">
            <Link href={item.href} className="nav-link text-sm">
              {item.label}
            </Link>
          </HoverLift>
        ))}

        <DesktopDropdown trigger="Community" items={communityLinks} />
        <DesktopDropdown trigger="Business" items={businessLinks} />

        {isAdmin && (
          <DesktopDropdown
            trigger="⚙️ Admin"
            href="/admin/vendors"
            items={adminLinks}
          />
        )}

        {isLoggedIn && (
          <div className="relative group">
            <HoverLift as="span">
              <Link href={accountHref} className="nav-link text-sm flex items-center gap-1">
                Account <span className="text-xs">▼</span>
              </Link>
            </HoverLift>
            <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
              {accountLinks.map((link) => (
                <HoverLift key={link.id} as="span">
                  <Link
                    href={link.href}
                    className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm"
                  >
                    {link.label}
                  </Link>
                </HoverLift>
              ))}
              {showBilling && !accountLinks.some((l) => l.href === "/vendors/billing") && (
                <HoverLift as="span">
                  <Link
                    href="/vendors/billing"
                    className="block px-4 py-2 hover:bg-[var(--surface)]/80 text-sm"
                  >
                    Plan &amp; Billing
                  </Link>
                </HoverLift>
              )}
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

      {/* Desktop right CTAs */}
      <div className="hidden md:flex items-center gap-4 shrink-0 ml-2">
        {ctaLinks.map((item) => (
          <HoverLift key={item.id} as="span" className="shrink-0">
            <Link
              href={item.href}
              className={
                item.id === "joinFree"
                  ? "btn-primary text-sm py-2 px-4 whitespace-nowrap"
                  : "btn-ghost text-sm py-2 px-4 whitespace-nowrap"
              }
            >
              {item.label}
            </Link>
          </HoverLift>
        ))}
      </div>

      {/* Mobile: account shortcut + hamburger */}
      <div className="flex md:hidden items-center gap-3 shrink-0">
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

      {/* Mobile drawer */}
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
            {/* Drawer header */}
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

            <div className="p-6 flex flex-col gap-2">
              {/* CTA section */}
              {isLoggedIn ? (
                <Link
                  href="/account"
                  className="btn-primary text-center py-3 mb-3 font-bold min-h-[44px] flex items-center justify-center"
                  onClick={() => setDrawerOpen(false)}
                >
                  Account
                </Link>
              ) : (
                <>
                  <Link
                    href="/get-started"
                    className="btn-primary text-center py-3 mb-3 font-bold min-h-[44px] flex items-center justify-center"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Join Free
                  </Link>
                  <Link
                    href="/login"
                    className="btn-ghost text-center py-3 mb-4 font-semibold min-h-[44px] flex items-center justify-center"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Sign in
                  </Link>
                </>
              )}

              {/* Public section (audience=public items from mobilePrimary) */}
              {mobilePublicLinks.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Public</div>
                  {mobilePublicLinks.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                      onClick={() => setDrawerOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}

              {/* Primary section (audience=authed items from mobilePrimary) */}
              {mobilePrimaryLinks.length > 0 && (
                <DrawerSection
                  label="Primary"
                  items={mobilePrimaryLinks}
                  onClose={() => setDrawerOpen(false)}
                />
              )}

              {/* Community section */}
              <DrawerSection
                label="Community"
                items={communityLinks}
                onClose={() => setDrawerOpen(false)}
              />

              {/* Business section */}
              <DrawerSection
                label="Business"
                items={businessLinks}
                onClose={() => setDrawerOpen(false)}
              />

              {/* Admin section */}
              {isAdmin && (
                <DrawerSection
                  label="Admin"
                  items={adminLinks}
                  onClose={() => setDrawerOpen(false)}
                />
              )}

              {/* Account section — deduped against items already shown in Public/Primary */}
              {isLoggedIn && (
                <>
                  <div className="border-t mt-4 pt-4 nav-drawer-header">
                    <div className="px-4 py-2 text-xs uppercase text-muted font-semibold">Account</div>
                  </div>
                  {accountLinks
                    .filter((link) => !shownInDrawerPrimary.has(link.id))
                    .map((link) => (
                      <Link
                        key={link.id}
                        href={link.href}
                        className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                        onClick={() => setDrawerOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  {showBilling && !accountLinks.some((l) => l.href === "/vendors/billing") && (
                    <Link
                      href="/vendors/billing"
                      className="px-4 py-3 rounded-lg text-base drawer-link min-h-[44px] flex items-center"
                      onClick={() => setDrawerOpen(false)}
                    >
                      Plan &amp; Billing
                    </Link>
                  )}
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
