import type { Metadata } from "next";
import ComingSoonPage from "@/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Shop Hemp Products | Good Hemp Distro",
  description:
    "The Good Hemp Distro shop is launching with COA-verified hemp products from vetted vendors. Get notified when our shop opens.",
};

export default function ShopPage() {
  return (
    <ComingSoonPage
      eyebrow="Coming Soon"
      headline="The shop is almost open."
      valueProp="We're seeding the catalog with COA-verified hemp products from vetted vendors. Drop your email and we'll let you know the moment the doors open."
      source="shop-coming-soon"
      secondaryCta={{ label: "Browse vendors instead", href: "/vendors" }}
    />
  );
}
