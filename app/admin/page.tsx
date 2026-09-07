import { redirect } from "next/navigation";

/**
 * /admin used to 404 while several admin pages linked "← Admin Dashboard" to it.
 * Land admins on the vendor queue, which is the working home of the admin area.
 */
export default function AdminIndexPage() {
  redirect("/admin/vendors");
}
