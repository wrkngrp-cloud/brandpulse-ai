import path from "path";
import type { NextConfig } from "next";

// Content Security Policy.
//
// Scoped to what the app actually loads. Fonts and the icon sprite are
// self-hosted, so no font or style CDN is needed. Mapbox is the only third
// party that reaches the browser: it pulls tiles and its CSP worker build from
// api.mapbox.com and posts telemetry to events.mapbox.com. Supabase covers
// Postgres, Auth and Storage over https, plus Realtime over a websocket.
//
// One deliberate looseness. script-src keeps 'unsafe-inline' because Next.js
// App Router emits inline hydration scripts, and the alternative is a
// per-request nonce set from middleware, which forces every static page to
// render dynamically. That is a real trade and it should be made on purpose,
// not slipped in here. So this policy blocks script from any origin other than
// our own, which stops an injected <script src> cold, but it will not stop
// injected inline script. Escaping at the point of output remains the actual
// defence against that, which is why the AI report exporter escapes its input.
//
// img-src allows any https origin on purpose: the product renders competitor
// creative, OOH site photographs, press thumbnails and brand logos from
// wherever the brand hosts them, and an allowlist there would break real pages.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
  "worker-src 'self' blob: https://api.mapbox.com",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS = [
  // Two years, subdomains included, and preload-eligible. Vercel terminates TLS
  // for every deployment, so there is no plain-http origin this can lock out.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy',   value: CSP },
  // No part of the product is meant to be embedded, including the client
  // portal, which is opened directly rather than framed.
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Nothing needs a camera or a microphone. Geolocation stays available because
  // the OOH site form uses it to drop a pin at the surveyor's position.
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Stop announcing the framework and its presence to anyone scanning.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
