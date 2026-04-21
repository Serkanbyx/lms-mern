/**
 * Theme + font-size bootstrap + stale-deploy kill switch.
 *
 * Runs synchronously in <head> BEFORE React mounts so the document
 * paints in the correct theme (no FOUC / dark-mode flash) and at the
 * correct font scale on first frame.
 *
 * Kept as a separate file (instead of an inline <script>) so the SPA's
 * Content-Security-Policy can stay at a strict `script-src 'self'`
 * without having to maintain a SHA-256 hash for an inline block — any
 * whitespace edit to that block would otherwise break CSP and ship a
 * broken login screen.
 *
 * Source of truth for the theme + font-size values at runtime lives in
 * `src/context/PreferencesContext.jsx`; keep both in sync.
 *
 * Stale-deploy recovery
 * ---------------------
 * `vite-plugin-pwa` already cleans up outdated precaches via
 * `cleanupOutdatedCaches`, but a user whose service worker was
 * registered against a *very* old build can still get served a stale
 * `index.html` with an obsolete CSP (e.g. an `your-api.onrender.com`
 * placeholder that we long since replaced). When that happens every
 * API call is blocked and the app looks broken on first paint.
 *
 * The bump-the-version block below detects a hard mismatch between the
 * version baked into THIS file and whatever version the previous load
 * persisted in localStorage. On mismatch we unregister every service
 * worker and delete every CacheStorage entry, then reload once. The
 * reload is gated by a session marker so we never enter an infinite
 * reload loop if something else is broken.
 */
(function () {
  var BOOT_VERSION = '2026.04.21.2';
  var STORAGE_KEY = 'lms.boot.version';
  var SESSION_RELOADED = 'lms.boot.reloaded';

  try {
    var previous = localStorage.getItem(STORAGE_KEY);
    var alreadyReloaded = sessionStorage.getItem(SESSION_RELOADED) === '1';

    if (previous && previous !== BOOT_VERSION && !alreadyReloaded) {
      sessionStorage.setItem(SESSION_RELOADED, '1');
      localStorage.setItem(STORAGE_KEY, BOOT_VERSION);

      var unregister = navigator.serviceWorker
        ? navigator.serviceWorker
            .getRegistrations()
            .then(function (regs) {
              return Promise.all(regs.map(function (r) { return r.unregister(); }));
            })
            .catch(function () {})
        : Promise.resolve();

      var clearCaches = (typeof caches !== 'undefined' && caches.keys)
        ? caches
            .keys()
            .then(function (keys) {
              return Promise.all(keys.map(function (k) { return caches.delete(k); }));
            })
            .catch(function () {})
        : Promise.resolve();

      Promise.all([unregister, clearCaches]).then(function () {
        location.reload();
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY, BOOT_VERSION);
    sessionStorage.removeItem(SESSION_RELOADED);
  } catch (_) {
    // localStorage / sessionStorage may be unavailable in private mode
    // or with strict cookie blocking — degrade silently, the SW's own
    // `cleanupOutdatedCaches` will still take care of most cases.
  }

  var theme = localStorage.getItem('theme') || 'system';
  var prefersDark =
    theme === 'dark' ||
    (theme === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches);
  if (prefersDark) document.documentElement.classList.add('dark');

  var fontSize = localStorage.getItem('fontSize') || 'medium';
  document.documentElement.classList.add('font-' + fontSize);
})();
