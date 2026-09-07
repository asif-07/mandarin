import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / binary packages must not be bundled by Turbopack or webpack.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "sharp", "heic-convert"],
  // PDF routes read the logo, signature and fonts from /public at runtime.
  // sharp loads its platform binary via a dynamic require that the file tracer
  // cannot follow, so its @img/* packages must be included explicitly or the
  // deployed function fails with "Could not load the sharp module".
  outputFileTracingIncludes: {
    "/api/**": [
      "./public/logo.png",
      "./public/signature.png",
      "./public/fonts/**",
      "./node_modules/sharp/**",
      "./node_modules/@img/**",
      // Chromium binary (brotli-compressed) for Puppeteer on Vercel.
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Re-use a page's server payload for 30s when navigating back to it, so
    // back/forward and repeated tab switches are instant. Mutations call
    // router.refresh(), which bypasses this cache.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
