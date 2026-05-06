/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      // ── Security headers on all routes ────────────────────────────────────
      {
        source: '/:path*',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Disallow framing (clickjacking protection)
          { key: 'X-Frame-Options', value: 'DENY' },
          // HSTS — force HTTPS for 1 year once first seen over HTTPS
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Referrer — send origin only on same-origin; no path on cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser feature APIs the app doesn't need
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
      // ── Cache-Control: no-store on all API routes ─────────────────────────
      // Prevents sensitive API responses from being cached by browsers, CDNs,
      // or shared proxies. Individual routes can override if needed.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private' },
        ],
      },
    ];
  },
}

module.exports = nextConfig

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: "blue-oar-designs",
  project: "techrp",

  silent: !process.env.CI,

  widenClientFileUpload: true,

  tunnelRoute: "/monitoring",

  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
