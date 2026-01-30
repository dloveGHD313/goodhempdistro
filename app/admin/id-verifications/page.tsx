import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import IdVerificationsClient from "./IdVerificationsClient";

export const dynamic = "force-dynamic";

export default async function IdVerificationsPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login");
  }
  if (!adminCheck.isAdmin) {
    redirect("/account");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-3xl font-bold mb-6 text-accent">ID Verification Queue</h1>
          <IdVerificationsClient />
        </section>
      </main>
    </div>
  );
}
