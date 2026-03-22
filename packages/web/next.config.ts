import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Monorepo: load root .env so NEXT_PUBLIC_* vars are available at build time.
// Next.js only reads .env from its own project root (packages/web/),
// so we must load the monorepo root .env explicitly.
const rootEnvPath = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq);
    const val = t.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const coreUrl = process.env.NEXT_PUBLIC_CORE_URL || "http://localhost:3457";
    return {
      // beforeFiles ensures rewrites run BEFORE Next.js filesystem route handlers,
      // preventing any accidental route handler from intercepting API/SSE traffic.
      beforeFiles: [
        { source: "/api/:path*", destination: `${coreUrl}/api/:path*` },
        { source: "/events", destination: `${coreUrl}/events` },
        { source: "/preview/:path*", destination: `${coreUrl}/preview/:path*` },
        { source: "/share/:path*", destination: `${coreUrl}/share/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
