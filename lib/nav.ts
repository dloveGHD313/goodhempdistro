// lib/nav.ts
// Single source of truth for ALL navigation.
// Goal: mobile + desktop render from the same config, filtered by auth/roles.
// Keep labels stable (CEO-approved hierarchy) and avoid duplicate hrefs.

// ---------------- Types ----------------
export type AppRole = "user" | "vendor" | "wholesale" | "admin";

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
  | "cta"; // right-side CTAs (Join Free, Sign in, Add Product)

export type NavItem = {
  id: string; // stable unique id
  label: string; // display label
  href: string; // route
  icon?: string; // optional icon key (if you use one)
  audience: NavAudience; // who can see it
  surfaces: NavSurface[]; // where it can appear
  priority?: number; // lower = earlier in ordering
  requiresAuth?: boolean; // additional hard gate
  requiresRole?: AppRole[]; // additional hard gate
  // If wholesale is conditional (role OR has application in progress):
  requiresWholesaleContext?: boolean;
};

export type NavContext = {
  isLoggedIn: boolean;
  roles: AppRole[]; // derived from profiles.roles + admin_users check
  hasWholesaleContext?: boolean; // true if wholesale role OR has application row
};

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
    href: "/contact",
    audience: "public",
    surfaces: ["moreMenu", "mobileMore"],
    priority: 130,
  },
  {
    id: "faq",
    label: "FAQ",
    href: "/contact",
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
    href: "/account",
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
    id: "addProduct",
    label: "Add Product",
    href: "/vendors/products/new",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["cta", "desktopPrimary", "mobilePrimary"],
    priority: 16,
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

  // -------- Public CTAs (right side) --------
  {
    id: "joinFree",
    label: "Join Free",
    href: "/get-started",
    audience: "public",
    surfaces: ["cta", "mobilePrimary"],
    priority: 900,
  },
  {
    id: "signIn",
    label: "Sign in",
    href: "/login",
    audience: "public",
    surfaces: ["cta", "mobilePrimary"],
    priority: 910,
  },
];

// ---------------- Helpers ----------------
function hasRole(ctx: NavContext, role: AppRole) {
  return ctx.roles.includes(role);
}

export function isNavItemVisible(item: NavItem, ctx: NavContext): boolean {
  // Auth gating
  if (item.requiresAuth && !ctx.isLoggedIn) return false;

  // Role gating
  if (item.requiresRole && item.requiresRole.length > 0) {
    const ok = item.requiresRole.some((r) => hasRole(ctx, r));
    if (!ok) return false;
  }

  // Wholesale context gating (role OR application)
  if (item.requiresWholesaleContext && !ctx.hasWholesaleContext) return false;

  // Audience gating
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

export function getNavItemsForSurface(surface: NavSurface, ctx: NavContext): NavItem[] {
  const items = NAV_ITEMS
    .filter((i) => i.surfaces.includes(surface))
    .filter((i) => isNavItemVisible(i, ctx))
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));

  // Dedupe by href to prevent double links across groups
  const seen = new Set<string>();
  const deduped: NavItem[] = [];
  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    deduped.push(item);
  }
  return deduped;
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

export function getCtaNav(ctx: NavContext) {
  // When logged in, you typically hide Join/Sign in CTAs.
  // Keep vendor "Add Product" CTA for vendors.
  const items = getNavItemsForSurface("cta", ctx);
  if (ctx.isLoggedIn) {
    return items.filter((i) => i.id === "addProduct");
  }
  return items;
}

// ---------------- Legacy exports (for Nav.tsx during transition) ----------------
export type NavItemLegacy = { label: string; href: string; roles?: string[] };

export const NAV_PUBLIC: NavItemLegacy[] = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/products" },
  { label: "Education", href: "/education" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const NAV_PRIMARY: NavItemLegacy[] = [
  { label: "👋 Welcome", href: "/welcome" },
  { label: "🏠 Feed", href: "/newsfeed" },
  { label: "🧭 Discover", href: "/discover" },
  { label: "🎪 Events", href: "/events" },
  { label: "📺 Episodes", href: "/learning-with-jax" },
];

export const NAV_COMMUNITY: NavItemLegacy[] = [
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "📝 Blog", href: "/blog" },
];

export const NAV_BUSINESS: NavItemLegacy[] = [
  { label: "🏪 Vendors", href: "/vendors" },
  { label: "🛠️ Services", href: "/services" },
  { label: "🏢 Wholesale", href: "/wholesale" },
  { label: "🚚 Logistics", href: "/logistics" },
  { label: "🚗 Driver Network", href: "/logistics/apply" },
  { label: "🤝 Vendor Registration", href: "/vendor-registration" },
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
];

export const HIDE_NAV_PATHS = ["/signup", "/login", "/get-started", "/onboarding"];

export function shouldHideNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
