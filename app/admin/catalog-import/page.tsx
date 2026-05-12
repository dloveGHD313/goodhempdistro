import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import CatalogImportClient from "./CatalogImportClient";

// Defense-in-depth — admin route. Middleware also gates /admin/*; this layout
// guarantees the server-side session check runs at request time even if the
// route is later included in static-prerender candidates.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog Import | Admin | Good Hemp Distros",
  description: "Bulk-import the anchor catalog via CSV. Admin only.",
  robots: { index: false, follow: false },
};

export default async function CatalogImportPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.isAdmin) {
    redirect("/login?redirect=/admin/catalog-import");
  }

  return <CatalogImportClient />;
}
