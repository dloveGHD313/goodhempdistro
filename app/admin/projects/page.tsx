import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProjectRow = {
  id: string;
  created_at: string;
  contact_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  submitter_role: string;
  project_type: string;
  state: string;
  city: string | null;
  timeline: string | null;
  budget_range: string | null;
  description: string;
  categories: string[];
  status: string;
  matched_vendor_ids: string[];
  blueprint_object_path: string | null;
  blueprint_filename: string | null;
};

async function getProjects(): Promise<{
  rows: ProjectRow[];
  vendorNames: Record<string, string>;
  blueprintUrls: Record<string, string>;
}> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("project_submissions")
      .select(
        "id, created_at, contact_name, company, email, phone, submitter_role, project_type, state, city, timeline, budget_range, description, categories, status, matched_vendor_ids, blueprint_object_path, blueprint_filename"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) return { rows: [], vendorNames: {}, blueprintUrls: {} };

    const vendorIds = Array.from(
      new Set(data.flatMap((r) => (r.matched_vendor_ids as string[]) ?? []))
    );
    const vendorNames: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const { data: vendors } = await admin
        .from("vendors")
        .select("id, business_name")
        .in("id", vendorIds);
      (vendors ?? []).forEach((v) => {
        if (v?.id) vendorNames[v.id] = v.business_name || v.id;
      });
    }
    // Short-lived signed URLs for uploaded blueprints (private bucket).
    const blueprintUrls: Record<string, string> = {};
    for (const r of data) {
      const path = (r as { blueprint_object_path?: string | null }).blueprint_object_path;
      if (!path) continue;
      try {
        const { data: signed } = await admin.storage
          .from("project-blueprints")
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) blueprintUrls[r.id as string] = signed.signedUrl;
      } catch (err) {
        console.warn("[admin/projects] signed url failed:", err);
      }
    }
    return { rows: data as ProjectRow[], vendorNames, blueprintUrls };
  } catch (err) {
    console.error("[admin/projects] fetch failed:", err);
    return { rows: [], vendorNames: {}, blueprintUrls: {} };
  }
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-200",
  matched: "bg-green-500/20 text-green-200",
  contacted: "bg-yellow-500/20 text-yellow-200",
  closed: "bg-gray-500/20 text-gray-300",
  spam: "bg-red-500/20 text-red-200",
};

export default async function AdminProjectsPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/projects");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { rows, vendorNames, blueprintUrls } = await getProjects();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-2 text-accent">Project Leads</h1>
          <p className="text-muted mb-8">
            Contractor and developer submissions from /projects/submit, with the vendors each
            was routed to.
          </p>

          {rows.length === 0 ? (
            <div className="card-glass p-8 text-center text-muted">
              No project submissions yet. Share{" "}
              <span className="text-accent">goodhempdistro.com/projects/submit</span> with
              contractors and developers.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <article key={row.id} className="card-glass p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold">
                      {row.contact_name}
                      {row.company ? <span className="text-muted"> — {row.company}</span> : null}
                      <span className="text-muted text-sm"> ({row.submitter_role})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[row.status] ?? "bg-gray-500/20 text-gray-300"}`}
                      >
                        {row.status}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(row.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/Chicago",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted mb-2">
                    {row.project_type} · {row.city ? `${row.city}, ` : ""}
                    {row.state}
                    {row.timeline ? ` · ${row.timeline}` : ""}
                    {row.budget_range ? ` · ${row.budget_range}` : ""}
                  </div>
                  <div className="text-sm mb-2">
                    <a href={`mailto:${row.email}`} className="text-accent hover:underline">
                      {row.email}
                    </a>
                    {row.phone ? <span className="text-muted"> · {row.phone}</span> : null}
                  </div>
                  <p className="text-sm text-muted mb-3 whitespace-pre-line">{row.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {row.categories.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                        {c}
                      </span>
                    ))}
                  </div>
                  {row.blueprint_object_path && blueprintUrls[row.id] ? (
                    <div className="text-sm mb-2">
                      📐{" "}
                      <a
                        href={blueprintUrls[row.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {row.blueprint_filename ?? "Blueprint"}
                      </a>{" "}
                      <span className="text-xs text-muted">(link valid 1 hour)</span>
                    </div>
                  ) : null}
                  <div className="text-xs text-muted">
                    {row.matched_vendor_ids.length > 0
                      ? `Routed to: ${row.matched_vendor_ids.map((id) => vendorNames[id] ?? id).join(", ")}`
                      : "No vendor matches — follow up manually."}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
