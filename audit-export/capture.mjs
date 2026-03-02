// audit-export/capture.mjs
// Fetches raw HTML, status codes, metadata, links, and redirect chains for all URLs
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";

const BASE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const PAGES_DIR = path.join(BASE, "pages");
const AUDIT_LOG = path.join(BASE, "site", "audit-log.txt");
const TIMEOUT = 20000;

const URLS = [
  "https://www.goodhempdistro.com/",
  "https://www.goodhempdistro.com/welcome",
  "https://www.goodhempdistro.com/about",
  "https://www.goodhempdistro.com/contact",
  "https://www.goodhempdistro.com/pricing",
  "https://www.goodhempdistro.com/products",
  "https://www.goodhempdistro.com/services",
  "https://www.goodhempdistro.com/vendors",
  "https://www.goodhempdistro.com/events",
  "https://www.goodhempdistro.com/blog",
  "https://www.goodhempdistro.com/education",
  "https://www.goodhempdistro.com/wholesale",
  "https://www.goodhempdistro.com/vendor-registration",
  "https://www.goodhempdistro.com/affiliate",
  "https://www.goodhempdistro.com/privacy",
  "https://www.goodhempdistro.com/terms",
  "https://www.goodhempdistro.com/refunds",
  "https://www.goodhempdistro.com/faq",
  "https://www.goodhempdistro.com/support",
  "https://www.goodhempdistro.com/login",
  "https://www.goodhempdistro.com/get-started",
  "https://www.goodhempdistro.com/logistics",
  "https://www.goodhempdistro.com/newsfeed",
  "https://www.goodhempdistro.com/groups",
  "https://www.goodhempdistro.com/forums",
  "https://www.goodhempdistro.com/discover",
  "https://www.goodhempdistro.com/orders/cancel",
];

const logs = [];
function logEntry(msg) { logs.push(`${new Date().toISOString()} ${msg}`); process.stdout.write(msg + "\n"); }
function slugify(url) {
  return url.replace(/^https?:\/\/[^/]+/, "").replace(/\//g, "_").replace(/^_/, "") || "root";
}

function fetchUrl(url, maxRedirects = 8) {
  return new Promise((resolve) => {
    const chain = [];
    function doFetch(currentUrl, remaining) {
      const parsed = new URL(currentUrl);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.get(currentUrl, {
        headers: {
          "User-Agent": "GHD-Audit/1.0 (CEO Audit Run 2026-03-02)",
          "Accept": "text/html,application/xhtml+xml,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: TIMEOUT,
      }, (res) => {
        chain.push({ url: currentUrl, status: res.statusCode });
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && remaining > 0) {
          const next = new URL(res.headers.location, currentUrl).href;
          res.resume();
          doFetch(next, remaining - 1);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body, chain, finalUrl: currentUrl });
        });
        res.on("error", (e) => resolve({ status: 0, error: e.message, body: "", chain, finalUrl: currentUrl }));
      });
      req.on("error", (e) => resolve({ status: 0, error: e.message, body: "", chain, finalUrl: currentUrl }));
      req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "TIMEOUT", body: "", chain, finalUrl: currentUrl }); });
    }
    doFetch(url, maxRedirects);
  });
}

function extractMeta(html, finalUrl) {
  const get = (pattern) => { const m = html.match(pattern); return m ? (m[1] || m[2] || "").trim() : null; };
  const getAll = (pattern) => { const results = []; let m; const re = new RegExp(pattern.source || pattern, "gi"); while ((m = re.exec(html)) !== null) results.push(m[1]?.trim() || ""); return results; };
  
  const title = get(/<title[^>]*>([^<]+)<\/title>/i);
  const desc = get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
               get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                    get(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const robots = get(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  
  const og = {};
  const ogPattern = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = ogPattern.exec(html)) !== null) og[m[1]] = m[2];
  
  const twitter = {};
  const twPattern = /<meta[^>]+name=["'](twitter:[^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  while ((m = twPattern.exec(html)) !== null) twitter[m[1]] = m[2];
  
  const headings = [];
  const hPattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((m = hPattern.exec(html)) !== null) {
    headings.push({ tag: m[1], text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() });
  }

  const jsonLd = [];
  const ldPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldPattern.exec(html)) !== null) { try { jsonLd.push(JSON.parse(m[1].trim())); } catch { jsonLd.push(m[1].trim()); } }
  
  const lang = get(/<html[^>]+lang=["']([^"']+)["']/i);
  
  return { title, meta_description: desc, canonical: canonical || finalUrl, robots, og, twitter, headings, json_ld: jsonLd, lang };
}

function extractLinks(html, baseUrl) {
  const internal = [], external = [];
  const linkPattern = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const raw = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!raw || raw.startsWith("javascript:") || raw.startsWith("mailto:")) continue;
    try {
      const abs = new URL(raw, baseUrl).href;
      if (abs.includes("goodhempdistro.com")) internal.push({ href: abs, text });
      else external.push({ href: abs, text });
    } catch {}
  }
  return { internal: dedup(internal, "href"), external: dedup(external, "href") };
}

function extractAssets(html, baseUrl) {
  const images = [];
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*/gi;
  let m;
  while ((m = imgPattern.exec(html)) !== null) {
    const src = m[1].trim();
    const alt = (m[0].match(/alt=["']([^"']*)["']/) || [])[1] || "";
    try { images.push({ src: new URL(src, baseUrl).href, alt }); } catch {}
  }
  return { images: dedup(images, "src") };
}

function dedup(arr, key) {
  const seen = new Set();
  return arr.filter(item => { if (seen.has(item[key])) return false; seen.add(item[key]); return true; });
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, "\n")
    .trim();
}

async function checkStatus(url) {
  try {
    const result = await fetchUrl(url);
    return result.status;
  } catch { return 0; }
}

async function processUrl(url) {
  const slug = slugify(url) || "root";
  const dir = path.join(PAGES_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  
  logEntry(`[FETCH] ${url}`);
  const result = await fetchUrl(url);
  
  const status = {
    url,
    finalUrl: result.finalUrl,
    status_code: result.status,
    redirect_chain: result.chain,
    error: result.error || null,
    content_type: result.headers?.["content-type"] || null,
  };
  
  // raw.html
  const rawContent = `<!-- AUDIT CAPTURE: ${new Date().toISOString()} -->\n<!-- ORIGINAL URL: ${url} -->\n<!-- FINAL URL: ${result.finalUrl} -->\n<!-- STATUS: ${result.status} -->\n\n${result.body}`;
  fs.writeFileSync(path.join(dir, "raw.html"), rawContent, "utf8");
  
  // status.json
  fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(status, null, 2), "utf8");
  
  if (!result.body) {
    logEntry(`[WARN] No body for ${url}: ${result.error || "empty"}`);
    fs.writeFileSync(path.join(dir, "metadata.json"), JSON.stringify({ error: "no body" }, null, 2), "utf8");
    fs.writeFileSync(path.join(dir, "clean-text.txt"), "", "utf8");
    fs.writeFileSync(path.join(dir, "links.json"), JSON.stringify({ internal: [], external: [] }, null, 2), "utf8");
    fs.writeFileSync(path.join(dir, "assets.json"), JSON.stringify({ images: [] }, null, 2), "utf8");
    return { slug, url, status: result.status, error: result.error };
  }
  
  const meta = extractMeta(result.body, result.finalUrl);
  const links = extractLinks(result.body, result.finalUrl);
  const assets = extractAssets(result.body, result.finalUrl);
  const text = cleanText(result.body);
  
  fs.writeFileSync(path.join(dir, "metadata.json"), JSON.stringify(meta, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, "links.json"), JSON.stringify(links, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, "assets.json"), JSON.stringify(assets, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, "clean-text.txt"), text, "utf8");
  
  logEntry(`[OK] ${url} → ${result.status} (${result.body.length} bytes, ${links.internal.length} internal links, ${assets.images.length} images)`);
  return { slug, url, status: result.status, finalUrl: result.finalUrl, internalLinks: links.internal.length, images: assets.images.length };
}

async function main() {
  logEntry("=== GHD AUDIT CAPTURE START ===");
  logEntry(`Timestamp: ${new Date().toISOString()}`);
  logEntry(`Total URLs: ${URLS.length}`);
  
  const results = [];
  for (const url of URLS) {
    const r = await processUrl(url);
    results.push(r);
    await new Promise(res => setTimeout(res, 500)); // polite delay
  }
  
  // Write audit log
  fs.writeFileSync(AUDIT_LOG, logs.join("\n"), "utf8");
  
  // Write capture summary
  fs.writeFileSync(path.join(BASE, "site", "capture-summary.json"), JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    results
  }, null, 2), "utf8");
  
  logEntry("=== CAPTURE COMPLETE ===");
  console.log("\nSummary:");
  results.forEach(r => console.log(`  ${r.status || "ERR"} ${r.url}${r.error ? " ERROR: " + r.error : ""}`));
}

main().catch(console.error);
