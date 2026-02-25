/**
 * Shared nav definition for desktop and mobile. Single source of truth.
 * Used by components/Nav.tsx for both desktop links and mobile drawer.
 */

export type NavItem = { label: string; href: string; roles?: string[] };

/** Public items — always visible (unauthenticated and authenticated) */
export const NAV_PUBLIC: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/products" },
  { label: "Education", href: "/education" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Primary nav — Welcome, Feed, Discover, Events, Episodes (Shop/Marketplace in NAV_PUBLIC) */
export const NAV_PRIMARY: NavItem[] = [
  { label: "👋 Welcome", href: "/welcome" },
  { label: "🏠 Feed", href: "/newsfeed" },
  { label: "🧭 Discover", href: "/discover" },
  { label: "🎪 Events", href: "/events" },
  { label: "📺 Episodes", href: "/learning-with-jax" },
];

/** Community dropdown */
export const NAV_COMMUNITY: NavItem[] = [
  { label: "👥 Groups", href: "/groups" },
  { label: "💬 Forums", href: "/forums" },
  { label: "📝 Blog", href: "/blog" },
];

/** Business dropdown */
export const NAV_BUSINESS: NavItem[] = [
  { label: "🏪 Vendors", href: "/vendors" },
  { label: "🛠️ Services", href: "/services" },
  { label: "🏢 Wholesale", href: "/wholesale" },
  { label: "🚚 Logistics", href: "/logistics" },
  { label: "🚗 Driver Network", href: "/logistics/apply" },
  { label: "🤝 Vendor Registration", href: "/vendor-registration" },
];

/** Admin links — roles: ["admin"]; matches desktop dropdown exactly */
export const NAV_ADMIN: NavItem[] = [
  { label: "👥 Vendor Applications", href: "/admin/vendors" },
  { label: "🔍 Vendor Integrity", href: "/admin/vendors/integrity" },
  { label: "📦 Product Review", href: "/admin/products" },
  { label: "📅 Event Review", href: "/admin/events" },
  { label: "🛠️ Service Review", href: "/admin/services" },
  { label: "💬 Service Inquiries", href: "/admin/inquiries" },
  { label: "📁 Categories", href: "/admin/categories" },
  { label: "🚗 Drivers", href: "/admin/drivers" },
];

/** Paths where nav is hidden */
export const HIDE_NAV_PATHS = ["/signup", "/login", "/get-started", "/onboarding"];

export function shouldHideNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
