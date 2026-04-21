/**
 * Tiny localStorage façade for PWA install heuristics.
 *
 * The install prompt should never feel ambush-y, so we gate it on two
 * very lightweight signals stored client-side only:
 *
 *  - `visitCount` — incremented once per browser session (we de-dupe via
 *    `sessionStorage`). The prompt unlocks after the **second** visit.
 *  - `enrolledOnce` — flipped to `true` the first time a user successfully
 *    enrolls in any course. That moment is the highest-intent signal in
 *    the app, so the prompt unlocks immediately on enrollment as well.
 *
 *  - `installDismissedAt` — millisecond timestamp set when the user
 *    explicitly dismisses the banner. We suppress the prompt for the
 *    next 30 days afterwards so we don't nag.
 *
 * Everything is best-effort: storage may be unavailable in private mode
 * or quota-exceeded scenarios; in that case the helpers degrade to no-ops
 * and the install prompt simply never shows. UX still works.
 */

import { STORAGE_KEYS } from './constants.js';

const isBrowser = typeof window !== 'undefined';

const DISMISSAL_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const VISIT_THRESHOLD = 2;
const SESSION_VISIT_FLAG = 'lms.pwa.sessionCounted';

const safeRead = (key) => {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWrite = (key, value) => {
  if (!isBrowser) return;
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(value));
    }
  } catch {
    // Private mode / quota — silently ignore; the prompt just won't show.
  }
};

const safeReadSession = (key) => {
  if (!isBrowser) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWriteSession = (key, value) => {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    // Ignore.
  }
};

/**
 * Returns `true` when the page is rendered inside an installed PWA shell
 * (Android `display: standalone`, iOS `navigator.standalone`). We use it
 * to short-circuit the install prompt — there's nothing to install.
 */
export const isStandaloneDisplay = () => {
  if (!isBrowser) return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari exposes its own legacy flag.
  return Boolean(window.navigator.standalone);
};

export const getPwaVisitCount = () => {
  const raw = safeRead(STORAGE_KEYS.pwaVisitCount);
  const parsed = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Increment the visit counter at most once per browser session. Returns
 * the updated count so callers can react immediately.
 */
export const recordPwaVisit = () => {
  const current = getPwaVisitCount();
  if (safeReadSession(SESSION_VISIT_FLAG)) return current;
  const next = current + 1;
  safeWrite(STORAGE_KEYS.pwaVisitCount, next);
  safeWriteSession(SESSION_VISIT_FLAG, '1');
  return next;
};

export const hasEverEnrolled = () =>
  safeRead(STORAGE_KEYS.pwaEnrolledOnce) === '1';

/**
 * Flip the "ever enrolled" flag. Called from the course detail page once
 * an enrollment request resolves successfully.
 */
export const markPwaEnrollment = () => {
  if (hasEverEnrolled()) return;
  safeWrite(STORAGE_KEYS.pwaEnrolledOnce, '1');
};

const getInstallDismissedAt = () => {
  const raw = safeRead(STORAGE_KEYS.pwaInstallDismissedAt);
  const parsed = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isInstallDismissalActive = () => {
  const dismissedAt = getInstallDismissedAt();
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISSAL_COOLDOWN_MS;
};

export const dismissInstallPrompt = () => {
  safeWrite(STORAGE_KEYS.pwaInstallDismissedAt, Date.now());
};

/**
 * Combined gate used by `<InstallPrompt />`. We expose this as a helper
 * (rather than baking it into the component) so feature flags or A/B
 * tooling can override it later without touching the JSX.
 */
export const shouldOfferInstall = () => {
  if (!isBrowser) return false;
  if (isStandaloneDisplay()) return false;
  if (isInstallDismissalActive()) return false;
  return getPwaVisitCount() >= VISIT_THRESHOLD || hasEverEnrolled();
};

export const PWA_VISIT_THRESHOLD = VISIT_THRESHOLD;
