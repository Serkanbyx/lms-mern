/**
 * Security middleware bundle.
 *
 * Centralizes the production-grade hardening that wraps the API surface:
 *
 *   1. `securityHeaders`         — Helmet with an EXPLICIT Content-Security
 *                                  -Policy (no `unsafe-inline` for scripts,
 *                                  origins clamped to the assets we actually
 *                                  serve), HSTS preload, and frame-ancestors
 *                                  denial. Helmet's defaults are a starting
 *                                  point — this builder is the production
 *                                  baseline.
 *   2. `redirectToHttps`         — Honours Render's `X-Forwarded-Proto` and
 *                                  308-redirects plain HTTP requests to HTTPS
 *                                  in production. Active only when
 *                                  `NODE_ENV === 'production'` because local
 *                                  dev intentionally serves HTTP on :5000.
 *   3. `denyObsoleteMethods`     — Rejects `TRACE` and `TRACK` with 405. Both
 *                                  methods have NO legitimate use against this
 *                                  API and are abused for Cross-Site Tracing
 *                                  (XST) reflection attacks.
 *
 * Mount order in `index.js`:
 *   trust proxy  →  redirectToHttps  →  securityHeaders  →  denyObsoleteMethods
 * so the redirect happens before we waste cycles on header/CSP work for a
 * request that's about to bounce.
 */

import helmet from 'helmet';

import { env } from '../config/env.js';

const isProd = env.isProd;

/**
 * Helmet bundle with a production-tuned Content-Security-Policy.
 *
 * The CSP is tightened from helmet's defaults in three ways:
 *   - `script-src` no longer accepts `unsafe-inline` (default would).
 *   - `connect-src` is clamped to the same-origin API + the configured
 *     CLIENT_URL so a compromised script can't exfiltrate to arbitrary hosts.
 *   - `img-src` / `media-src` allow Cloudinary specifically (we never serve
 *     hot-linked third-party media from the API).
 *
 * `upgrade-insecure-requests` is emitted ONLY in production — leaving it
 * enabled on local dev breaks the dev http://localhost:5000 ↔ :5173 flow.
 */
export const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' for styles is unavoidable while we ship runtime
        // utility-class generators (Tailwind v4) and Helmet/Google fonts.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        mediaSrc: ["'self'", 'https://res.cloudinary.com'],
        // Google Fonts hosts must appear here (not just in `style-src` /
        // `font-src`) because the SPA's Service Worker revalidates them
        // via `fetch()` — and `fetch()` is governed by `connect-src`.
        connectSrc: [
          "'self'",
          env.CLIENT_URL,
          ...env.CORS_ORIGINS,
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        frameSrc: [
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://player.vimeo.com',
          'https://player.cloudinary.com',
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // 1 year, includeSubDomains, preload — the values required to qualify
    // for the browser HSTS preload list.
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    // The API does not need to be embeddable anywhere.
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Allow the SPA on a different origin to load JSON we return.
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Don't promise embedder isolation — would break some Cloudinary players.
    crossOriginEmbedderPolicy: false,
  }),
];

/**
 * Force every request onto HTTPS in production.
 *
 * Render terminates TLS at the load balancer; the request reaches our
 * process over HTTP with `X-Forwarded-Proto: https`. We trust that header
 * (because `app.set('trust proxy', 1)` is set in `index.js`) and only
 * redirect when the original protocol was actually HTTP.
 *
 * In dev the middleware is a no-op so `npm run dev` keeps working.
 */
export const redirectToHttps = (req, res, next) => {
  if (!isProd) return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  // 308 preserves the request method, so a redirected POST stays a POST.
  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
};

/**
 * Reject obsolete HTTP methods that have no legitimate API use.
 *
 * `TRACE` and `TRACK` reflect the request back unchanged — historically the
 * basis for Cross-Site Tracing (XST) attacks that bypass `HttpOnly` cookie
 * protections. We block them at the edge with a 405 + `Allow` header so any
 * future audit shows a clean response instead of 200/echo.
 */
const FORBIDDEN_METHODS = new Set(['TRACE', 'TRACK']);

export const denyObsoleteMethods = (req, res, next) => {
  if (FORBIDDEN_METHODS.has(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    return res.status(405).json({
      success: false,
      message: `HTTP method ${req.method} is not allowed.`,
    });
  }
  return next();
};

export default {
  securityHeaders,
  redirectToHttps,
  denyObsoleteMethods,
};
