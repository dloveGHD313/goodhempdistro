import type { Metadata } from "next";
import ComingSoonPage from "@/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Good Hemp Distro Community | Coming Soon",
  description:
    "A space for hemp vendors, growers, and consumers to share what they're working on. Join the waitlist and we'll let you know when the feed opens.",
};

export default function CommunityPage() {
  return (
    <ComingSoonPage
      eyebrow="Coming Soon"
      headline="The community feed is on its way."
      valueProp="A space for hemp vendors, growers, and consumers to share what they're working on. Compliance-aware, vendor-friendly, no algorithm games. Get on the list and we'll send an invite when the feed opens."
      source="community-coming-soon"
      secondaryCta={{ label: "Read the newsfeed", href: "/newsfeed" }}
    />
  );
}
