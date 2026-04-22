/**
 * Theme + font-size bootstrap + stale-deploy / legacy-SW kill switch.
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
 * Stale-deploy / legacy Service Worker recovery
 * ---------------------------------------------
 * The app used to ship a Workbox-generated Service Worker via
 * `vite-plugin-pwa`. It has been removed from the project, but visitors
 * who landed on a previous build still have an active SW + CacheStorage
 * entries that would happily keep serving the old precached shell on
 * top of every new deploy. Two complementary mechanisms below clean it
 * up exactly once per browser:
 *
 *  1. Bumped `BOOT_VERSION` triggers the explicit unregister + caches
 *     wipe + reload path for any visitor whose previous load saved an
 *     older boot tag in localStorage.
 *  2. As a belt-and-braces guard for visitors whose last load already
 *     wrote the current `BOOT_VERSION`, we *always* attempt to find
 *     and unregister leftover Service Workers in the background. No
 *     reload is forced — the next pageload is simply SW-free.
 */
(function () {
  var BOOT_VERSION = '2026.04.22.1';
  var STORAGE_KEY = 'lms.boot.version';
  var SESSION_RELOADED = 'lms.boot.reloaded';

  function unregisterServiceWorkers() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return Promise.resolve();
    }
    return navigator.serviceWorker
      .getRegistrations()
      .then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      })
      .catch(function () {});
  }

  function clearAllCaches() {
    if (typeof caches === 'undefined' || !caches.keys) return Promise.resolve();
    return caches
      .keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .catch(function () {});
  }

  try {
    var previous = localStorage.getItem(STORAGE_KEY);
    var alreadyReloaded = sessionStorage.getItem(SESSION_RELOADED) === '1';

    if (previous && previous !== BOOT_VERSION && !alreadyReloaded) {
      sessionStorage.setItem(SESSION_RELOADED, '1');
      localStorage.setItem(STORAGE_KEY, BOOT_VERSION);

      Promise.all([unregisterServiceWorkers(), clearAllCaches()]).then(function () {
        location.reload();
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY, BOOT_VERSION);
    sessionStorage.removeItem(SESSION_RELOADED);

    // Belt-and-braces: PWA was removed. Even when the boot version is
    // already current, any orphaned SW from an older session must go.
    // No reload here — the next pageload will be SW-free.
    unregisterServiceWorkers();
  } catch (_) {
    // localStorage / sessionStorage may be unavailable in private mode
    // or with strict cookie blocking — degrade silently.
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
