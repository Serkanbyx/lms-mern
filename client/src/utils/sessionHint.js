/**
 * Session-hint storage helpers.
 *
 * The "session hint" is a non-sensitive ISO timestamp written to
 * `localStorage` whenever auth succeeds (login, register, silent
 * refresh) and cleared on logout / refresh failure.
 *
 * It exists so `AuthContext` can decide — BEFORE making any network
 * request — whether a `/auth/refresh` probe is worth attempting on
 * cold boot. Without the hint an anonymous landing-page visitor would
 * always see a `401 (Unauthorized)` line in DevTools (the browser
 * logs every HTTP error in red regardless of axios `silent: true`),
 * plus we'd waste one round-trip on every guest pageview.
 *
 * Trade-off: a user who clears localStorage but still holds a valid
 * refresh cookie will appear logged out until they sign in again —
 * strictly better than spamming every visitor with a 401.
 *
 * Lives here (not inside AuthContext) so the axios interceptor can
 * also keep the hint in sync — when a silent refresh fails after a
 * 401, the interceptor clears the hint so future cold boots stay
 * quiet until a real login renews it.
 */

import { SESSION_HINT_TTL_MS, STORAGE_KEYS } from './constants.js';

export const hasFreshSessionHint = () => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sessionHint);
    if (!raw) return false;
    const expiresAt = Date.parse(raw);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
};

export const writeSessionHint = () => {
  if (typeof window === 'undefined') return;
  try {
    const expiresAt = new Date(Date.now() + SESSION_HINT_TTL_MS).toISOString();
    window.localStorage.setItem(STORAGE_KEYS.sessionHint, expiresAt);
  } catch {
    /* noop — private mode / disabled storage */
  }
};

export const clearSessionHint = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.sessionHint);
  } catch {
    /* noop */
  }
};
