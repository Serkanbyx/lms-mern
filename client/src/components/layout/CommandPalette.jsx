/**
 * `CommandPalette` — global ⌘K (Ctrl+K on Windows/Linux) entry point.
 *
 * The actual `<CommandMenu>` (Modal + filtering UI + keyboard list) is
 * pulled in via `React.lazy`, so its bytes only ship when a user
 * actually presses the shortcut for the first time. The lightweight
 * keyboard listener mounted here costs essentially nothing.
 *
 * Items are derived from the current auth state so visitors see "Log
 * in / Sign up" while authenticated users see Dashboard, Settings, and
 * (for admins) the admin console — no item ever points to a route the
 * user wouldn't be allowed to land on.
 *
 * Mounted once inside `MainLayout` (the only chrome that hosts the
 * navbar search) so the palette is reachable from every public and
 * authenticated page.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth.js';
import { usePreferences } from '../../context/usePreferences.js';
import { ROUTES } from '../../utils/constants.js';

const CommandMenu = lazy(() =>
  import('../ui/CommandMenu.jsx').then((m) => ({ default: m.CommandMenu })),
);

const isEditableTarget = (target) =>
  target?.tagName === 'INPUT' ||
  target?.tagName === 'TEXTAREA' ||
  target?.tagName === 'SELECT' ||
  target?.isContentEditable;

export function CommandPalette() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isInstructor, isAdmin, logout } = useAuth();
  const { preferences, updatePreference } = usePreferences();
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      // ⌘K on macOS, Ctrl+K elsewhere — never hijack typing.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setHasOpenedOnce(true);
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const cycleTheme = useCallback(() => {
    const cycle = ['light', 'dark', 'system'];
    const current = preferences.theme ?? 'system';
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    updatePreference('theme', next);
  }, [preferences.theme, updatePreference]);

  const items = useMemo(() => {
    const list = [
      {
        id: 'go-home',
        label: 'Go to home',
        icon: 'Home',
        group: 'Navigate',
        keywords: ['landing'],
        onSelect: () => navigate(ROUTES.home),
      },
      {
        id: 'go-catalog',
        label: 'Browse courses',
        icon: 'BookOpen',
        group: 'Navigate',
        keywords: ['catalog', 'search'],
        onSelect: () => navigate(ROUTES.catalog),
      },
      {
        id: 'go-teach',
        label: 'For instructors',
        icon: 'GraduationCap',
        group: 'Navigate',
        keywords: ['teach', 'become'],
        onSelect: () => navigate(ROUTES.teach),
      },
    ];

    if (isAuthenticated) {
      list.push(
        {
          id: 'go-dashboard',
          label: 'My learning',
          icon: 'LayoutDashboard',
          group: 'Navigate',
          keywords: ['dashboard', 'enrollments'],
          onSelect: () => navigate(ROUTES.dashboard),
        },
        {
          id: 'go-profile',
          label: 'My profile',
          icon: 'User',
          group: 'Navigate',
          onSelect: () => navigate(ROUTES.profile(user?._id ?? user?.id ?? '')),
        },
      );
    }

    if (isInstructor || isAdmin) {
      list.push({
        id: 'go-instructor',
        label: 'Instructor console',
        icon: 'PenSquare',
        group: 'Navigate',
        onSelect: () => navigate(ROUTES.instructor),
      });
    }

    if (isAdmin) {
      list.push({
        id: 'go-admin',
        label: 'Admin console',
        icon: 'ShieldCheck',
        group: 'Navigate',
        onSelect: () => navigate(ROUTES.admin),
      });
    }

    list.push(
      {
        id: 'theme-cycle',
        label: 'Toggle theme',
        icon: 'Palette',
        group: 'Preferences',
        hint: preferences.theme ?? 'system',
        keywords: ['dark', 'light', 'mode'],
        onSelect: cycleTheme,
      },
      {
        id: 'go-settings',
        label: 'Open settings',
        icon: 'Settings',
        group: 'Preferences',
        hint: '⌘,',
        onSelect: () =>
          navigate(isAuthenticated ? ROUTES.settings : ROUTES.login),
      },
    );

    if (isAuthenticated) {
      list.push({
        id: 'logout',
        label: 'Log out',
        icon: 'LogOut',
        group: 'Account',
        onSelect: logout,
      });
    } else {
      list.push(
        {
          id: 'login',
          label: 'Log in',
          icon: 'LogIn',
          group: 'Account',
          onSelect: () => navigate(ROUTES.login),
        },
        {
          id: 'register',
          label: 'Create account',
          icon: 'UserPlus',
          group: 'Account',
          onSelect: () => navigate(ROUTES.register),
        },
      );
    }

    return list;
  }, [
    cycleTheme,
    isAdmin,
    isAuthenticated,
    isInstructor,
    logout,
    navigate,
    preferences.theme,
    user?._id,
    user?.id,
  ]);

  if (!hasOpenedOnce) return null;

  return (
    <Suspense fallback={null}>
      <CommandMenu open={open} onClose={close} items={items} />
    </Suspense>
  );
}

export default CommandPalette;
