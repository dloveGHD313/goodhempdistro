import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";

type EnvDiagResponse = {
  ok: boolean;
  maintenanceMode: boolean;
  requiredEnv: Record<string, "present" | "missing">;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEnvDiagnosticsPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/diag/env");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/diag/env`, {
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/admin");
  }

  const data = (await res.json()) as EnvDiagResponse;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-accent">Environment Diagnostics</h1>
            <Link href="/admin" className="btn-secondary">
              ← Admin Home
            </Link>
          </div>
          <div className="surface-card p-6 space-y-4">
            <p className="text-sm text-muted">
              Values are never shown here; only presence is reported for operational safety.
            </p>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Maintenance mode:</span>
              <span
                className={
                  data.maintenanceMode
                    ? "px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-300"
                    : "px-2 py-1 rounded text-xs bg-green-600/30 text-green-300"
                }
              >
                {data.maintenanceMode ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div>
              <h2 className="font-semibold mb-2">Required environment variables</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-[var(--border)]">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.requiredEnv).map(([key, status]) => (
                      <tr key={key} className="border-b border-[var(--border)]/40">
                        <td className="py-2 pr-4 font-mono text-xs">{key}</td>
                        <td className="py-2">
                          <span
                            className={
                              status === "present"
                                ? "px-2 py-1 rounded text-xs bg-green-600/30 text-green-300"
                                : "px-2 py-1 rounded text-xs bg-red-600/30 text-red-300"
                            }
                          >
                            {status === "present" ? "present" : "missing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

