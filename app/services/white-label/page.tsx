import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "White-label manufacturers | Services | Good Hemp Distro",
  description: "Private-label and contract manufacturing for hemp products.",
};

export default function Page() {
  return <ServiceCategoryPage title="White-label manufacturers" description="Private-label and contract manufacturing for hemp products." slug="white-label" />;
}
