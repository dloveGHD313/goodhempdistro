import { redirect } from "next/navigation";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireConsumerOnboarding({ pathname: "/products" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
