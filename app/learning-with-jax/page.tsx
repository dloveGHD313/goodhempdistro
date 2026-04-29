import { Metadata } from "next";
import { brand } from "@/lib/brand";
import LearningWithJaxMotion from "./LearningWithJaxMotion";

export const metadata: Metadata = {
  title: "Learning with Jax | Hemp Industry Education",
  description:
    "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
  openGraph: {
    title: "Learning with Jax | Hemp Industry Education",
    description:
      "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
    url: `${brand.url}/learning-with-jax`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning with Jax | Hemp Industry Education",
    description:
      "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
  },
};

export default function LearningWithJaxPage() {
  return <LearningWithJaxMotion />;
}
