import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import ModerationClient from "./ModerationClient";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
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
          <h1 className="text-3xl font-bold mb-6 text-accent">Moderation Queue</h1>
          <ModerationClient />
        </section>
      </main>
    </div>
  );
}
