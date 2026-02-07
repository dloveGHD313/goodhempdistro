import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  turbopack: {
    resolveAlias: {
      "@/*": "./*",
      "@lib/*": "./lib/*",
      "@components/*": "./components/*",
    },
  },
};

export default nextConfig;
