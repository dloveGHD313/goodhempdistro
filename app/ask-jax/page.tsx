import type { Metadata } from "next";
import ComingSoonPage from "@/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Ask JAX | Good Hemp Distro",
  description:
    "JAX is Good Hemp Distro's hemp-compliance assistant — coming soon to paid plans. Get on the waitlist for early access.",
};

export default function AskJaxPage() {
  return (
    <ComingSoonPage
      eyebrow="Coming Soon"
      headline="Ask JAX — hemp's first compliance copilot."
      valueProp="JAX understands hemp regulations, vendor compliance, and product recommendations. Available soon on paid plans. Join the waitlist for early access."
      source="ask-jax-coming-soon"
      secondaryCta={{ label: "Preview JAX features", href: "/jax-preview" }}
    />
  );
}
