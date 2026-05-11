/**
 * /vendors layout — INTENTIONALLY UNGATED.
 *
 * The /vendors namespace contains two surface types:
 *   1. Public surfaces (no auth required):
 *        - /vendors                  (directory)
 *        - /vendors/[id]             (vendor detail)
 *        - /vendors/activate         (post-application landing)
 *   2. Authenticated vendor-only surfaces (each has its OWN layout
 *      that enforces session + onboarding):
 *        - /vendors/billing, /vendors/dashboard, /vendors/events,
 *          /vendors/orders, /vendors/payouts, /vendors/products,
 *          /vendors/referrals, /vendors/services, /vendors/settings
 *
 * Previously this layout enforced session globally, which forced
 * anonymous visitors hitting /vendors (the public directory) to
 * /login?redirect=/vendors/dashboard. That broke the discovery
 * funnel — see audit P0 Fix #2.
 *
 * Each authenticated subroute keeps its own auth check, so removing
 * the parent check changes nothing for those routes; it only
 * unblocks the public surfaces. Verified subroute coverage in the
 * fix commit.
 */
export default function VendorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
