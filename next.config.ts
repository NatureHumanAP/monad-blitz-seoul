import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack root is this project (silences multi-lockfile warning).
    root: __dirname,
  },
  // Ignore test-only deps pulled indirectly from pino/thread-stream during bundling.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      tap: false,
      tape: false,
      desm: false,
      "fastbench": false,
      "pino-elasticsearch": false,
      "why-is-node-running": false,
    };
    return config;
  },
};

export default nextConfig;
