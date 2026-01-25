/**
 * Admin Services Review Queue
 * 
 * MANUAL SETUP REQUIRED:
 * If this page shows "SUPABASE_SERVICE_ROLE_KEY is missing" in the diagnostics banner:
 * 1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
 * 2. Add: SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>
 * 3. Add (if not present): SUPABASE_URL = <your-supabase-url> (or use NEXT_PUBLIC_SUPABASE_URL)
 * 4. Redeploy the application
 * 
 * The service role key is required for admin pages to bypass RLS and read all services.
 * Without it, the page will show 0 pending services even if they exist.
 */

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ServicesReviewClient from "./ServicesReviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const VALID_STATUSES = ["pending_review", "approved", "rejected", "draft"] as const;

async function fetchSummary() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/services?mode=summary`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/services] Summary fetch failed:", payload);
      return {
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        suggestedDefaultStatus: "pending_review",
      };
    }
    return {
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: payload.suggestedDefaultStatus || "pending_review",
    };
  } catch (error) {
    console.error("[admin/services] Summary fetch error:", error);
    return {
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: "pending_review",
    };
  }
}

async function fetchServices(status: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/services?status=${status}&limit=50`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/services] List fetch failed:", payload);
      return {
        services: [],
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      };
    }
    return {
      services: payload.data || [],
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  } catch (error) {
    console.error("[admin/services] List fetch error:", error);
    return {
      services: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  noStore();
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/services");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const summary = await fetchSummary();
  const requestedStatus = searchParams?.status;
  const initialStatus = VALID_STATUSES.includes(requestedStatus as (typeof VALID_STATUSES)[number])
    ? (requestedStatus as (typeof VALID_STATUSES)[number])
    : summary.suggestedDefaultStatus;

  const servicesData = await fetchServices(initialStatus);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Review Queue</h1>
          <ServicesReviewClient
            initialServices={servicesData.services || []}
            initialCounts={servicesData.counts || summary.counts}
            initialStatus={initialStatus}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
