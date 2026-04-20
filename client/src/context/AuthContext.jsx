/**
 * AuthContext — single source of truth for the current user / session.
 *
 * Responsibilities:
 *  - Hydrate the session on mount: if `localStorage` has a token we call
 *    `GET /auth/me` to confirm it is still valid and load the user record.
 *    A failure clears the token silently (the axios interceptor will
 *    redirect to `/login` for protected routes).
 *  - Expose imperative session methods (`login`, `register`, `logout`,
 *    `updateUser`) plus three role booleans (`isStudent`, `isInstructor`,
 *    `isAdmin`) for guards and conditional UI.
 *  - Persist the token via `STORAGE_KEYS.token` so the axios request
 *    interceptor (see `api/axios.js`) can attach the `Authorization`
 *    header on every call without re-reading React state.
 *
 * Design notes:
 *  - All state mutations live inside this provider; consumers receive a
 *    stable, memoised value and never set state directly.
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
        setLoading(false);
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

  const logout = useCallback(() => {
    persistSession(null, null);
    if (typeof window !== 'undefined') {
      window.location.assign(ROUTES.login);
    }
  }, [persistSession]);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      if (typeof partial === 'function') return { ...prev, ...partial(prev) };
      return { ...prev, ...partial };
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      isStudent: user?.role === ROLES.student,
      isInstructor: user?.role === ROLES.instructor,
      isAdmin: user?.role === ROLES.admin,
      login,
      register,
      logout,
      updateUser,
    }),
    [user, token, loading, login, register, logout, updateUser],
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
