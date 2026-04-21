/**
 * `PWAUpdatePrompt` — silently registers the service worker and surfaces
 * a single "new version available" toast when `vite-plugin-pwa` reports
 * a fresh build is waiting.
 *
 * We use `vite-plugin-pwa/react`'s `useRegisterSW` hook (rather than the
 * vanilla `registerSW` helper) so the `needRefresh` boolean comes back
 * as React state we can render into a toast. The toast carries a Reload
 * action that calls `updateServiceWorker(true)`, which activates the
 * waiting worker and reloads the page atomically.
 *
 * `injectRegister: false` in `vite.config.js` ensures this is the only
 * place the SW is registered — no double registrations, no race with
 * an HTML-level `<script>` tag.
 *
 * SECURITY:
 *   - We register `/sw.js` (the path emitted by Workbox) with the
 *     default same-origin scope. Never widen the scope.
 *   - We never auto-reload without user consent — that would erase
 *     unsaved form state mid-edit.
 */

import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { toast } from '../ui/index.js';

export function PWAUpdatePrompt() {
  const toastIdRef = useRef(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      if (import.meta.env.DEV) {
        console.error('[pwa] service worker registration failed', error);
      }
    },
  });

  useEffect(() => {
    if (!needRefresh) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    if (toastIdRef.current) return;

    toastIdRef.current = toast.info(
      (t) => (
        <span className="flex items-center gap-3 text-sm">
          <span>A new version is available.</span>
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm"
            onClick={() => {
              toast.dismiss(t.id);
              toastIdRef.current = null;
              updateServiceWorker(true);
            }}
          >
            Reload
          </button>
          <button
            type="button"
            className="text-text-muted hover:text-text"
            onClick={() => {
              toast.dismiss(t.id);
              toastIdRef.current = null;
              setNeedRefresh(false);
            }}
            aria-label="Dismiss update notice"
          >
            ×
          </button>
        </span>
      ),
      { duration: Infinity },
    );
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

export default PWAUpdatePrompt;
