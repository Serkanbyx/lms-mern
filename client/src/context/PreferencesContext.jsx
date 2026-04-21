/**
 * PreferencesContext — drives global UI chrome (theme, type scale,
 * density, motion) and persists user choices.
 *
 * Source-of-truth strategy:
 *  - Authenticated users → mirror `user.preferences` (server-owned).
 *    Local edits are applied optimistically and a debounced
 *    `PATCH /users/me/preferences` call syncs them. On success we update
 *    the auth user record so future re-mounts hydrate the latest values.
 *  - Anonymous visitors → fall back to `localStorage` only. This lets
 *    them pick a theme on the marketing site before signing in, and the
 *    choice survives the round-trip into the dashboard.
 *
 * Side-effects (DOM):
 *  - `theme`           → toggles `.dark` on `<html>` (respecting
 *                        `prefers-color-scheme` when set to `system`).
 *  - `fontSize`        → sets `font-small` / `font-medium` / `font-large`
 *                        on `<html>`.
 *  - `contentDensity`  → sets `density-compact` / `density-comfortable`
 *                        / `density-spacious` on `<body>`.
 *  - `animations`      → toggles `.no-animations` on `<html>`.
 *
 * The matching CSS is declared in `src/index.css`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './AuthContext.jsx';
import * as userService from '../services/user.service.js';
import { STORAGE_KEYS } from '../utils/constants.js';

const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'system',
  fontSize: 'medium',
  contentDensity: 'comfortable',
  animations: true,
  language: 'en',
  privacy: { showEmail: false, showEnrolledCourses: true },
  notifications: { emailOnEnroll: true, emailOnQuizGraded: true },
  playback: { autoplayNext: false, defaultSpeed: 1 },
  // Onboarding additions: captured by the post-register
  // `OnboardingModal`. `interests` drives recommendation queries;
  // `onboardingCompletedAt` (set on finish OR skip) prevents the modal
  // from re-opening after a fresh login on a new device.
  interests: [],
  onboardingCompletedAt: null,
});

const FONT_SIZE_CLASSES = ['font-small', 'font-medium', 'font-large'];
const DENSITY_CLASSES = [
  'density-compact',
  'density-comfortable',
  'density-spacious',
];

const SYNC_DEBOUNCE_MS = 500;

const PreferencesContext = createContext(null);

const readStoredPreferences = () => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.preferences);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const writeStoredPreferences = (preferences) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify(preferences),
    );
  } catch {
    // Quota / private mode — keep in-memory state.
  }
};

const mergePreference = (prev, key, value) => {
  if (key.includes('.')) {
    const [group, field] = key.split('.');
    return {
      ...prev,
      [group]: { ...(prev[group] ?? {}), [field]: value },
    };
  }
  return { ...prev, [key]: value };
};

const buildPatchPayload = (key, value) => {
  if (!key.includes('.')) return { [key]: value };
  const [group, field] = key.split('.');
  return { [group]: { [field]: value } };
};

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', shouldBeDark);
};

const applyFontSize = (size) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove(...FONT_SIZE_CLASSES);
  root.classList.add(`font-${size}`);
};

const applyDensity = (density) => {
  if (typeof document === 'undefined') return;
  const { body } = document;
  if (!body) return;
  body.classList.remove(...DENSITY_CLASSES);
  body.classList.add(`density-${density}`);
};

const applyAnimations = (enabled) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('no-animations', !enabled);
};

export const PreferencesProvider = ({ children }) => {
  const { user, isAuthenticated, updateUser } = useAuth();

  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    ...readStoredPreferences(),
  }));

  // When the auth user lands (login / hydrate) prefer the server copy and overwrite local state.
  useEffect(() => {
    if (user?.preferences) {
      setPreferences((prev) => ({ ...prev, ...user.preferences }));
    }
  }, [user]);

  // Apply the four DOM side-effects whenever the relevant slice changes.
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    applyFontSize(preferences.fontSize);
  }, [preferences.fontSize]);

  useEffect(() => {
    applyDensity(preferences.contentDensity);
  }, [preferences.contentDensity]);

  useEffect(() => {
    applyAnimations(preferences.animations);
  }, [preferences.animations]);

  // Re-evaluate theme when the OS scheme changes and the user picked `system`.
  useEffect(() => {
    if (preferences.theme !== 'system') return undefined;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [preferences.theme]);

  // Anonymous visitors persist to localStorage; authed users sync to the server (debounced).
  const pendingPatchesRef = useRef({});
  const syncTimerRef = useRef(null);

  const flushPatches = useCallback(async () => {
    const patches = pendingPatchesRef.current;
    pendingPatchesRef.current = {};
    syncTimerRef.current = null;

    if (!isAuthenticated || Object.keys(patches).length === 0) return;

    try {
      const { user: nextUser } = await userService.updatePreferences(patches);
      if (nextUser) {
        updateUser({ preferences: nextUser.preferences ?? nextUser });
      }
    } catch {
      // Network / validation failure — the user already saw the optimistic
      // update; surfacing a toast here would spam on every keystroke.
      // Settings page handles error feedback at the form level.
    }
  }, [isAuthenticated, updateUser]);

  const queueSync = useCallback(
    (key, value) => {
      const payload = buildPatchPayload(key, value);
      // Deep-merge nested groups (privacy / notifications / playback) so two rapid edits coalesce correctly.
      pendingPatchesRef.current = Object.entries(payload).reduce(
        (acc, [group, val]) => {
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            acc[group] = { ...(acc[group] ?? {}), ...val };
          } else {
            acc[group] = val;
          }
          return acc;
        },
        { ...pendingPatchesRef.current },
      );

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(flushPatches, SYNC_DEBOUNCE_MS);
    },
    [flushPatches],
  );

  // Make sure pending edits are written if the tab is closed mid-debounce.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onUnload = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        flushPatches();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [flushPatches]);

  const updatePreference = useCallback(
    (key, value) => {
      setPreferences((prev) => {
        const next = mergePreference(prev, key, value);
        if (!isAuthenticated) {
          writeStoredPreferences(next);
        }
        return next;
      });
      if (isAuthenticated) {
        queueSync(key, value);
      }
    },
    [isAuthenticated, queueSync],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    if (!isAuthenticated) {
      writeStoredPreferences(DEFAULT_PREFERENCES);
    } else {
      pendingPatchesRef.current = { ...DEFAULT_PREFERENCES };
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(flushPatches, SYNC_DEBOUNCE_MS);
    }
  }, [isAuthenticated, flushPatches]);

  const value = useMemo(
    () => ({
      preferences,
      updatePreference,
      resetPreferences,
    }),
    [preferences, updatePreference, resetPreferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  }
  return ctx;
};

export { DEFAULT_PREFERENCES };
export default PreferencesContext;
