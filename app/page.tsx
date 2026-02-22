import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";

export const metadata = {
  title: brand.name,
  description: "Welcome to Good Hemp Distros.",
};

export default function HomePage() {
  redirect("/welcome");
}
