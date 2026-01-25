type VerifyConfig = {
  baseUrl: string;
  accessToken: string;
  refreshToken: string;
};

export {};

const loadConfig = (): VerifyConfig => {
  const baseUrl = process.env.VERIFY_BASE_URL || "http://localhost:3000";
  const accessToken = process.env.VERIFY_SB_ACCESS_TOKEN || "";
  const refreshToken = process.env.VERIFY_SB_REFRESH_TOKEN || "";

  if (!accessToken || !refreshToken) {
    throw new Error(
      "Missing VERIFY_SB_ACCESS_TOKEN or VERIFY_SB_REFRESH_TOKEN for authenticated calls."
    );
  }

  return {
    baseUrl,
    accessToken,
    refreshToken,
  };
};

const buildCookieHeader = (config: VerifyConfig) =>
  `sb-access-token=${config.accessToken}; sb-refresh-token=${config.refreshToken}`;

const assertStatus = async (response: Response, label: string) => {
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (response.status !== 201) {
    throw new Error(`${label} expected 201, got ${response.status}: ${text}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[verify] ${label} => ${response.status}`, parsed);
};

const run = async () => {
  const config = loadConfig();
  const cookieHeader = buildCookieHeader(config);

  const productMinimal = await fetch(`${config.baseUrl}/api/vendors/products/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      name: "Verify Product Minimal",
      price: "10.00",
      product_type: "non_intoxicating",
    }),
  });

  await assertStatus(productMinimal, "Product create (minimal)");

  const productNoCategory = await fetch(`${config.baseUrl}/api/vendors/products/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      name: "Verify Product No Category",
      description: "No category or COA",
      price: 15.5,
      product_type: "delta8",
    }),
  });

  await assertStatus(productNoCategory, "Product create (no category)");

  const productWithCategory = await fetch(`${config.baseUrl}/api/vendors/products/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      name: "Verify Product With Category",
      price: "20.00",
      product_type: "intoxicating",
      category: process.env.VERIFY_CATEGORY || "flower",
    }),
  });

  await assertStatus(productWithCategory, "Product create (category)");

  const eventResponse = await fetch(`${config.baseUrl}/api/vendors/events/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      title: "Verify Event",
      description: "Automated verification event",
      location: "Virtual",
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      ticket_types: [
        {
          name: "General Admission",
          price: "10.00",
          quantity: null,
        },
      ],
    }),
  });

  await assertStatus(eventResponse, "Event create");

  // eslint-disable-next-line no-console
  console.log("verify-vendor-creates: OK");
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
