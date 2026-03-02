import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Settings | Good Hemp Distro",
  description: "Manage your account settings",
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen">
      <section className="section-shell">
        <div className="max-w-2xl mx-auto card-glass p-8 space-y-6">
          <h1 className="text-3xl font-bold text-accent">Settings</h1>
          <p className="text-muted">
            Manage your notification preferences, privacy settings, and account security.
          </p>

          <div className="space-y-4">
            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Account Overview</div>
                <div className="text-sm text-muted">View and update your profile details</div>
              </div>
              <Link href="/account" className="btn-secondary text-sm">
                Go
              </Link>
            </div>

            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Email &amp; Notifications</div>
                <div className="text-sm text-muted">Coming soon</div>
              </div>
              <span className="text-xs text-muted">Soon</span>
            </div>

            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Privacy &amp; Data</div>
                <div className="text-sm text-muted">Coming soon</div>
              </div>
              <span className="text-xs text-muted">Soon</span>
            </div>

            <div className="card-glass p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold">Security</div>
                <div className="text-sm text-muted">Password, 2FA, sessions</div>
              </div>
              <span className="text-xs text-muted">Soon</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
