// build-nav-and-links.mjs
import fs from "fs";
import path from "path";
import { URL } from "url";
import https from "https";
import http from "http";

const BASE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const PAGES_DIR = path.join(BASE, "pages");
const SITE_DIR = path.join(BASE, "site");

// === NAVIGATION MAP ===
// Built from browser snapshot + links.json of /welcome (public entry page)

const navMap = {
  source: "https://www.goodhempdistro.com/welcome (post-hydration browser snapshot)",
  captured_at: "2026-03-02T04:25:00Z",
  header: {
    logo: { label: "Good Hemp Distros", href: "/" },
    primary_links: [
      { label: "Discover", href: "/discover" },
      { label: "Events", href: "/events" },
      { label: "Episodes", href: "/learning-with-jax" },
    ],
    dropdowns: {
      "Community ▼": [
        { label: "Groups", href: "/groups" },
        { label: "Forums", href: "/forums" },
        { label: "Blog", href: "/blog" },
      ],
      "Business ▼": [
        { label: "Vendors", href: "/vendors" },
        { label: "Services", href: "/services" },
        { label: "Wholesale", href: "/wholesale" },
        { label: "Logistics", href: "/logistics" },
        { label: "Driver Network", href: "/logistics/apply" },
        { label: "Vendor Registration", href: "/vendor-registration" },
      ],
    },
    utility_links: [
      { label: "Join Free", href: "/get-started", style: "btn-primary" },
      { label: "Sign In", href: "/login", style: "btn-ghost" },
    ],
  },
  mobile_drawer: {
    cta_logged_out: [
      { label: "Join Free", href: "/get-started" },
      { label: "Sign In", href: "/login" },
    ],
    sections: [
      { heading: "Public", links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Support", href: "/support" },
        { label: "FAQ", href: "/faq" },
        { label: "Blog", href: "/blog" },
      ]},
      { heading: "Discover", links: [
        { label: "Marketplace", href: "/products" },
        { label: "Education", href: "/education" },
      ]},
      { heading: "Primary", links: [
        { label: "Feed", href: "/newsfeed" },
        { label: "Discover", href: "/discover" },
        { label: "Events", href: "/events" },
        { label: "Episodes", href: "/learning-with-jax" },
      ]},
      { heading: "Community", links: [
        { label: "Groups", href: "/groups" },
        { label: "Forums", href: "/forums" },
        { label: "Blog", href: "/blog" },
      ]},
      { heading: "Business", links: [
        { label: "Vendors", href: "/vendors" },
        { label: "Services", href: "/services" },
        { label: "Wholesale", href: "/wholesale" },
        { label: "Logistics", href: "/logistics" },
        { label: "Driver Network", href: "/logistics/apply" },
        { label: "Vendor Registration", href: "/vendor-registration" },
      ]},
    ],
  },
  footer: {
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refunds", href: "/refunds" },
      { label: "Contact", href: "/contact" },
    ],
    copyright: "© 2026 Good Hemp Distro. All rights reserved.",
  },
};

fs.writeFileSync(path.join(SITE_DIR, "navigation.json"), JSON.stringify(navMap, null, 2), "utf8");
console.log("navigation.json written");

// === AGGREGATE LINKS + BROKEN LINK DETECTION ===
const slugDirs = fs.readdirSync(PAGES_DIR).filter(d => fs.statSync(path.join(PAGES_DIR, d)).isDirectory());

const allInternal = new Map(); // href → [{fromUrl, text}]
const allExternal = new Map();

for (const slug of slugDirs) {
  const linksPath = path.join(PAGES_DIR, slug, "links.json");
  const statusPath = path.join(PAGES_DIR, slug, "status.json");
  if (!fs.existsSync(linksPath)) continue;
  
  let fromUrl = `https://www.goodhempdistro.com/${slug === "root" ? "" : slug}`;
  if (fs.existsSync(statusPath)) {
    try { const s = JSON.parse(fs.readFileSync(statusPath, "utf8")); fromUrl = s.url || fromUrl; } catch {}
  }

  try {
    const { internal = [], external = [] } = JSON.parse(fs.readFileSync(linksPath, "utf8"));
    for (const link of internal) {
      const k = link.href;
      if (!allInternal.has(k)) allInternal.set(k, []);
      allInternal.get(k).push({ fromUrl, text: link.text });
    }
    for (const link of external) {
      const k = link.href;
      if (!allExternal.has(k)) allExternal.set(k, []);
      allExternal.get(k).push({ fromUrl, text: link.text });
    }
  } catch {}
}

// Check status of unique internal links (sample up to 50)
// Select http or https based on URL protocol to avoid ERR_INVALID_PROTOCOL on http:// links.
async function checkStatus(url) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.get(url, { headers: { "User-Agent": "GHD-Audit/1.0" }, timeout: 8000 }, res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => resolve(0));
      req.on("timeout", () => { req.destroy(); resolve(0); });
    } catch { resolve(0); }
  });
}

// Build broken links CSV
const brokenInternalRows = ["URL,AnchorText,FoundOnPage,StatusCode"];
const brokenExternalRows = ["URL,AnchorText,FoundOnPage,StatusCode"];
const missingAssetsRows = ["AssetURL,AltText,FoundOnPage,StatusCode"];

// Check internal links
const internalKeys = [...allInternal.keys()].filter(u => u.includes("goodhempdistro.com")).slice(0, 60);
console.log(`Checking ${internalKeys.length} unique internal links...`);

for (const href of internalKeys) {
  const status = await checkStatus(href);
  if (status >= 400 || status === 0) {
    const refs = allInternal.get(href);
    for (const ref of refs.slice(0, 2)) {
      brokenInternalRows.push(`"${href}","${ref.text.replace(/"/g,'""')}","${ref.fromUrl}",${status}`);
    }
    console.log(`  BROKEN: ${href} → ${status}`);
  }
  await new Promise(r => setTimeout(r, 200));
}

// Check external links (sample up to 20 unique external URLs)
const externalKeys = [...allExternal.keys()].slice(0, 20);
console.log(`Checking ${externalKeys.length} unique external links...`);

for (const href of externalKeys) {
  const status = await checkStatus(href);
  if (status >= 400 || status === 0) {
    const refs = allExternal.get(href);
    for (const ref of refs.slice(0, 2)) {
      brokenExternalRows.push(`"${href}","${ref.text.replace(/"/g,'""')}","${ref.fromUrl}",${status}`);
    }
    console.log(`  BROKEN EXTERNAL: ${href} → ${status}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

// Aggregate missing assets from assets.json
for (const slug of slugDirs) {
  const assetsPath = path.join(PAGES_DIR, slug, "assets.json");
  const statusPath = path.join(PAGES_DIR, slug, "status.json");
  if (!fs.existsSync(assetsPath)) continue;
  let fromUrl = `https://www.goodhempdistro.com/${slug === "root" ? "" : slug}`;
  if (fs.existsSync(statusPath)) {
    try { const s = JSON.parse(fs.readFileSync(statusPath, "utf8")); fromUrl = s.url || fromUrl; } catch {}
  }
  try {
    const { images = [] } = JSON.parse(fs.readFileSync(assetsPath, "utf8"));
    // Sample check first image per page
    for (const img of images.slice(0, 1)) {
      if (!img.src.startsWith("http")) continue;
      const status = await checkStatus(img.src);
      if (status >= 400 || status === 0) {
        missingAssetsRows.push(`"${img.src}","${(img.alt||"").replace(/"/g,'""')}","${fromUrl}",${status}`);
      }
    }
  } catch {}
}

fs.writeFileSync(path.join(SITE_DIR, "broken-links.csv"), brokenInternalRows.join("\n"), "utf8");
fs.writeFileSync(path.join(SITE_DIR, "broken-external-links.csv"), brokenExternalRows.join("\n"), "utf8");
fs.writeFileSync(path.join(SITE_DIR, "missing-assets.csv"), missingAssetsRows.join("\n"), "utf8");

console.log(`broken-links.csv: ${brokenInternalRows.length - 1} broken internal links`);
console.log(`missing-assets.csv: ${missingAssetsRows.length - 1} missing assets`);
