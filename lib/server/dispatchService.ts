import "server-only";

import { createHash, randomBytes } from "crypto";
import { getSiteUrl } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DispatchDelivery = {
  id: string;
  status: string;
  driver_id: string | null;
  pickup_name: string | null;
  pickup_address: string | null;
  dropoff_name: string | null;
  dropoff_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  payout_cents: number | null;
  offering_started_at: string | null;
  offer_batch: number | null;
};

type CandidateRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  status: string;
  driver_presence:
    | {
        is_online: boolean;
        notify_offline: boolean;
        lat: number | null;
        lng: number | null;
        location_updated_at: string | null;
        updated_at: string | null;
      }[]
    | null;
};

export type DispatchCandidate = {
  driverId: string;
  email: string;
  fullName: string;
  isOnline: boolean;
  distanceMiles: number;
  locationUpdatedAt: string;
};

const CANDIDATE_LIMIT = 3;
const LOCATION_MAX_AGE_MINUTES = 30;
const OFFER_EXPIRY_MINUTES = 3;
const OFFER_RETRY_COOLDOWN_SECONDS = 90;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

async function sendDispatchOfferEmail(params: {
  to: string;
  driverName: string;
  delivery: DispatchDelivery;
  payoutCents: number;
  expiresAt: string;
  acceptUrl: string;
  declineUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    console.warn(
      "[dispatch/email]",
      JSON.stringify({
        route: "dispatch/email",
        missingResendConfig: true,
      })
    );
    return;
  }

  const payout = (params.payoutCents / 100).toFixed(2);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New Delivery Offer</h2>
      <p>Hi ${params.driverName},</p>
      <p>You have a new delivery offer.</p>
      <ul>
        <li>Pickup: ${params.delivery.pickup_name ?? "Pickup"} — ${params.delivery.pickup_address ?? "N/A"}</li>
        <li>Dropoff: ${params.delivery.dropoff_name ?? "Dropoff"} — ${params.delivery.dropoff_address ?? "N/A"}</li>
        <li>Payout estimate: $${payout}</li>
        <li>Expires at: ${new Date(params.expiresAt).toLocaleString()}</li>
      </ul>
      <p>
        <a href="${params.acceptUrl}">Accept Offer</a>
        &nbsp;|&nbsp;
        <a href="${params.declineUrl}">Decline Offer</a>
      </p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: "Good Hemp Distro: New delivery offer",
      html,
    }),
  });
}

export function createOfferToken() {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export async function buildDispatchCandidates(
  delivery: Pick<DispatchDelivery, "pickup_lat" | "pickup_lng">,
  radiusMiles = 15
): Promise<DispatchCandidate[]> {
  if (delivery.pickup_lat == null || delivery.pickup_lng == null) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const freshnessThreshold = new Date(Date.now() - LOCATION_MAX_AGE_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("drivers")
    .select(
      "id, user_id, full_name, email, status, driver_presence!inner(is_online, notify_offline, lat, lng, location_updated_at, updated_at)"
    )
    .eq("status", "approved");

  if (error || !data) {
    return [];
  }

  const candidates: DispatchCandidate[] = [];

  for (const row of data as CandidateRow[]) {
    const presence = row.driver_presence?.[0];
    if (!presence) continue;
    if (!presence.is_online && !presence.notify_offline) continue;
    if (presence.lat == null || presence.lng == null || !presence.location_updated_at) continue;
    if (presence.location_updated_at < freshnessThreshold) continue;
    if (!row.email) continue;

    const distance = haversineMiles(delivery.pickup_lat, delivery.pickup_lng, presence.lat, presence.lng);
    if (distance > radiusMiles) continue;

    candidates.push({
      driverId: row.id,
      email: row.email,
      fullName: row.full_name ?? "Driver",
      isOnline: Boolean(presence.is_online),
      distanceMiles: distance,
      locationUpdatedAt: presence.location_updated_at,
    });
  }

  candidates.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
    return b.locationUpdatedAt.localeCompare(a.locationUpdatedAt);
  });

  return candidates;
}

export function hashOfferToken(token: string) {
  return hashToken(token);
}

export async function dispatchDeliveryOffers(deliveryId: string): Promise<{ ok: boolean; requestId: string; offered: number }> {
  const requestId = crypto.randomUUID();
  const route = "dispatch/delivery-offers";
  const admin = createSupabaseAdminClient();

  try {
    const { data: delivery, error: deliveryError } = await admin
      .from("deliveries")
      .select(
        "id, status, driver_id, pickup_name, pickup_address, dropoff_name, dropoff_address, pickup_lat, pickup_lng, payout_cents, offering_started_at, offer_batch"
      )
      .eq("id", deliveryId)
      .maybeSingle<DispatchDelivery>();

    if (deliveryError || !delivery) {
      return { ok: false, requestId, offered: 0 };
    }

    if (delivery.driver_id || ["assigned", "picked_up", "delivered", "cancelled"].includes(delivery.status)) {
      return { ok: true, requestId, offered: 0 };
    }

    if (delivery.offering_started_at) {
      const startedAtMs = new Date(delivery.offering_started_at).getTime();
      if (Date.now() - startedAtMs < OFFER_RETRY_COOLDOWN_SECONDS * 1000) {
        return { ok: true, requestId, offered: 0 };
      }
    }

    const candidates = await buildDispatchCandidates(delivery, 15);
    if (candidates.length === 0) {
      return { ok: true, requestId, offered: 0 };
    }

    const batch = (delivery.offer_batch ?? 0) + 1;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OFFER_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await admin
      .from("deliveries")
      .update({
        status: "offering",
        offering_started_at: now.toISOString(),
        offer_batch: batch,
      })
      .eq("id", delivery.id)
      .is("driver_id", null);

    const siteUrl = getSiteUrl();
    const chosen = candidates.slice(0, CANDIDATE_LIMIT);

    for (const [index, candidate] of chosen.entries()) {
      const { token, tokenHash } = createOfferToken();

      await admin
        .from("delivery_offers")
        .upsert(
          {
            delivery_id: delivery.id,
            driver_id: candidate.driverId,
            status: "offered",
            offered_at: now.toISOString(),
            responded_at: null,
            expires_at: expiresAt,
            offer_rank: index + 1,
            accept_token_hash: tokenHash,
          },
          { onConflict: "delivery_id,driver_id" }
        );

      const query = `deliveryId=${encodeURIComponent(delivery.id)}&driverId=${encodeURIComponent(
        candidate.driverId
      )}&token=${encodeURIComponent(token)}`;

      await sendDispatchOfferEmail({
        to: candidate.email,
        driverName: candidate.fullName,
        delivery,
        payoutCents: delivery.payout_cents ?? 0,
        expiresAt,
        acceptUrl: `${siteUrl}/api/deliveries/offers/accept?${query}`,
        declineUrl: `${siteUrl}/api/deliveries/offers/decline?${query}`,
      });
    }

    return { ok: true, requestId, offered: chosen.length };
  } catch (error) {
    const err = error as { type?: string; code?: string; requestId?: string; message?: string };
    console.error(
      "[dispatch/delivery-offers]",
      JSON.stringify({
        route,
        requestId,
        userId: null,
        errorType: err?.type ?? null,
        errorCode: err?.code ?? null,
        stripeRequestId: err?.requestId ?? null,
        message: truncateMessage(err?.message ?? (error instanceof Error ? error.message : String(error))) ?? null,
      })
    );

    return { ok: false, requestId, offered: 0 };
  }
}
