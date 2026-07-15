import {
  BRAND_LOYALTY_ORDER_THRESHOLD,
  TIER_ENTITLEMENTS,
  type ConsumerTier,
} from "@/lib/entitlements";

/**
 * Membership perk matrix (perks spec 2026-07-10 §8) — rendered straight
 * from the entitlements SSOT so CEO tuning shows up here automatically.
 * Pure presentational; safe in client and server components.
 */

const TIERS: ConsumerTier[] = ["Free", "Basic", "Plus", "Premium"];

type Row = { label: string; render: (tier: ConsumerTier) => string };

const ROWS: Row[] = [
  {
    label: "Loyalty points on purchases",
    render: (t) => `${TIER_ENTITLEMENTS[t].pointsMultiplier}×`,
  },
  {
    label: "Welcome + renewal bonus",
    render: (t) => {
      const pts = TIER_ENTITLEMENTS[t].subscriptionBonusPoints;
      return pts > 0 ? `${pts.toLocaleString()} pts` : "—";
    },
  },
  {
    label: "Referral reward (per signup)",
    render: (t) => {
      const e = TIER_ENTITLEMENTS[t];
      return `${e.referralRewardPoints} pts × ${e.referralEarnMultiplier}`;
    },
  },
  {
    label: "Platform member coupons",
    render: (t) => {
      const c = TIER_ENTITLEMENTS[t].monthlyCoupons;
      return c ? `${c.count} × ${c.percentOff}% off / month` : "—";
    },
  },
  {
    label: "Coupon stacking",
    render: (t) =>
      TIER_ENTITLEMENTS[t].couponStacking
        ? "Platform + vendor coupon (max 25% off)"
        : "One coupon per order",
  },
  {
    label: "Learning with JAX",
    render: (t) => {
      const e = TIER_ENTITLEMENTS[t];
      if (e.jaxEarlyAccessHours === 0) return "On public release";
      const days = e.jaxEarlyAccessHours / 24;
      return `${days} day${days === 1 ? "" : "s"} early${e.jaxMembersOnly ? " + members-only episodes" : ""}`;
    },
  },
  {
    label: "Event tickets",
    render: (t) => {
      const e = TIER_ENTITLEMENTS[t];
      const parts: string[] = [];
      if (e.eventTicketDiscountPct > 0) parts.push(`${e.eventTicketDiscountPct}% off`);
      if (e.eventEarlyAccessHours > 0) parts.push(`${e.eventEarlyAccessHours}h early access`);
      if (e.freeEventTicketsPerQuarter > 0)
        parts.push(`${e.freeEventTicketsPerQuarter} free community ticket / quarter`);
      return parts.length > 0 ? parts.join(" · ") : "Full price";
    },
  },
  {
    label: `Brand loyalty (after ${BRAND_LOYALTY_ORDER_THRESHOLD} orders with a vendor)`,
    render: (t) => {
      const b = TIER_ENTITLEMENTS[t].brandLoyalty;
      return b ? `${b.tier} — ${b.percentOff}% brand coupon` : "Follow only";
    },
  },
  {
    label: "Support",
    render: (t) => (TIER_ENTITLEMENTS[t].prioritySupport ? "Priority" : "Standard"),
  },
];

export default function ConsumerPerkMatrix({
  highlightTier,
}: {
  highlightTier?: ConsumerTier;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-muted font-medium p-3 border-b border-white/10">
              Perk
            </th>
            {TIERS.map((tier) => (
              <th
                key={tier}
                className={`text-center font-semibold p-3 border-b border-white/10 ${
                  tier === highlightTier ? "text-[var(--brand-lime)]" : "text-white"
                }`}
              >
                {tier}
                {tier === highlightTier && (
                  <span className="block text-xs font-normal">your plan</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td className="text-muted p-3 border-b border-white/5">{row.label}</td>
              {TIERS.map((tier) => (
                <td
                  key={tier}
                  className={`text-center p-3 border-b border-white/5 ${
                    tier === highlightTier ? "text-[var(--brand-lime)]" : "text-white/90"
                  }`}
                >
                  {row.render(tier)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
