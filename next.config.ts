import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / binary packages must not be bundled by Turbopack or webpack.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "sharp", "heic-convert"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
