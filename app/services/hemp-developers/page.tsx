import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Hemp developers | Services | Good Hemp Distro",
  description: "Builders, contractors and developers working with hempcrete and hemp materials.",
};

export default function Page() {
  return <ServiceCategoryPage title="Hemp developers" description="Builders, contractors and developers working with hempcrete and hemp materials." slug="hemp-developers" />;
}
