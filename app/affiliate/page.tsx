import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";

export default async function AffiliatePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>Affiliate Program</h1>
        {!user ? (
          <div className="card p-6">
            <p className="text-gray-300 mb-4">Earn rewards by referring friends and vendors.</p>
            <div className="flex gap-4">
              <Link href="/login" className="btn-primary">Login</Link>
              <Link href="/get-started" className="btn-cta">Get Started</Link>
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-gray-300">Your personalized referral tools will appear here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
