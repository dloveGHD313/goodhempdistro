import { redirect } from "next/navigation";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function VendorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireConsumerOnboarding({ pathname: "/vendors" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
