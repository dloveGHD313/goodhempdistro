import type { MascotResults } from "@/components/mascot/types";

export function getVendorHelp(topic: string): MascotResults {
  const normalized = (topic || "").toLowerCase();
  const items = [
    {
      title: "Create a product listing",
      subtitle: "Draft a product and submit for review.",
      href: "/vendors/products/new",
      meta: "Listings",
    },
    {
      title: "Upload COA documentation",
      subtitle: "Attach compliance docs for approval.",
      href: "/vendors/products",
      meta: "Compliance",
    },
    {
      title: "Submit an event",
      subtitle: "Create event details and tickets.",
      href: "/vendors/events/new",
      meta: "Events",
    },
    {
      title: "Check approval status",
      subtitle: "Track drafts and pending reviews.",
      href: "/vendors/dashboard",
      meta: "Review queue",
    },
  ];

  const filtered = normalized
    ? items.filter((item) => item.title.toLowerCase().includes(normalized))
    : items;

  return {
    type: "links",
    items: filtered,
  };
}
