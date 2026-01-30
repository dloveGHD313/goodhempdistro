import { redirect } from "next/navigation";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireVendorOnboarding({ pathname: "/vendors/products" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
