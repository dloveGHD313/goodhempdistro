import { redirect } from "next/navigation";

/**
 * /shop → /products (P1, storefront audit 2026-07-10).
 *
 * The live catalog is /products — MascotAssistant, /welcome, and order pages
 * all link there. This route previously rendered a "Coming Soon" placeholder
 * (PR #175, when the catalog was empty), which became a dead end that lost
 * sales once /products went live. One canonical catalog home.
 */
export default function ShopRedirect() {
  redirect("/products");
}
