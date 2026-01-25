import type { MetadataRoute } from "next";

const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const routes = [
    "/",
    "/about",
    "/contact",
    "/pricing",
    "/newsfeed",
    "/groups",
    "/forums",
    "/discover",
    "/products",
    "/services",
    "/vendors",
    "/events",
    "/blog",
    "/wholesale",
    "/vendor-registration",
    "/affiliate",
    "/privacy",
    "/terms",
    "/refunds",
    "/orders/cancel",
  ];

  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));
}
