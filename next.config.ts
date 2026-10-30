// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Next.js config: next-intl plugin, security headers and CSP.
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Baseline security headers.
 *
 * script-src keeps `'unsafe-inline'` in production: the App Router ships its RSC flight data as
 * inline `self.__next_f.push(...)` scripts, and `'self'` alone blocks them, so the page never
 * hydrates. `'unsafe-eval'` stays dev-only (HMR / React Refresh).
 */
const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  // Speech answers play from a blob: WAV.
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  // The WebGPU weights come same-origin from /api/models/webgpu (served from local disk).
  "connect-src 'self'",
  "worker-src 'self' blob:",
  // 'wasm-unsafe-eval': onnxruntime-web compiles its WebAssembly core even on the WebGPU EP.
  isProd
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

const securityHeaders: ReadonlyArray<readonly [name: string, content: string]> = [
  ['Content-Security-Policy', csp],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  // The voice assistant needs the microphone (getUserMedia) on this origin only.
  ['Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()'],
  // includeSubDomains / preload bind the parent domain too: opt-in only (docs/CONFIGURATION.md).
  ['Strict-Transport-Security', 'max-age=63072000'],
];

/**
 * - reactCompiler: needs babel-plugin-react-compiler (a dev dependency).
 * - typedRoutes: typed Link hrefs / router.push.
 * No `runtime = 'edge'` anywhere; proxy.ts is Node-only.
 */
const config: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  typedRoutes: true,
  // Dev only: Next serves /_next dev assets + HMR to `localhost` alone; allow the loopback IP too.
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders.map(([name, content]) => ({ key: name, value: content })),
      },
    ];
  },
};

export default withNextIntl(config);
