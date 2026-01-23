import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient, hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type ProfileGate = {
  role: string | null;
  consumer_onboarding_completed: boolean | null;
};

async function getCheckoutState(): Promise<
  | { state: "missing_env" }
  | { state: "unauthenticated" }
  | { state: "needs_onboarding" }
  | { state: "ready" }
> {
  noStore();

  if (!hasSupabase()) {
    return { state: "missing_env" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { state: "unauthenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, consumer_onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileError) {
    const gate = profile as ProfileGate | null;
    if (gate?.role === "consumer" && !gate?.consumer_onboarding_completed) {
      return { state: "needs_onboarding" };
    }
  }

  return { state: "ready" };
}

export default async function CheckoutPage() {
  const checkoutState = await getCheckoutState();

  if (checkoutState.state === "missing_env") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-6">
              <h1 className="text-2xl font-semibold text-accent">Checkout unavailable</h1>
              <p className="text-muted mt-2">
                Checkout is temporarily unavailable. Please try again shortly.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (checkoutState.state === "unauthenticated") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-6">
              <h1 className="text-2xl font-semibold text-accent">Sign in to continue</h1>
              <p className="text-muted mt-2">
                Please log in to start a secure checkout session.
              </p>
              <div className="mt-4">
                <Link className="btn-primary" href="/login?redirect=/checkout">
                  Go to Login
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (checkoutState.state === "needs_onboarding") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-6">
              <h1 className="text-2xl font-semibold text-accent">Complete onboarding</h1>
              <p className="text-muted mt-2">
                We need a few details before checkout can start.
              </p>
              <div className="mt-4">
                <Link className="btn-primary" href="/onboarding/consumer">
                  Continue onboarding
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="card-glass p-6">
            <h1 className="text-2xl font-semibold text-accent">Checkout ready</h1>
            <p className="text-muted mt-2">
              Checkout sessions are created from product and service pages. If you arrived
              here directly, return to the marketplace to begin checkout.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/products">
                Browse products
              </Link>
              <Link className="btn-secondary" href="/services">
                Browse services
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
