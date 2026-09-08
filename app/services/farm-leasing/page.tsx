import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Farm leasing | Services | Good Hemp Distro",
  description: "Land and facilities available to hemp growers and processors.",
};

export default function Page() {
  return <ServiceCategoryPage title="Farm leasing" description="Land and facilities available to hemp growers and processors." slug="farm-leasing" />;
}
