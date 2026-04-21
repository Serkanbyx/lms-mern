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
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as authService from '../services/auth.service.js';
import { ROLES, ROUTES, STORAGE_KEYS } from '../utils/constants.js';

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
  const [loading, setLoading] = useState(Boolean(readStoredToken()));

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!token) {
        // Even with no access token we may still have a valid refresh
        // cookie from a previous session. Try ONE silent refresh before
        // we treat the visitor as a logged-out guest — that's what makes
        // a browser refresh on a protected page survive.
        try {
          const { token: refreshed, user: me } = await authService.refreshAccessToken();
          if (!cancelled && refreshed && me) {
            writeStoredToken(refreshed);
            setToken(refreshed);
            setUser(me);
          }
        } catch {
          // No valid session at all — anonymous visitor.
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
};

export default AuthContext;
