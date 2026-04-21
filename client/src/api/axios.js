/**
 * Single source of HTTP truth for the LMS client.
 *
 * Every service module imports `api` from this file — no component should
 * ever call `fetch` or `axios` directly. Centralising HTTP here lets us
 * enforce four guarantees in exactly one place:
 *
 *   1. The Bearer token is attached to every request from `localStorage`.
 *   2. A 401 with code `TOKEN_EXPIRED` triggers a SILENT refresh against
 *      `/auth/refresh` (HttpOnly cookie auth) and the original request is
 *      retried once with the new access token. Concurrent 401s share a
 *      single in-flight refresh promise so a burst of failed requests
 *      (e.g. dashboard fan-out) only fires ONE refresh round-trip.
 *   3. Any other 401 (or a refresh failure) clears the token, remembers
 *      where the user was trying to go, and bounces them to the login
 *      page exactly once (no redirect loop on `/login`).
 *   4. Errors are normalised to a small `{ status, message, code, details }`
 *      shape so callers always see the same surface, regardless of whether
 *      the failure was a network drop, a CORS block, a 4xx, or a 5xx.
 *
 * SECURITY:
 *   - The access token lives in `localStorage` (`STORAGE_KEYS.token`).
 *     The longer-lived refresh token is in an HttpOnly cookie and is
 *     never readable from JS — that's where the XSS-resistant credential
 *     lives, even though access tokens technically aren't.
 *   - `withCredentials: true` is required so the refresh cookie travels
 *     to `/auth/refresh` for every silent retry.
 *   - Raw error objects are NEVER logged in production — Axios serialises
 *     headers and request bodies which can leak the token.
 *   - Pass `silent: true` on a request config to opt out of the global
 *     toast / refresh / redirect chain (used by `auth.service.refresh`
 *     itself to avoid an infinite loop).
 */

import axios from 'axios';

import { toast } from '../components/ui/toast.js';
import { HTTP_TIMEOUT_MS, ROUTES, STORAGE_KEYS } from '../utils/constants.js';
import { clearSessionHint, writeSessionHint } from '../utils/sessionHint.js';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL && import.meta.env.DEV) {
  console.warn(
    '[api] VITE_API_BASE_URL is not set — copy client/.env.example to client/.env',
  );
}

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: HTTP_TIMEOUT_MS,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

const readToken = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
};

const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.token, token);
    else localStorage.removeItem(STORAGE_KEYS.token);
  } catch {
    // Storage may be disabled (private mode) — degrade gracefully.
  }
};

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Normalise any axios failure to `{ status, message, code, details, isNetwork }`.
 * Components / hooks can rely on a stable error surface.
 */
const normaliseError = (err) => {
  if (axios.isCancel(err)) {
    return { status: 0, message: 'Request cancelled.', code: 'CANCELLED', isNetwork: false };
  }

  const status = err.response?.status ?? 0;
  const data = err.response?.data;

  return {
    status,
    code: data?.code || err.code || 'UNKNOWN',
    message:
      data?.message ||
      data?.error ||
      err.message ||
      'Something went wrong. Please try again.',
    details: data?.details ?? data?.errors ?? null,
    isNetwork: status === 0,
  };
};

let isRedirectingToLogin = false;

const TOAST_THROTTLE_MS = 4000;
const lastToastAt = new Map();

const maybeToast = (category, fn) => {
  const now = Date.now();
  const previous = lastToastAt.get(category) ?? 0;
  if (now - previous < TOAST_THROTTLE_MS) return;
  lastToastAt.set(category, now);
  try {
    fn();
  } catch {
    // Toast lib failures must never re-enter the interceptor.
  }
};

const formatRetryHint = (retryAfter) => {
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return ` Try again in ${Math.ceil(seconds)}s.`;
  return ` Try again in about ${Math.ceil(seconds / 60)} min.`;
};

// --- Refresh-token coordination -----------------------------------------
//
// When several requests all 401 with `TOKEN_EXPIRED` at the same time
// (typical on a dashboard fan-out) we want exactly ONE refresh request,
// shared across every retry. `pendingRefresh` is null when no refresh is
// in flight, otherwise it's the promise that resolves to the new access
// token (or rejects so each waiter can give up cleanly).

let pendingRefresh = null;

const performRefresh = async () => {
  // Lazy import avoids a circular dependency between api/axios and
  // services/auth.service.
  const { refreshAccessToken } = await import('../services/auth.service.js');
  try {
    const { token: newToken } = await refreshAccessToken();
    if (!newToken) throw new Error('Refresh did not return a token.');
    writeToken(newToken);
    // Cookie was rotated server-side — extend our local hint so future
    // cold boots know the session is still alive.
    writeSessionHint();
    return newToken;
  } catch (err) {
    // Refresh failed → cookie is gone or invalid. Drop the hint so the
    // next AuthContext cold boot doesn't speculatively retry and log
    // another 401 in the console.
    clearSessionHint();
    throw err;
  }
};

const refreshOnce = () => {
  if (!pendingRefresh) {
    pendingRefresh = performRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
};

const redirectToLogin = () => {
  if (typeof window === 'undefined' || isRedirectingToLogin) return;
  const { pathname, search } = window.location;
  const isOnAuthScreen =
    pathname.startsWith(ROUTES.login) || pathname.startsWith(ROUTES.register);

  writeToken(null);
  clearSessionHint();

  if (!isOnAuthScreen) {
    isRedirectingToLogin = true;
    try {
      sessionStorage.setItem(STORAGE_KEYS.returnTo, `${pathname}${search}`);
    } catch {
      // Storage may be disabled (private mode) — degrade gracefully.
    }
    window.location.assign(ROUTES.login);
  }
};

const REFRESHABLE_CODES = new Set(['TOKEN_EXPIRED']);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const normalised = normaliseError(error);
    const { status, code } = normalised;
    const config = error?.config || {};
    const silent = config.silent === true;

    // ---- 401 — try a silent refresh exactly once -----------------------
    if (status === 401) {
      const isAuthEndpoint =
        typeof config.url === 'string' &&
        (config.url.includes('/auth/refresh') ||
          config.url.includes('/auth/login') ||
          config.url.includes('/auth/register'));

      const canRefresh =
        !silent &&
        !isAuthEndpoint &&
        !config._retried &&
        REFRESHABLE_CODES.has(code);

      if (canRefresh) {
        try {
          const newToken = await refreshOnce();
          config._retried = true;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(config);
        } catch {
          // fall through to the redirect-to-login path below.
        }
      }

      if (!silent) redirectToLogin();
      return Promise.reject(normalised);
    }

    if (silent) {
      return Promise.reject(normalised);
    }

    // ---- Network failure (no response, CORS, DNS, offline) -------------
    if (code !== 'CANCELLED' && (status === 0 || code === 'ERR_NETWORK')) {
      maybeToast('network', () =>
        toast.error('Network error — please check your connection.'),
      );
    }

    // ---- Rate limited --------------------------------------------------
    if (status === 429) {
      const retryAfter = error?.response?.headers?.['retry-after'];
      maybeToast('rate-limit', () =>
        toast.error(
          `You're going too fast — please wait a moment.${formatRetryHint(retryAfter)}`,
        ),
      );
    }

    // ---- Server-side failure -------------------------------------------
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      maybeToast('server', () =>
        toast.error('Server error — please try again in a moment.'),
      );
      if (import.meta.env.DEV) {
        console.error(
          '[api] server error',
          status,
          error?.config?.method?.toUpperCase(),
          error?.config?.url,
        );
      }
    }

    return Promise.reject(normalised);
  },
);

export default api;
