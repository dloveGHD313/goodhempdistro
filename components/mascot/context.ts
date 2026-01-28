import type { MascotContext } from "./config";

export type MascotUserRole = {
  isAdmin: boolean;
  isVendor: boolean;
  isVendorSubscribed: boolean;
  isConsumerSubscribed: boolean;
  isDriver: boolean;
  isLogistics: boolean;
};

const normalize = (path: string | null | undefined) => (path || "").toLowerCase();

export function detectContext(pathname: string, role: MascotUserRole): MascotContext {
  const path = normalize(pathname);

  if (path.startsWith("/newsfeed") || path === "/" || path.startsWith("/groups") || path.startsWith("/forums")) {
    return "FEED";
  }

  if (path.startsWith("/products") || path.startsWith("/discover") || path.startsWith("/shop")) {
    return "SHOP";
  }

  if (path.startsWith("/events")) {
    return "EVENTS";
  }

  if (
    path.startsWith("/vendors") ||
    path.startsWith("/vendor-registration") ||
    path.startsWith("/onboarding/vendor") ||
    path.startsWith("/vendors/products") ||
    path.startsWith("/vendors/services") ||
    path.startsWith("/vendors/events")
  ) {
    return "VENDOR";
  }

  if (
    path.startsWith("/driver") ||
    path.startsWith("/driver-apply") ||
    path.startsWith("/deliveries")
  ) {
    return role.isDriver ? "DELIVERY_DRIVER" : "GENERIC";
  }

  if (path.startsWith("/logistics")) {
    return role.isLogistics ? "B2B_LOGISTICS" : "GENERIC";
  }

  if (role.isVendor || role.isAdmin) {
    return "VENDOR";
  }

  return "GENERIC";
}
