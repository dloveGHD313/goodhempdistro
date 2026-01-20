import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ResetPasswordClient from "./ResetPasswordClient";

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  // Get user email if session exists (for resend functionality)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || null;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <ResetPasswordClient initialEmail={userEmail} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
