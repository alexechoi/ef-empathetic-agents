import type { NextConfig } from "next";

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? "http://localhost:2024";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/api/agent/:path*",
      destination: `${AGENT_SERVICE_URL}/:path*`,
    },
  ],
};

export default nextConfig;
