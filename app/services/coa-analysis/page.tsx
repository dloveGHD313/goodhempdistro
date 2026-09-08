import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "COA labs & analysis | Services | Good Hemp Distro",
  description: "Third-party testing labs for certificates of analysis.",
};

export default function Page() {
  return <ServiceCategoryPage title="COA labs & analysis" description="Third-party testing labs for certificates of analysis." slug="coa-analysis" />;
}
