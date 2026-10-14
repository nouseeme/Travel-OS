import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  logging: {
    incomingRequests: false,
    serverFunctions: false,
    browserToTerminal: false,
  },
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
