import type { NextConfig } from "next";

const apiInternal = (process.env.API_INTERNAL_URL || "http://localhost:3101").replace(/\/+$/, "");

// `upgrade-insecure-requests` rewrites every HTTP subresource to HTTPS. That
// breaks CSS, JS and images when the console is opened directly over HTTP
// (for example http://<server-ip>:3102). Opt in only when TLS is enabled.
const upgradeInsecureRequests =
  process.env.CSP_UPGRADE_INSECURE_REQUESTS === "1" ? ["upgrade-insecure-requests"] : [];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "connect-src 'self' https:",
  "frame-src 'none'",
  ...upgradeInsecureRequests,
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const appliedSecurityHeaders =
  process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }, ...securityHeaders]
    : securityHeaders;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  async rewrites() {
    return [
      // Local development and previews use the admin origin for API calls.
      // In production Nginx proxies /api and /uploads before Next.js.
      { source: "/api/:path*", destination: `${apiInternal}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiInternal}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: appliedSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
