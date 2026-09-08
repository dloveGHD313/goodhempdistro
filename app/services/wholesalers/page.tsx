import type { Metadata } from "next";
import ServiceCategoryPage from "../_components/ServiceCategoryPage";

export const metadata: Metadata = {
  title: "Wholesalers | Services | Good Hemp Distro",
  description: "Bulk suppliers of hemp goods and industrial materials.",
};

export default function Page() {
  return <ServiceCategoryPage title="Wholesalers" description="Bulk suppliers of hemp goods and industrial materials." slug="wholesalers" />;
}
