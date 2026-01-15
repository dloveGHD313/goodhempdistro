/**
 * Environment Variable Validation
 * 
 * This module validates critical environment variables at runtime
 * and logs clear errors if any are missing (without exposing secret values).
 */

interface EnvVar {
  name: string;
  required: boolean;
  secret?: boolean;
  description: string;
}

const requiredEnvVars: EnvVar[] = [
  // Public variables
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous/public key",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: true,
    description: "Production site URL for redirects",
  },
  // Server-only variables
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    secret: true,
    description: "Supabase service role key (server-only)",
  },
  {
    name: "STRIPE_SECRET_KEY",
    required: true,
    secret: true,
    description: "Stripe secret API key",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: true,
    secret: true,
    description: "Stripe webhook signing secret",
  },
];

let validationRun = false;

/**
 * Validate all required environment variables
 * Logs warnings for missing vars without exposing secret values
 * 
 * Call this at app startup or in API routes
 */
export function validateEnvironmentVariables(options?: {
  throwOnMissing?: boolean;
  logSuccess?: boolean;
}): { valid: boolean; missing: string[] } {
  const { throwOnMissing = false, logSuccess = false } = options || {};

  // Only run once per process
  if (validationRun && !throwOnMissing) {
    return { valid: true, missing: [] };
  }
  validationRun = true;

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check each required variable
  requiredEnvVars.forEach((envVar) => {
    const value = process.env[envVar.name];

    if (!value || value.trim() === "") {
      missing.push(envVar.name);
      warnings.push(
        `❌ Missing ${envVar.secret ? "secret" : "public"} env var: ${envVar.name} (${envVar.description})`
      );
    }
  });

  // Log results
  if (missing.length > 0) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("⚠️  ENVIRONMENT CONFIGURATION ERROR");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    warnings.forEach((warning) => console.error(warning));
    console.error("");
    console.error("📝 Required environment variables are missing.");
    console.error(
      "   Please set them in Vercel (Settings → Environment Variables)"
    );
    console.error("   See DEPLOY_PRODUCTION.md for setup instructions.");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (throwOnMissing) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }

    return { valid: false, missing };
  }

  // Success
  if (logSuccess) {
    console.log("✅ All required environment variables are configured");
  }

  return { valid: true, missing: [] };
}

/**
 * Validate specific environment variables
 * Useful for route-specific checks
 */
export function validateEnvVars(
  varNames: string[],
  context?: string
): boolean {
  const missing = varNames.filter(
    (name) => !process.env[name] || process.env[name]?.trim() === ""
  );

  if (missing.length > 0) {
    const contextStr = context ? ` [${context}]` : "";
    console.error(
      `❌${contextStr} Missing environment variables: ${missing.join(", ")}`
    );
    console.error(
      "   Set these in Vercel → Settings → Environment Variables"
    );
    return false;
  }

  return true;
}

/**
 * Get a safe display value for logging (masks secrets)
 */
export function getSafeEnvDisplay(key: string): string {
  const value = process.env[key];

  if (!value) return "[NOT SET]";

  // Mask secrets
  const isSecret =
    key.includes("SECRET") ||
    key.includes("KEY") ||
    key.includes("PRIVATE") ||
    key.includes("PASSWORD");

  if (isSecret) {
    // Show first/last 4 chars only
    if (value.length > 8) {
      return `${value.slice(0, 4)}...${value.slice(-4)}`;
    }
    return "***";
  }

  // For URLs, show full value
  if (key.includes("URL") || key.includes("SITE")) {
    return value;
  }

  // For public keys, show partial
  return value.length > 20 ? `${value.slice(0, 20)}...` : value;
}
