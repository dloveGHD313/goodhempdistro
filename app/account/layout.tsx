import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requirePhase15Complete } from "@/lib/server/phase15Gate";

// FIXED: Force dynamic to avoid prerender crash when env vars missing during build.
// Account pages require auth; they should never be statically generated.
export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  const phase15Redirect = await requirePhase15Complete(user.id);
  if (phase15Redirect) redirect(phase15Redirect);

  return <>{children}</>;
}
