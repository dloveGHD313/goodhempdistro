import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";
import StateRulesClient from "./StateRulesClient";

export const dynamic = "force-dynamic";

export type StateRule = {
  state_code: string;
  allows_sale_non_intoxicating: boolean | null;
  allows_delivery_non_intoxicating: boolean | null;
  allows_sale_intoxicating: boolean | null;
  allows_delivery_intoxicating: boolean | null;
  notes: string | null;
  sources: unknown | null;
  updated_at: string | null;
};

async function getStateRules(): Promise<StateRule[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("hemp_state_rules")
    .select(`
      state_code,
      allows_sale_non_intoxicating,
      allows_delivery_non_intoxicating,
      allows_sale_intoxicating,
      allows_delivery_intoxicating,
      notes,
      sources,
      updated_at
    `)
    .order("state_code", { ascending: true });

  if (error) {
    console.error("[state-rules] fetch error", error);
    return [];
  }
  return (data || []) as StateRule[];
}

export default async function AdminStateRulesPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) redirect("/login?redirect=/admin/compliance/state-rules");
  if (!adminCheck.isAdmin) redirect("/");

  const rules = await getStateRules();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Compliance Management
            </p>
            <h1 className="text-4xl font-bold text-accent">State Shipping Rules</h1>
            <p className="text-muted mt-2 text-sm max-w-2xl">
              Configure which states allow hemp sales and delivery for non-intoxicating and
              intoxicating products. Changes apply to new product uploads; re-save an existing
              product to recompute its{" "}
              <code className="text-xs bg-white/5 px-1 rounded">ship_to_states</code> array.
            </p>
          </div>
          <StateRulesClient initialRules={rules} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
