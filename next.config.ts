import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@/*": "./*",
      "@lib/*": "./lib/*",
      "@components/*": "./components/*",
    },
  },
};

export default nextConfig;
