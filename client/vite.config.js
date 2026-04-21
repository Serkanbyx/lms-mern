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
    VitePWA({
      registerType: 'autoUpdate',
      // The lucide-react icon barrel is re-exported as a single ~3 MB
      // bundle that Workbox (default 2 MiB precache cap) refuses to
      // pre-cache. We bump the limit so the SW serves it from the
      // network on first visit and caches it for repeat loads.
      workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
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
