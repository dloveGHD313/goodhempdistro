import { brand } from "@/lib/brand";
import StartFlowClient from "./StartFlowClient";

export const metadata = {
  title: `Start Here · ${brand.name}`,
  description: "Choose your path: Shopper, Vendor, Logistics, or Builder. We'll take you to the right place.",
};

/**
 * Phase 2: Workout Flow — path selection then redirect.
 * Entry from Nav "Join Free", homepage "Get Started", and /welcome "Start Here".
 */
export default function StartPage() {
  return <StartFlowClient />;
}
