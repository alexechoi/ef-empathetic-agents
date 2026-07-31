import type { NextConfig } from "next";

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? "http://localhost:2024";

const nextConfig: NextConfig = {
  experimental: {
    // SSE streams from agent-service can sit quiet for a minute while the
    // planner's LLM calls run; don't let the rewrite proxy kill them.
    proxyTimeout: 600_000,
  },
  rewrites: async () => [
    {
      source: "/api/agent/:path*",
      destination: `${AGENT_SERVICE_URL}/:path*`,
    },
  ],
};

export default nextConfig;
