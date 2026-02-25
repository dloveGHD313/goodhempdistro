import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      "@/*": "./*",
      "@lib/*": "./lib/*",
      "@components/*": "./components/*",
    },
  },
};

export default nextConfig;
