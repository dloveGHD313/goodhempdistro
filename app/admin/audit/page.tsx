import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import AuditLogClient from "./AuditLogClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAuditPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/audit");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-accent">Audit Log</h1>
            <Link href="/admin/products" className="btn-secondary">
              ← Products
            </Link>
          </div>
          <AuditLogClient />
        </section>
      </main>
      <Footer />
    </div>
  );
}
