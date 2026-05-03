// lib/nav.ts
// Single source of truth for ALL navigation.
// Goal: mobile + desktop render from the same config, filtered by auth/roles.
// Keep labels stable (CEO-approved hierarchy) and avoid duplicate hrefs.

// ---------------- Types ----------------
export type AppRole = "user" | "vendor" | "wholesale" | "admin";

/** Simplified single-role value for CTA logic. Derived from roles[] in Nav.tsx. */
export type UserRole = "public" | "user" | "vendor" | "admin";

/** Vendor subscription tier visible in nav. "unknown" = cannot determine; treat as "none" for CTA. */
export type VendorPlanStatus = "none" | "starter" | "mid" | "top" | "unknown";

/** Consumer subscription tier visible in nav. "unknown" = cannot determine; suppress upgrade CTA. */
export type ConsumerPlanStatus = "none" | "basic" | "plus" | "pro" | "unknown";

export type NavAudience =
  | "public" // always visible (logged out + logged in)
  | "authed" // any logged-in user
  | "vendor" // vendor role
  | "wholesale" // wholesale role OR has wholesale application in progress
  | "admin"; // admin_users membership / admin role

export type NavSurface =
  | "desktopPrimary" // top-level desktop links row (overflow-safe)
  | "moreMenu" // desktop "More" dropdown
  | "mobilePrimary" // top of mobile drawer
  | "mobileMore" // "More" section in mobile drawer
  | "accountMenu" // account dropdown/drawer section (logged-in only)
  | "adminMenu" // admin dropdown (admin only)
  | "cta"; // right-side CTAs (role-aware, max 2 on desktop)

export type NavItem = {
  id: string; // stable unique id
  label: string; // display label
  href: string; // route
  icon?: string; // optional icon key (if you use one)
  audience: NavAudience; // who can see it (used by non-CTA items)
  surfaces: NavSurface[]; // where it can appear
  priority?: number; // lower = earlier in ordering
  // Legacy visibility gates (used by non-CTA items without `when`)
  requiresAuth?: boolean;
  requiresRole?: AppRole[];
  requiresWholesaleContext?: boolean;
  hideWhenAuthenticated?: boolean;
  // New pattern: `when` takes full responsibility for visibility.
  // CTA items MUST use `when`. Non-CTA items without `when` use legacy gates above.
  when?: (ctx: NavContext) => boolean;
};

export type NavContext = {
  // ---- existing fields (keep forever) ----
  isLoggedIn: boolean;
  roles: AppRole[]; // derived from profiles.roles + admin_users check
  hasWholesaleContext?: boolean; // true if wholesale role OR has application row
  // ---- new fields (Phase 2 addition) ----
  role: UserRole; // single-role summary for CTA logic
  vendorPlan: VendorPlanStatus; // "unknown" → treat as "none" in CTA logic
  consumerPlan: ConsumerPlanStatus; // "unknown" → suppress upgrade CTA
};

/** Safe default for loading states and tests. */
export const DEFAULT_NAV_CTX: NavContext = {
  isLoggedIn: false,
  roles: [],
  hasWholesaleContext: false,
  role: "public",
  vendorPlan: "unknown",
  consumerPlan: "unknown",
};

// ---------------- Derived helpers (pure, no side effects) ----------------

export const vendorIsPaid = (ctx: NavContext): boolean =>
  ctx.role === "vendor" && ctx.vendorPlan !== "none" && ctx.vendorPlan !== "unknown";

/** Show upgrade CTA only when we KNOW the consumer is on "none" plan. */
export const consumerShouldSeeUpgrade = (ctx: NavContext): boolean =>
  ctx.role === "user" && ctx.consumerPlan === "none";

// ---------------- Canonical nav items ----------------
// IMPORTANT: /products appears ONCE (Marketplace). Do not duplicate it elsewhere.
export const NAV_ITEMS: NavItem[] = [
  // -------- Public / discovery (top-level) --------
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/products",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 10,
  },
  {
    id: "learn",
    label: "Learn",
    href: "/education",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 20,
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/vendors",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 30,
  },

  // -------- Desktop More / Mobile More --------
  {
    id: "about",
    label: "About",
    href: "/about",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 110,
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 120,
  },
  {
    id: "support",
    label: "Support",
    href: "/support",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 130,
  },
  {
    id: "faq",
    label: "FAQ",
    href: "/faq",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 140,
  },
  {
    id: "blog",
    label: "Blog",
    href: "/blog",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 150,
  },
  {
    id: "events",
    label: "Events",
    href: "/events",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 160,
  },

  // -------- Authenticated user primary (consumer) --------
  {
    id: "orders",
    label: "Orders",
    href: "/account/orders",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["desktopPrimary", "mobilePrimary", "accountMenu"],
    priority: 40,
  },

  // -------- Account menu (logged-in only) --------
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 200,
  },
  {
    id: "account",
    label: "Account",
    href: "/account",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 210,
  },
  {
    id: "favorites",
    label: "Favorites",
    href: "/account/favorites",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 220,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/account/settings",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 230,
  },
  {
    id: "membership",
    label: "Membership",
    href: "/account/subscription",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 240,
  },

  // -------- Vendor (revenue target) --------
  {
    id: "vendorDashboard",
    label: "Vendor Dashboard",
    href: "/vendors/dashboard",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["desktopPrimary", "mobilePrimary", "accountMenu"],
    priority: 15,
  },
  {
    id: "vendorProducts",
    label: "Products",
    href: "/vendors/products",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["moreMenu", "mobileMore", "accountMenu"],
    priority: 310,
  },
  {
    id: "vendorBilling",
    label: "Plan & Billing",
    href: "/vendors/billing",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["moreMenu", "mobileMore", "accountMenu"],
    priority: 320,
  },

  // -------- Wholesale (conditional visibility) --------
  {
    id: "wholesale",
    label: "Wholesale",
    href: "/wholesale",
    audience: "wholesale",
    requiresAuth: true,
    requiresWholesaleContext: true,
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 25,
  },
  {
    id: "wholesaleApply",
    label: "Apply / Status",
    href: "/wholesale/apply",
    audience: "wholesale",
    requiresAuth: true,
    requiresWholesaleContext: true,
    surfaces: ["moreMenu", "mobileMore", "accountMenu"],
    priority: 410,
  },

  // -------- Admin (ops) --------
  {
    id: "adminWholesale",
    label: "Wholesale Applications",
    href: "/dashboard/admin/wholesale",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 510,
  },
  {
    id: "adminModeration",
    label: "Moderation",
    href: "/admin/moderation",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 520,
  },

  // -------- CTA Surface Items (role-aware, use `when` exclusively) --------
  // These are the ONLY items on the "cta" surface. getCtaNav caps at 2 results.
  {
    id: "cta-join-free",
    label: "Join Free",
    href: "/get-started",
    audience: "public",
    surfaces: ["cta"],
    priority: 1,
    when: (ctx) => !ctx.isLoggedIn,
  },
  {
    id: "cta-sign-in",
    label: "Sign In",
    href: "/login",
    audience: "public",
    surfaces: ["cta"],
    priority: 2,
    when: (ctx) => !ctx.isLoggedIn,
  },
  {
    id: "cta-upgrade-consumer",
    label: "Upgrade",
    href: "/pricing",
    audience: "authed",
    surfaces: ["cta"],
    priority: 1,
    when: (ctx) => consumerShouldSeeUpgrade(ctx),
  },
  {
    id: "cta-choose-vendor-plan",
    label: "Choose Vendor Plan",
    href: "/vendors/activate",
    audience: "vendor",
    surfaces: ["cta"],
    priority: 1,
    when: (ctx) => ctx.isLoggedIn && ctx.role === "vendor" && !vendorIsPaid(ctx),
  },
  {
    id: "cta-add-product",
    label: "Add Product",
    href: "/vendors/products/new",
    audience: "vendor",
    surfaces: ["cta"],
    priority: 1,
    when: (ctx) => ctx.isLoggedIn && vendorIsPaid(ctx),
  },
  {
    id: "cta-admin-dashboard",
    label: "Admin Dashboard",
    href: "/admin/vendors",
    audience: "admin",
    surfaces: ["cta"],
    priority: 1,
    when: (ctx) => ctx.isLoggedIn && ctx.role === "admin",
  },
];

// ---------------- Helpers ----------------
function hasRole(ctx: NavContext, role: AppRole) {
  return ctx.roles.includes(role);
}

/**
 * Visibility for non-CTA surfaces.
 * Items with `when` delegate entirely to that function.
 * Items without `when` use the legacy gate fields.
 */
export function isNavItemVisible(item: NavItem, ctx: NavContext): boolean {
  // New pattern: `when` takes full responsibility
  if (typeof item.when === "function") return item.when(ctx);

  // Legacy pattern (no `when`): apply gate fields in order
  if (item.hideWhenAuthenticated && ctx.isLoggedIn) return false;
  if (item.requiresAuth && !ctx.isLoggedIn) return false;
  if (item.requiresRole && item.requiresRole.length > 0) {
    const ok = item.requiresRole.some((r) => hasRole(ctx, r));
    if (!ok) return false;
  }
  if (item.requiresWholesaleContext && !ctx.hasWholesaleContext) return false;
  switch (item.audience) {
    case "public":
      return true;
    case "authed":
      return ctx.isLoggedIn;
    case "vendor":
      return ctx.isLoggedIn && hasRole(ctx, "vendor");
    case "wholesale":
      return ctx.isLoggedIn && (hasRole(ctx, "wholesale") || !!ctx.hasWholesaleContext);
    case "admin":
      return ctx.isLoggedIn && hasRole(ctx, "admin");
    default:
      return false;
  }
}

/**
 * Returns visible items for any non-CTA surface, deduped by href.
 * In dev/test, emits a loud warning or throws on href collisions.
 */
export function getNavItemsForSurface(surface: NavSurface, ctx: NavContext): NavItem[] {
  if (surface === "cta") return getCtaNav(ctx);

  const items = NAV_ITEMS
    .filter((i) => i.surfaces.includes(surface))
    .filter((i) => isNavItemVisible(i, ctx))
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

  // Dedupe by href. In dev/test, emit a loud warning or throw so collisions are
  // caught immediately rather than silently dropping a nav item.
  const seen = new Map<string, string>(); // href → first item id
  const deduped: NavItem[] = [];
  for (const item of items) {
    const normalizedHref = item.href.toLowerCase().replace(/\/$/, "");
    const firstId = seen.get(normalizedHref);
    if (firstId !== undefined) {
      const msg = `[nav] Duplicate href "${item.href}" on surface "${surface}" — ids: ${firstId}, ${item.id}`;
      if (process.env.NODE_ENV === "test") {
        throw new Error(msg);
      } else if (process.env.NODE_ENV === "development") {
        console.warn(msg);
      }
      continue;
    }
    seen.set(normalizedHref, item.id);
    deduped.push(item);
  }
  return deduped;
}

/**
 * CTA items for the right-side action area.
 * Hard cap: never more than 2 CTAs on desktop.
 * Only items with `when` functions and `surfaces.includes("cta")` are considered.
 */
export function getCtaNav(ctx: NavContext): NavItem[] {
  const result = NAV_ITEMS
    .filter((item) => item.surfaces.includes("cta") && typeof item.when === "function" && item.when(ctx))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 2); // HARD CAP: never more than 2 CTAs on desktop

  // Dedup guard (dev only)
  if (process.env.NODE_ENV !== "production") {
    const hrefs = result.map((i) => i.href);
    const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
    if (dupes.length > 0) console.error("[nav] duplicate CTA hrefs:", dupes);
  }

  return result;
}

// Convenience groupings (optional)
export function getDesktopPrimaryNav(ctx: NavContext) {
  return getNavItemsForSurface("desktopPrimary", ctx);
}

export function getDesktopMoreNav(ctx: NavContext) {
  return getNavItemsForSurface("moreMenu", ctx);
}

export function getMobilePrimaryNav(ctx: NavContext) {
  return getNavItemsForSurface("mobilePrimary", ctx);
}

export function getMobileMoreNav(ctx: NavContext) {
  return getNavItemsForSurface("mobileMore", ctx);
}

export function getAccountMenuNav(ctx: NavContext) {
  return getNavItemsForSurface("accountMenu", ctx);
}

export function getAdminMenuNav(ctx: NavContext) {
  return getNavItemsForSurface("adminMenu", ctx);
}

// ---------------- Legacy exports (for Nav.tsx during transition) ----------------
export type NavItemLegacy = { label: string; href: string; roles?: string[] };

export const NAV_PUBLIC: NavItemLegacy[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Support", href: "/support" },
  { label: "FAQ", href: "/faq" },
  { label: "Blog", href: "/blog" },
];

// Mobile-only discovery links that should not appear in the desktop top row.
export const NAV_MOBILE_DISCOVERY: NavItemLegacy[] = [
  { label: "Marketplace", href: "/products" },
  { label: "Education", href: "/education" },
];

export const NAV_PRIMARY: NavItemLegacy[] = [
  { label: "👋 Welcome", href: "/welcome" },
  { label: "Feed", href: "/newsfeed" },
  { label: "Discover", href: "/discover" },
  { label: "Shop", href: "/products" },
  { label: "Events", href: "/events" },
  { label: "Learning with Jax", href: "/learning-with-jax" },
];

export const NAV_COMMUNITY: NavItemLegacy[] = [
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "📝 Blog", href: "/blog" },
];

export const NAV_BUSINESS: NavItemLegacy[] = [
  { label: "Vendor Registration", href: "/vendor-registration" },
  { label: "Become a Driver", href: "/logistics/apply" },
  { label: "Affiliate Portal", href: "/affiliate/portal" },
  { label: "Request Delivery", href: "/delivery/request" },
  { label: "Wholesale Inquiry", href: "/wholesale" },
  { label: "Feature on Learning with Jax", href: "/learning/jax" },
  { label: "Services", href: "/services" },
  { label: "📅 My Events", href: "/vendors/events" },
];

export const NAV_SERVICES: NavItemLegacy[] = [
  { label: "Hemp Developers", href: "/services/hemp-developers" },
  { label: "Cannabis Attorneys", href: "/services/cannabis-attorneys" },
  { label: "Cannabis-Approved Banks", href: "/services/cannabis-banks" },
  { label: "Insurance Providers", href: "/services/insurance-providers" },
  { label: "Farm Leasing", href: "/services/farm-leasing" },
  { label: "White-Label Partners", href: "/services/white-label" },
  { label: "COA Analysis Companies", href: "/services/coa-analysis" },
  { label: "Wholesalers", href: "/services/wholesalers" },
];

export const NAV_ADMIN: NavItemLegacy[] = [
  { label: "👥 Vendor Applications", href: "/admin/vendors" },
  { label: "🔍 Vendor Integrity", href: "/admin/vendors/integrity" },
  { label: "📦 Product Review", href: "/admin/products" },
  { label: "📅 Event Review", href: "/admin/events" },
  { label: "🛠️ Service Review", href: "/admin/services" },
  { label: "💬 Service Inquiries", href: "/admin/inquiries" },
  { label: "📁 Categories", href: "/admin/categories" },
  { label: "🚗 Drivers", href: "/admin/drivers" },
  { label: "🚗 Driver Applications", href: "/admin/driver-applications" },
  { label: "🎙️ Jax Applications", href: "/admin/jax-applications" },
  { label: "💸 Affiliate Payouts", href: "/admin/affiliate-payouts" },
  { label: "🗺️ State Rules", href: "/admin/compliance/state-rules" },
];

export const HIDE_NAV_PATHS = ["/signup", "/login", "/get-started", "/onboarding"];

export function shouldHideNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
