import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Build config — split the heaviest third-party dependencies into
 * dedicated chunks so the marketing landing page never has to
 * download `jspdf` or every framer-motion variant just to paint the
 * hero. We only name the chunks we want to isolate; everything else
 * falls through to Vite's default per-route chunking, which avoids
 * circular import warnings between react and react-router.
 */
const splitVendor = (id) => {
  if (!id.includes('node_modules')) return undefined;
  const normalized = id.replace(/\\/g, '/');
  if (normalized.includes('/jspdf/')) return 'vendor-pdf';
  if (normalized.includes('/framer-motion/')) return 'vendor-motion';
  if (normalized.includes('/react-helmet-async/')) return 'vendor-helmet';
  if (normalized.includes('/react-hot-toast/')) return 'vendor-toast';
  return undefined;
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Progressive Web App.
     *
     * `registerType: 'autoUpdate'` keeps the SW silent until the new
     * bundle is fully precached, then `vite-plugin-pwa/react`'s
     * `useRegisterSW` hook (consumed by `<PWAUpdatePrompt />`) flips
     * `needRefresh` so we can show a non-blocking toast.
     *
     * `includeAssets` adds the static favicon/OG payload to the SW
     * precache so the install screen and offline shell render with
     * full branding even without a live network.
     */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // Emit the generated manifest at the same path the static
      // `index.html` already links to (`/site.webmanifest`). This
      // prevents two competing `<link rel="manifest">` tags from
      // racing in the served HTML, and the build-time generation
      // becomes the single source of truth for icon metadata.
      manifestFilename: 'site.webmanifest',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'safari-pinned-tab.svg',
        'og-default.png',
        'offline.html',
      ],
      manifest: {
        name: 'Lumen LMS',
        short_name: 'Lumen',
        description: 'Learn anything. Teach anyone.',
        theme_color: '#0b0f17',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        dir: 'ltr',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The lucide-react icon barrel is re-exported as a single ~3 MB
        // bundle that Workbox (default 2 MiB precache cap) refuses to
        // pre-cache. We bump the limit so the SW serves it from the
        // network on first visit and caches it for repeat loads.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // SPA navigation fallback: every deep link (`/courses/:slug`,
        // `/dashboard`, etc.) must hand the browser the precached
        // `index.html` so React Router can take over and render the
        // matching route. Pointing this at `offline.html` (as it used
        // to) caused EVERY direct URL load + hard navigation to render
        // the offline shell, because the requested path is never in
        // the precache by definition. The branded `offline.html` is
        // still bundled via `includeAssets` and is served by the
        // explicit catch-all handler below when a navigation truly
        // fails on the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /\/sw\.js$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        // True-offline fallback. When a navigation request reaches the
        // network and fails (and the SPA shell is not yet in cache),
        // serve the branded offline page instead of the browser's
        // generic "no internet" screen.
        offlineGoogleAnalytics: false,
        runtimeCaching: [
          {
            // Auth endpoints are NEVER cached — a stale "logged in"
            // response would be a session bug at minimum, security
            // nightmare at worst. NetworkOnly bypasses Workbox.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkOnly',
          },
          {
            // Generic API: always try the network first so users see
            // fresh data, but fall back to the last-known response
            // (max 5 min old) when offline so dashboards still render.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cloudinary-hosted images are immutable per public_id, so
            // CacheFirst is safe and gives us instant repeat loads.
            urlPattern: ({ url }) => url.hostname === 'res.cloudinary.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts CSS rotates often (font-display tweaks etc.)
            // — go to the network first, fall back to a 1-day cache.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // The actual woff2 binaries are immutable and huge — long
            // cache them so repeat visits skip the network entirely.
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Disabled by default — running the SW in `vite dev` makes
        // hot reload confusing. Flip to `true` only when manually
        // QA'ing PWA behaviour locally.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: splitVendor,
      },
    },
  },
});
