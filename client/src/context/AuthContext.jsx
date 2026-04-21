/**
 * AuthContext — single source of truth for the current user / session.
 *
 * Responsibilities:
 *  - Hydrate the session on mount: if `localStorage` has a token we call
 *    `GET /auth/me` to confirm it is still valid and load the user record.
 *    On a 401 we attempt one silent refresh (handled inside the axios
 *    interceptor) before giving up and clearing the token.
 *  - Expose imperative session methods (`login`, `register`, `logout`,
 *    `logoutAll`, `updateUser`) plus three role booleans (`isStudent`,
 *    `isInstructor`, `isAdmin`) for guards and conditional UI.
 *  - Persist the access token via `STORAGE_KEYS.token` so the axios
 *    request interceptor can attach the `Authorization` header on every
 *    call without re-reading React state. The longer-lived refresh token
 *    is stored by the server in an HttpOnly cookie and never touches JS.
 *
 * Design notes:
 *  - All state mutations live inside this provider; consumers receive a
 *    stable, memoised value and never set state directly.
 *  - `logout` calls `POST /auth/logout` (best-effort; the cookie is
 *    cleared regardless) and `logoutAll` bumps `tokenVersion` server-
 *    side so every other device loses its session immediately.
 *  - Navigation after logout uses `window.location` instead of a router
 *    hook because this context is mounted above the router and must work
 *    even when called from a 401 handler far below it.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as authService from '../services/auth.service.js';
import { ROLES, ROUTES, STORAGE_KEYS } from '../utils/constants.js';
import {
  clearSessionHint,
  hasFreshSessionHint,
  writeSessionHint,
} from '../utils/sessionHint.js';

const AuthContext = createContext(null);

const readStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
};

const writeStoredToken = (token) => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEYS.token, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.token);
    }
  } catch {
    // Private mode / disabled storage — tolerate silently; in-memory state still works for the session.
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(null);
  // Stay in `loading` while either path will issue a network call:
  // an existing access token (→ /auth/me) or a non-expired session
  // hint (→ silent /auth/refresh). Otherwise mount as resolved-guest
  // so public pages render immediately with no spinner flash.
  const [loading, setLoading] = useState(
    () => Boolean(readStoredToken()) || hasFreshSessionHint(),
  );

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!token) {
        // We only attempt a speculative refresh when a session-hint
        // says a refresh cookie *probably* still exists. Without that
        // marker an anonymous landing-page visitor would always see a
        // 401 in the console (the browser logs HTTP errors regardless
        // of axios `silent`). See `hasFreshSessionHint` for the full
        // rationale + trade-offs.
        if (!hasFreshSessionHint()) {
          if (!cancelled) setLoading(false);
          return;
        }

        try {
          const { token: refreshed, user: me } = await authService.refreshAccessToken();
          if (!cancelled && refreshed && me) {
            writeStoredToken(refreshed);
            writeSessionHint();
            setToken(refreshed);
            setUser(me);
          }
        } catch {
          // Hint was stale (e.g. server invalidated the cookie or the
          // user logged out from another tab). Drop it so future cold
          // boots stay quiet until the next real login.
          clearSessionHint();
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        const { user: me } = await authService.getMe();
        if (!cancelled) setUser(me ?? null);
      } catch {
        if (!cancelled) {
          writeStoredToken(null);
          clearSessionHint();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
    // Hydration runs once per mount; token mutations after login/logout already update state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSession = useCallback((nextToken, nextUser) => {
    writeStoredToken(nextToken);
    if (nextToken && nextUser) {
      writeSessionHint();
    } else {
      clearSessionHint();
    }
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { token: nextToken, user: nextUser } = await authService.login({
        email,
        password,
      });
      persistSession(nextToken, nextUser);
      return nextUser;
    },
    [persistSession],
  );

  const register = useCallback(
    async (name, email, password) => {
      const { token: nextToken, user: nextUser } = await authService.register({
        name,
        email,
        password,
      });
      persistSession(nextToken, nextUser);
      return nextUser;
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    // Best-effort server hit so the refresh cookie is cleared. Failure
    // here MUST NOT block the local-state cleanup below — even if the
    // network is dead the user expects to be logged out.
    try {
      await authService.logout();
    } catch {
      /* noop */
    }
    persistSession(null, null);
    if (typeof window !== 'undefined') {
      window.location.assign(ROUTES.login);
    }
  }, [persistSession]);

  const logoutAll = useCallback(async () => {
    // Server bumps `tokenVersion` (kicking every other device off) and
    // issues us a fresh access + refresh pair so the calling tab stays
    // signed in. We swap the local session over to the new credentials.
    const { token: nextToken, user: nextUser } = await authService.logoutAll();
    if (nextToken && nextUser) {
      persistSession(nextToken, nextUser);
    }
  }, [persistSession]);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (typeof partial === 'function') return { ...prev, ...partial(prev) };
      return { ...prev, ...partial };
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await authService.getMe();
      setUser(me ?? null);
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      isEmailVerified: Boolean(user?.isEmailVerified),
      isStudent: user?.role === ROLES.student,
      isInstructor: user?.role === ROLES.instructor,
      isAdmin: user?.role === ROLES.admin,
      login,
      register,
      logout,
      logoutAll,
      updateUser,
      refreshUser,
    }),
    [user, token, loading, login, register, logout, logoutAll, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
