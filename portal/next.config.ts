import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  output: "standalone", // Required for Docker deployment
  serverExternalPackages: [
    "applicationinsights",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "tough-cookie",
  ],
};

export default nextConfig;
