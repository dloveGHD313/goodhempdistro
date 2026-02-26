// lib/nav.ts
// Single source of truth for ALL navigation.
// Desktop and mobile render from the same NAV_ITEMS config, filtered by auth/roles/surface.

// ---------------- Types ----------------
export type AppRole = "user" | "vendor" | "wholesale" | "admin";

export type NavAudience =
  | "public"     // always visible (logged out + logged in)
  | "authed"     // any logged-in user
  | "vendor"     // vendor role
  | "wholesale"  // wholesale role OR has wholesale application
  | "admin";     // admin_users membership

export type NavSurface =
  | "desktopPrimary"  // top-level desktop links row
  | "mobilePrimary"   // mobile drawer primary section (public + authed)
  | "communityMenu"   // desktop Community dropdown + mobile Community section
  | "businessMenu"    // desktop Business dropdown + mobile Business section
  | "moreMenu"        // desktop "More" dropdown
  | "mobileMore"      // mobile "More" section (below community/business)
  | "accountMenu"     // account dropdown / mobile account section
  | "adminMenu"       // admin dropdown / mobile admin section
  | "cta";            // right-side CTAs (Join Free, Sign in, Add Product)

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
  audience: NavAudience;
  surfaces: NavSurface[];
  /** Global sort order. Lower = earlier. Used for all surfaces unless overridden. */
  priority?: number;
  /**
   * Per-surface sort order override.
   * When an item appears in multiple surfaces (e.g. desktopPrimary AND accountMenu),
   * different positions may be desired. This overrides `priority` for the named surface.
   * Example: vendorDashboard wants priority 12 in desktopPrimary but 208 in accountMenu.
   */
  priorityBySurface?: Partial<Record<NavSurface, number>>;
  requiresAuth?: boolean;
  requiresRole?: AppRole[];
  requiresWholesaleContext?: boolean;
};

export type NavContext = {
  isLoggedIn: boolean;
  roles: AppRole[];
  hasWholesaleContext?: boolean;
};

// ---------------- Canonical nav items ----------------
// Each item appears in ONE place in this list.
// Surface tags control where it renders (desktop primary, dropdown, drawer section, etc.).
// Priority: lower numbers appear first within a surface.
export const NAV_ITEMS: NavItem[] = [

  // ── PUBLIC / DISCOVERY (desktop primary row + mobile Public section) ──────
  {
    id: "marketplace",
    label: "Marketplace",
    href: "/products",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 10,
  },
  {
    id: "education",
    label: "Education",
    href: "/education",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 20,
  },
  {
    id: "about",
    label: "About",
    href: "/about",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 30,
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 40,
  },

  // ── AUTHENTICATED PRIMARY (shown in desktop row + mobile Primary section) ─
  // Welcome: public audience but excluded on desktop when logged in (handled in Nav.tsx)
  {
    id: "welcome",
    label: "👋 Welcome",
    href: "/welcome",
    audience: "public",
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 5,
  },
  {
    id: "feed",
    label: "🏠 Feed",
    href: "/newsfeed",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 15,
  },
  {
    id: "discover",
    label: "🧭 Discover",
    href: "/discover",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 23,
  },
  {
    id: "events",
    label: "🎪 Events",
    href: "/events",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 24,
  },
  {
    id: "episodes",
    label: "📺 Episodes",
    href: "/learning-with-jax",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 25,
  },

  // ── VENDOR PRIMARY ────────────────────────────────────────────────────────
  // vendorDashboard is a primary navigation destination, NOT an account management item.
  // It belongs in the primary nav row (desktop) and Primary section (mobile drawer).
  // Removed from accountMenu to prevent duplication in the mobile drawer.
  // priorityBySurface.accountMenu is set defensively so ordering stays correct
  // if this item is ever added back to accountMenu in the future.
  {
    id: "vendorDashboard",
    label: "Vendor Dashboard",
    href: "/vendors/dashboard",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["desktopPrimary", "mobilePrimary"],
    priority: 12,
    priorityBySurface: { accountMenu: 208 },
  },
  {
    id: "addProduct",
    label: "Add Product",
    href: "/vendors/products/new",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["cta", "desktopPrimary", "mobilePrimary"],
    priority: 14,
  },

  // ── COMMUNITY (desktop Community dropdown + mobile Community section) ─────
  {
    id: "groups",
    label: "👥 Groups",
    href: "/groups",
    audience: "public",
    surfaces: ["communityMenu"],
    priority: 100,
  },
  {
    id: "forums",
    label: "💬 Forums",
    href: "/forums",
    audience: "public",
    surfaces: ["communityMenu"],
    priority: 110,
  },
  {
    id: "blog",
    label: "📝 Blog",
    href: "/blog",
    audience: "public",
    surfaces: ["communityMenu"],
    priority: 120,
  },

  // ── BUSINESS (desktop Business dropdown + mobile Business section) ────────
  {
    id: "vendors",
    label: "🏪 Vendors",
    href: "/vendors",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 200,
  },
  {
    id: "services",
    label: "🛠️ Services",
    href: "/services",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 210,
  },
  {
    id: "wholesaleBiz",
    label: "🏢 Wholesale",
    href: "/wholesale",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 220,
  },
  {
    id: "logistics",
    label: "🚚 Logistics",
    href: "/logistics",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 230,
  },
  {
    id: "driverNetwork",
    label: "🚗 Driver Network",
    href: "/logistics/apply",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 240,
  },
  {
    id: "vendorRegistration",
    label: "🤝 Vendor Registration",
    href: "/vendor-registration",
    audience: "public",
    surfaces: ["businessMenu"],
    priority: 250,
  },

  // ── ACCOUNT MENU (logged-in: dropdown on desktop, section in mobile drawer) ─
  {
    id: "accountOverview",
    label: "Account Overview",
    href: "/account",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 200,
  },
  {
    id: "goToFeed",
    label: "Go to Feed",
    href: "/newsfeed",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 205,
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
    id: "membership",
    label: "Membership",
    href: "/account/subscription",
    audience: "authed",
    requiresAuth: true,
    surfaces: ["accountMenu"],
    priority: 240,
  },
  {
    id: "vendorProducts",
    label: "My Products",
    href: "/vendors/products",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["accountMenu"],
    priority: 310,
  },
  {
    id: "vendorBilling",
    label: "Plan & Billing",
    href: "/vendors/billing",
    audience: "vendor",
    requiresAuth: true,
    requiresRole: ["vendor"],
    surfaces: ["accountMenu"],
    priority: 320,
  },
  {
    id: "wholesaleApply",
    label: "Wholesale Status",
    href: "/wholesale/apply",
    audience: "wholesale",
    requiresAuth: true,
    requiresWholesaleContext: true,
    surfaces: ["accountMenu"],
    priority: 410,
  },

  // ── ADMIN MENU (admin only: dropdown on desktop, section in mobile drawer) ─
  {
    id: "adminVendors",
    label: "👥 Vendor Applications",
    href: "/admin/vendors",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 500,
  },
  {
    id: "adminIntegrity",
    label: "🔍 Vendor Integrity",
    href: "/admin/vendors/integrity",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 510,
  },
  {
    id: "adminProducts",
    label: "📦 Product Review",
    href: "/admin/products",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 520,
  },
  {
    id: "adminEvents",
    label: "📅 Event Review",
    href: "/admin/events",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 530,
  },
  {
    id: "adminServices",
    label: "🛠️ Service Review",
    href: "/admin/services",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 540,
  },
  {
    id: "adminInquiries",
    label: "💬 Service Inquiries",
    href: "/admin/inquiries",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 550,
  },
  {
    id: "adminCategories",
    label: "📁 Categories",
    href: "/admin/categories",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 560,
  },
  {
    id: "adminDrivers",
    label: "🚗 Drivers",
    href: "/admin/drivers",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 570,
  },
  {
    id: "adminWholesale",
    label: "🌿 Wholesale Applications",
    href: "/dashboard/admin/wholesale",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 580,
  },
  {
    id: "adminModeration",
    label: "🛡️ Moderation",
    href: "/admin/moderation",
    audience: "admin",
    requiresAuth: true,
    requiresRole: ["admin"],
    surfaces: ["adminMenu"],
    priority: 590,
  },

  // ── CTA BUTTONS (right side / bottom of mobile drawer) ───────────────────
  {
    id: "joinFree",
    label: "Join Free",
    href: "/get-started",
    audience: "public",
    surfaces: ["cta"],
    priority: 900,
  },
  {
    id: "signIn",
    label: "Sign in",
    href: "/login",
    audience: "public",
    surfaces: ["cta"],
    priority: 910,
  },
];

// ---------------- Visibility logic ----------------
function hasRole(ctx: NavContext, role: AppRole) {
  return ctx.roles.includes(role);
}

export function isNavItemVisible(item: NavItem, ctx: NavContext): boolean {
  if (item.requiresAuth && !ctx.isLoggedIn) return false;

  if (item.requiresRole && item.requiresRole.length > 0) {
    if (!item.requiresRole.some((r) => hasRole(ctx, r))) return false;
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

export function getNavItemsForSurface(surface: NavSurface, ctx: NavContext): NavItem[] {
  const effectivePriority = (item: NavItem) =>
    item.priorityBySurface?.[surface] ?? item.priority ?? 9999;

  const items = NAV_ITEMS
    .filter((i) => i.surfaces.includes(surface))
    .filter((i) => isNavItemVisible(i, ctx))
    .sort((a, b) => {
      const diff = effectivePriority(a) - effectivePriority(b);
      // Stable tiebreaker by id ensures deterministic order regardless of array insertion order
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

  // Dedupe by href
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

// ---------------- Named helpers ----------------
export function getDesktopPrimaryNav(ctx: NavContext) {
  return getNavItemsForSurface("desktopPrimary", ctx);
}

export function getMobilePrimaryNav(ctx: NavContext) {
  return getNavItemsForSurface("mobilePrimary", ctx);
}

export function getCommunityMenuNav(ctx: NavContext) {
  return getNavItemsForSurface("communityMenu", ctx);
}

export function getBusinessMenuNav(ctx: NavContext) {
  return getNavItemsForSurface("businessMenu", ctx);
}

export function getDesktopMoreNav(ctx: NavContext) {
  return getNavItemsForSurface("moreMenu", ctx);
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
  const items = getNavItemsForSurface("cta", ctx);
  // When logged in, hide Join/Sign in; keep vendor Add Product CTA
  if (ctx.isLoggedIn) {
    return items.filter((i) => i.id === "addProduct");
  }
  return items;
}

// ---------------- Route helpers ----------------
export const HIDE_NAV_PATHS = ["/signup", "/login", "/get-started", "/onboarding"];

export function shouldHideNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
