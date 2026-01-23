type DiscoveryCheck = {
  label: string;
  passed: boolean;
  details?: string;
};

const baseUrl = process.env.DISCOVERY_BASE_URL;
const authCookie = process.env.DISCOVERY_AUTH_COOKIE;

async function fetchStatus(url: string, cookie?: string) {
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  return res.status;
}

async function run() {
  const checks: DiscoveryCheck[] = [];

  if (!baseUrl) {
    checks.push({
      label: "DISCOVERY_BASE_URL not set",
      passed: true,
      details: "Skipping live discovery checks (set DISCOVERY_BASE_URL to run).",
    });
  } else {
    const anonStatus = await fetchStatus(`${baseUrl}/discover`);
    checks.push({
      label: "Anon /discover returns 200",
      passed: anonStatus === 200,
      details: `status=${anonStatus}`,
    });

    if (authCookie) {
      const authStatus = await fetchStatus(`${baseUrl}/discover`, authCookie);
      checks.push({
        label: "Authed /discover returns 200",
        passed: authStatus === 200,
        details: `status=${authStatus}`,
      });
    } else {
      checks.push({
        label: "DISCOVERY_AUTH_COOKIE not set",
        passed: true,
        details: "Skipping authed discovery check.",
      });
    }
  }

  const failed = checks.filter((check) => !check.passed);
  checks.forEach((check) => {
    const status = check.passed ? "PASS" : "FAIL";
    const detail = check.details ? ` (${check.details})` : "";
    console.log(`[verify-discovery] ${status}: ${check.label}${detail}`);
  });

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("[verify-discovery] Unexpected error:", error);
  process.exit(1);
});
