import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

// Defense-in-depth — see GATE-02. Without force-dynamic, Next.js statically
// pre-renders this layout at build time and the runtime session check never
// fires for anonymous requests. force-dynamic guarantees the layout runs on
// every request so redirect() can gate access. Middleware also gates this
// route via the RESERVED_VENDOR_SUBROUTES allowlist — two layers of defense.
export const dynamic = "force-dynamic";

export default async function VendorsServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    redirect("/login?redirect=/vendors/services");
  }
  const result = await requireVendorOnboarding(user.id);
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
