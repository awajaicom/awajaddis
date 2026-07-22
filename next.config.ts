import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // If you mount this app inside your existing Next.js app under a base path,
  // uncomment and adjust:
  // basePath: "/outreach",
  serverExternalPackages: ["node-appwrite"],
};

export default nextConfig;
