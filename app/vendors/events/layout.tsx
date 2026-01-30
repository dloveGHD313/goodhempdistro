import { redirect } from "next/navigation";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireVendorOnboarding({ pathname: "/vendors/events" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
