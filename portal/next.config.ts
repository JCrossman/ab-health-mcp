import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "applicationinsights",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "tough-cookie",
  ],
};

export default nextConfig;
