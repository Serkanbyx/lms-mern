/**
 * Theme + font-size bootstrap.
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
 * Source of truth for the same values at runtime lives in
 * `src/context/PreferencesContext.jsx`; keep both in sync.
 */
(function () {
  var theme = localStorage.getItem('theme') || 'system';
  var prefersDark =
    theme === 'dark' ||
    (theme === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches);
  if (prefersDark) document.documentElement.classList.add('dark');

  var fontSize = localStorage.getItem('fontSize') || 'medium';
  document.documentElement.classList.add('font-' + fontSize);
})();
