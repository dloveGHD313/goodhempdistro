import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import DriverApplicationPageClient from "./DriverApplicationPageClient";

export const metadata: Metadata = {
  title: "Become a GHD Driver | Good Hemp Distro",
  description:
    "Join the Good Hemp Distro delivery network. Flexible hours, competitive pay, and compliant hemp product deliveries.",
  openGraph: {
    title: "Become a GHD Driver | Good Hemp Distro",
    description:
      "Join the Good Hemp Distro delivery network. Flexible hours, competitive pay, and compliant hemp product deliveries.",
    url: `${brand.url}/logistics/apply`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a GHD Driver | Good Hemp Distro",
    description:
      "Join the Good Hemp Distro delivery network. Flexible hours, competitive pay, and compliant hemp product deliveries.",
  },
};

export default function DriverApplicationPage() {
  return <DriverApplicationPageClient />;
}
