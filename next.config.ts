import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["spending-tracker.orca.localhost"],
};

export default nextConfig;
