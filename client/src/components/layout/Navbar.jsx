/**
 * Top-level Navbar — sticky, frosted-glass header used by `MainLayout`.
 *
 * Responsibilities:
 *  - Brand mark + wordmark linking home.
 *  - Inline catalog search (debounced; navigates to `/courses?search=…`).
 *    Pressing `/` from anywhere outside an editable element focuses it.
 *  - Public + role-aware navigation links.
 *  - Theme cycle button (light → dark → system → light…).
 *  - Notifications bell — placeholder until the feature ships
 *    (rendered as a non-interactive icon to avoid dead UX).
 *  - Avatar dropdown with profile / dashboard / settings / logout, plus
 *    an Admin Console entry for admins.
 *  - Mobile hamburger that opens the same nav inside a `Drawer`.
 *
 * A11y:
 *  - Single `<header role="banner">`; the brand text is the accessible
 *    name of the home link.
 *  - Active route is communicated to assistive tech via `aria-current`.
 *  - The search input has an associated label and a visible `KBD` hint
 *    that describes the keyboard shortcut.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth.js';
import { usePreferences } from '../../context/usePreferences.js';
import {
  Avatar,
  Drawer,
  Dropdown,
  Icon,
  IconButton,
  Input,
  KBD,
  RoleBadge,
} from '../ui/index.js';
import { Logo, LogoMark } from '../brand/index.js';
import { ROUTES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';

const PUBLIC_LINKS = [
  { to: ROUTES.catalog, label: 'Courses' },
  { to: ROUTES.teach, label: 'For Teaching' },
];

const THEME_CYCLE = ['light', 'dark', 'system'];
const THEME_ICON = { light: 'Sun', dark: 'Moon', system: 'Monitor' };

const NavItem = ({ to, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'text-text bg-bg-muted'
          : 'text-text-muted hover:text-text hover:bg-bg-muted/60',
      )
    }
  >
    {label}
  </NavLink>
);

const ThemeToggle = () => {
  const { preferences, updatePreference } = usePreferences();
  const current = preferences.theme ?? 'system';
  const next =
    THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];

  return (
    <IconButton
      aria-label={`Switch theme (current: ${current})`}
      title={`Theme: ${current} — click for ${next}`}
      onClick={() => updatePreference('theme', next)}
    >
      <Icon name={THEME_ICON[current] ?? 'Sun'} size={18} />
    </IconButton>
  );
};

const SearchBox = ({ onSubmit, autoFocus = false }) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global "/" shortcut focuses the desktop search input.
  useEffect(() => {
    const handler = (event) => {
      if (event.key !== '/') return;
      const target = event.target;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    onSubmit(value.trim());
  };

  return (
    <form role="search" onSubmit={submit} className="w-full max-w-md">
      <label htmlFor="navbar-search" className="sr-only">
        Search courses
      </label>
      <Input
        id="navbar-search"
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search courses…"
        leadingIcon={<Icon name="Search" size={16} />}
        trailingIcon={<KBD className="hidden md:inline-flex">/</KBD>}
      />
    </form>
  );
};

const UserMenu = ({ user, isAdmin, onLogout, onNavigate }) => {
  const items = [
    {
      id: 'header',
      label: (
        <span className="flex flex-col">
          <span className="text-sm font-medium text-text">{user.name}</span>
          <span className="text-xs text-text-subtle">{user.email}</span>
        </span>
      ),
      disabled: true,
    },
    { id: 'sep-1', separator: true },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'User',
      onSelect: () => onNavigate(ROUTES.profile(user._id ?? user.id)),
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      onSelect: () => onNavigate(ROUTES.dashboard),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'Settings',
      shortcut: '⌘,',
      onSelect: () => onNavigate(ROUTES.settings),
    },
  ];

  if (isAdmin) {
    items.push({
      id: 'admin',
      label: 'Admin Console',
      icon: 'ShieldCheck',
      onSelect: () => onNavigate(ROUTES.admin),
    });
  }

  items.push(
    { id: 'sep-2', separator: true },
    {
      id: 'logout',
      label: 'Log out',
      icon: 'LogOut',
      danger: true,
      onSelect: onLogout,
    },
  );

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Open user menu"
        >
          <Avatar src={user.avatarUrl} name={user.name} size="sm" />
        </button>
      }
      items={items}
    />
  );
};

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInstructor, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation to avoid stale-overlay UX.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const goToCatalog = (search) => {
    const target = search
      ? `${ROUTES.catalog}?search=${encodeURIComponent(search)}`
      : ROUTES.catalog;
    navigate(target);
  };

  const renderRoleLinks = (onClick) => (
    <>
      {PUBLIC_LINKS.map((link) => (
        <NavItem key={link.to} {...link} onClick={onClick} />
      ))}
      {isAuthenticated && (
        <NavItem to={ROUTES.dashboard} label="My Learning" onClick={onClick} />
      )}
      {(isInstructor || isAdmin) && (
        <NavItem to={ROUTES.instructor} label="Teach" onClick={onClick} />
      )}
    </>
  );

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border"
    >
      <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center gap-4">
        <Link
          to={ROUTES.home}
          className="flex items-center gap-2 shrink-0 text-text hover:text-primary transition-colors"
          aria-label="Lumen LMS — home"
        >
          <span className="hidden sm:inline-flex"><Logo decorative /></span>
          <span className="sm:hidden"><LogoMark /></span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1"
        >
          {renderRoleLinks()}
        </nav>

        <div className="hidden md:flex flex-1 justify-center">
          <SearchBox onSubmit={goToCatalog} />
        </div>

        <div className="flex items-center gap-1 ml-auto md:ml-0">
          <ThemeToggle />

          <IconButton
            aria-label="Notifications (coming soon)"
            disabled
            className="hidden sm:inline-flex"
          >
            <Icon name="Bell" size={18} />
          </IconButton>

          {isAuthenticated && user ? (
            <>
              <span className="hidden lg:inline-flex">
                <RoleBadge role={user.role} />
              </span>
              <UserMenu
                user={user}
                isAdmin={isAdmin}
                onLogout={logout}
                onNavigate={navigate}
              />
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <NavLink
                to={ROUTES.login}
                className="text-sm font-medium text-text-muted hover:text-text px-3 py-1.5"
              >
                Log in
              </NavLink>
              <NavLink
                to={ROUTES.register}
                className="text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
              >
                Sign up
              </NavLink>
            </div>
          )}

          <IconButton
            aria-label="Open navigation menu"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="Menu" size={20} />
          </IconButton>
        </div>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        side="right"
        title="Menu"
      >
        <div className="space-y-6">
          {/* Mobile drawer auto-focuses the search input by request:
              once the user has explicitly opened "Menu", typing-first is
              the obvious next step. The lint exception is intentional. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <SearchBox onSubmit={goToCatalog} autoFocus />

          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {renderRoleLinks(() => setMobileOpen(false))}
          </nav>

          {!isAuthenticated && (
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Link
                to={ROUTES.login}
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-bg-muted"
              >
                Log in
              </Link>
              <Link
                to={ROUTES.register}
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-4 py-2 rounded-md bg-primary text-primary-fg text-sm font-medium hover:bg-primary-hover"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}

export default Navbar;
