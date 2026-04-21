/**
 * Admin shell — sticky sidebar (≥ lg) with a nested route outlet.
 *
 * On smaller breakpoints the sidebar collapses behind a hamburger button
 * that opens the same nav inside a `Drawer`. This way admins on tablets /
 * phones still get the full toolset without us shipping a duplicate
 * mobile-only nav structure.
 *
 * Wraps the public `MainLayout` chrome so admins keep the same global
 * navbar (theme, search, profile menu) and never feel "siloed" inside
 * the admin app.
 */

import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import {
  Footer,
  Navbar,
  OfflineBanner,
  PageTransition,
  RouteSkeleton,
} from '../components/layout/index.js';
import { Seo } from '../components/seo/index.js';
import { Drawer, Icon, IconButton } from '../components/ui/index.js';
import { ROUTES } from '../utils/constants.js';
import { cn } from '../utils/cn.js';

const NAV_ITEMS = [
  { to: ROUTES.admin, label: 'Dashboard', icon: 'LayoutDashboard', end: true },
  { to: ROUTES.adminUsers, label: 'Users', icon: 'Users' },
  { to: ROUTES.adminCourses, label: 'Courses', icon: 'BookOpen' },
  { to: ROUTES.adminPending, label: 'Pending Review', icon: 'ClipboardCheck' },
];

const SidebarLink = ({ to, label, icon, end, onClick }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-text-muted hover:text-text hover:bg-bg-muted',
      )
    }
  >
    <Icon name={icon} size={16} />
    <span>{label}</span>
  </NavLink>
);

const SidebarNav = ({ onItemClick }) => (
  <nav aria-label="Admin" className="flex flex-col gap-1">
    <p className="text-xs font-semibold uppercase tracking-wider text-text-subtle px-3 mb-1">
      Admin Console
    </p>
    {NAV_ITEMS.map((item) => (
      <SidebarLink key={item.to} {...item} onClick={onItemClick} />
    ))}
  </nav>
);

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      {/* Admin pages must never be indexed; child Seo can still set the
          per-route title and inherits this robots policy by default. */}
      <Seo noIndex />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-fg focus:shadow-lg"
      >
        Skip to content
      </a>

      <OfflineBanner />
      <Navbar />

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex gap-6">
        <aside className="hidden lg:block w-60 shrink-0 sticky top-20 self-start">
          <SidebarNav />
        </aside>

        <main id="main" tabIndex={-1} className="flex-1 min-w-0">
          <div className="lg:hidden mb-4">
            <IconButton
              aria-label="Open admin navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Icon name="Menu" size={20} />
            </IconButton>
          </div>

          <PageTransition>
            <ErrorBoundary key={location.pathname} variant="inline">
              <Suspense fallback={<RouteSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </PageTransition>
        </main>
      </div>

      <Footer />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        title="Admin"
      >
        <SidebarNav onItemClick={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}

export default AdminLayout;
