import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Insurance providers | Services | Good Hemp Distro",
  description: "Coverage for hemp growers, vendors, builders and events.",
};

export default function Page() {
  return <ServiceCategoryPage title="Insurance providers" description="Coverage for hemp growers, vendors, builders and events." slug="insurance-providers" />;
}
