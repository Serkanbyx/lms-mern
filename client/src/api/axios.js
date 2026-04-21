/**
 * Single source of HTTP truth for the LMS client.
 *
 * Every service module imports `api` from this file — no component should
 * ever call `fetch` or `axios` directly. Centralising HTTP here lets us
 * enforce three guarantees in exactly one place:
 *
 *   1. The Bearer token is attached to every request from `localStorage`
 *      (never read from cookies — the API does not set any).
 *   2. A 401 response means the token is invalid or expired: clear the
 *      token, remember where the user was trying to go, and bounce them
 *      to the login page exactly once (no redirect loop on `/login`).
 *   3. Errors are normalised to a small `{ status, message, code, details }`
 *      shape so callers always see the same surface, regardless of whether
 *      the failure was a network drop, a CORS block, a 4xx, or a 5xx.
 *
 * SECURITY:
 *   - The token lives in `localStorage` (`STORAGE_KEYS.token`). XSS-resistant
 *     storage (httpOnly cookies) is a server-side decision and is out of
 *     scope for this SPA build.
 *   - Raw error objects are NEVER logged in production — Axios serialises
 *     headers and request bodies which can leak the token.
 *   - `withCredentials: true` is set so future cookie-based auth (refresh
 *     tokens, CSRF) drops in without touching call sites.
 */

import axios from 'axios';

import { toast } from '../components/ui/toast.js';
import { HTTP_TIMEOUT_MS, ROUTES, STORAGE_KEYS } from '../utils/constants.js';

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.token);
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

/**
 * Debounce toast firings per error category so a burst of failed requests
 * (e.g. parallel dashboard fetches dying on the same offline blip) only
 * surfaces ONE toast — otherwise the user gets a stack of duplicates.
 */
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalised = normaliseError(error);
    const { status, code } = normalised;
    const silent = error?.config?.silent === true;

    // 401 — invalid / expired token. Redirect once, no toast (the login
    // screen explains itself).
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      !isRedirectingToLogin
    ) {
      const { pathname, search } = window.location;
      const isOnAuthScreen =
        pathname.startsWith(ROUTES.login) || pathname.startsWith(ROUTES.register);

      localStorage.removeItem(STORAGE_KEYS.token);

      if (!isOnAuthScreen) {
        isRedirectingToLogin = true;
        try {
          sessionStorage.setItem(STORAGE_KEYS.returnTo, `${pathname}${search}`);
        } catch {
          // Storage may be disabled (private mode) — degrade gracefully.
        }
        window.location.assign(ROUTES.login);
      }
      return Promise.reject(normalised);
    }

    if (silent) {
      return Promise.reject(normalised);
    }

    // Network failure (no response, CORS block, DNS, offline). Cancellations
    // are explicit user / cleanup actions — never surface them as errors.
    if (code !== 'CANCELLED' && (status === 0 || code === 'ERR_NETWORK')) {
      maybeToast('network', () =>
        toast.error('Network error — please check your connection.'),
      );
    }

    // Rate limited. The server SHOULD send a Retry-After header (seconds).
    if (status === 429) {
      const retryAfter = error?.response?.headers?.['retry-after'];
      maybeToast('rate-limit', () =>
        toast.error(
          `You're going too fast — please wait a moment.${formatRetryHint(retryAfter)}`,
        ),
      );
    }

    // Server-side failure. Surfaced as a single toast; the calling code is
    // still expected to render its own inline error UI for context.
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
