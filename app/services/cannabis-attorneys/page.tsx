import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Cannabis attorneys | Services | Good Hemp Distro",
  description: "Licensing, compliance and contract counsel for hemp businesses.",
};

export default function Page() {
  return <ServiceCategoryPage title="Cannabis attorneys" description="Licensing, compliance and contract counsel for hemp businesses." slug="cannabis-attorneys" />;
}
