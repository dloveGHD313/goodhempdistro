import { redirect } from "next/navigation";

/** Legacy URL — the event form lives at /vendors/events/new. */
export default function VendorEventCreateRedirect() {
  redirect("/vendors/events/new");
}
