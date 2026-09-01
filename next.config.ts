import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Blueprint uploads on /projects/submit (default is 1MB)
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  turbopack: {
    resolveAlias: {
      "@/*": "./*",
      "@lib/*": "./lib/*",
      "@components/*": "./components/*",
    },
  },
};

export default nextConfig;
