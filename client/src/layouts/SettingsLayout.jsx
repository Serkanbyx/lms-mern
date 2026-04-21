/**
 * Settings shell — left side-nav (Profile, Account, Appearance, Privacy,
 * Notifications, Playback) + nested route outlet.
 *
 * Mobile (`< md`) collapses the side-nav into a native `<select>` so the
 * pattern matches platform expectations (no surprise drawer, no extra
 * tap to swap tabs).
 */

import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import {
  Footer,
  Navbar,
  OfflineBanner,
  PageTransition,
  RouteSkeleton,
} from '../components/layout/index.js';
import { Seo } from '../components/seo/index.js';
import { Icon, Select } from '../components/ui/index.js';
import { ROUTES } from '../utils/constants.js';
import { cn } from '../utils/cn.js';

const NAV_ITEMS = [
  { to: ROUTES.settings, label: 'Profile', icon: 'User', end: true },
  { to: ROUTES.settingsAccount, label: 'Account', icon: 'KeyRound' },
  { to: ROUTES.settingsAppearance, label: 'Appearance', icon: 'Palette' },
  { to: ROUTES.settingsPrivacy, label: 'Privacy', icon: 'EyeOff' },
  {
    to: ROUTES.settingsNotifications,
    label: 'Notifications',
    icon: 'Bell',
  },
  { to: ROUTES.settingsPlayback, label: 'Playback', icon: 'Play' },
];

const SideNav = () => (
  <nav aria-label="Settings" className="flex flex-col gap-1">
    {NAV_ITEMS.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
            isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-text-muted hover:text-text hover:bg-bg-muted',
          )
        }
      >
        <Icon name={item.icon} size={16} />
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
);

const MobileSelect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const current =
    NAV_ITEMS.slice()
      .reverse()
      .find((item) => location.pathname.startsWith(item.to))?.to ??
    ROUTES.settings;

  return (
    <Select
      value={current}
      onChange={(event) => navigate(event.target.value)}
      options={NAV_ITEMS.map((item) => ({
        value: item.to,
        label: item.label,
      }))}
      aria-label="Settings section"
    />
  );
};

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      {/* Settings is private to the signed-in user — robots stay out. */}
      <Seo noIndex />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-fg focus:shadow-lg"
      >
        Skip to content
      </a>

      <OfflineBanner />
      <Navbar />

      <div className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-text">Settings</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your profile, preferences, and account.
          </p>
        </header>

        <div className="md:hidden mb-4">
          <MobileSelect />
        </div>

        <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8">
          <aside className="hidden md:block sticky top-20 self-start">
            <SideNav />
          </aside>

          <main id="main" tabIndex={-1} className="min-w-0">
            <PageTransition>
              <ErrorBoundary key={location.pathname} variant="inline">
                <Suspense fallback={<RouteSkeleton />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </PageTransition>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default SettingsLayout;
