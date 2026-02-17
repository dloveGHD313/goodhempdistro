import { brand } from "@/lib/brand";
import StartFlowClient from "./start/StartFlowClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: brand.name,
  description: "Choose your path: Shopper, Vendor, Logistics, Builder, or Affiliate. We'll take you to the right place.",
};

/**
 * Home page: Phase 2 Workout Flow (path selection then redirect).
 * Same UX as former /start. /start redirects here.
 */
export default function HomePage() {
  return <StartFlowClient />;
}
