import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Cannabis-approved banks | Services | Good Hemp Distro",
  description: "Banks and payment partners that work with hemp companies.",
};

export default function Page() {
  return <ServiceCategoryPage title="Cannabis-approved banks" description="Banks and payment partners that work with hemp companies." slug="cannabis-banks" />;
}
