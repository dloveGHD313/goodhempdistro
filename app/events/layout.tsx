import { redirect } from "next/navigation";
import { requireConsumerOnboarding } from "@/lib/server/onboardingGate";

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireConsumerOnboarding({ pathname: "/events" });
  if ("redirectTo" in result) {
    redirect(result.redirectTo);
  }

  return <>{children}</>;
}
