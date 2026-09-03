import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / binary packages must not be bundled by Turbopack or webpack.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "sharp", "heic-convert"],
  // PDF routes read the logo, signature and fonts from /public at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./public/logo.png", "./public/signature.png", "./public/fonts/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
