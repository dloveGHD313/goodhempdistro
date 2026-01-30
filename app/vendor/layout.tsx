import { redirect } from "next/navigation";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireVendorOnboarding({ pathname: "/vendor" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
