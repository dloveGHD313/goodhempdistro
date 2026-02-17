import { redirect } from "next/navigation";

/**
 * /start is an alias for home. No duplicated UI.
 */
export default function StartAlias() {
  redirect("/");
}
