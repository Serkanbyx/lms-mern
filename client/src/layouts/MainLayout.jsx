/**
 * Default app layout — Navbar + content + Footer.
 *
 * The "Skip to content" link is the first focusable element on every
 * page so keyboard users can jump straight past the navigation chrome
 * to the routed content. It only becomes visible when focused, so it
 * never visually competes with the brand mark for sighted users.
 *
 * `PageTransition` wraps the `<Outlet />` so route changes get the
 * shared fade-up animation defined in `utils/motion.js` (and respects
 * the user's reduced-motion preference via `MotionProvider`).
 */

import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import {
  CommandPalette,
  Footer,
  Navbar,
  OfflineBanner,
  PageTransition,
  RouteSkeleton,
} from '../components/layout/index.js';

export function MainLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-fg focus:shadow-lg"
      >
        Skip to content
      </a>

      <OfflineBanner />
      <Navbar />

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 min-h-[calc(100vh-64px)]"
      >
        <PageTransition>
          {/* Per-route ErrorBoundary keyed on pathname so a single page
              crash never replaces the global chrome and the boundary
              auto-resets when the user navigates elsewhere. */}
          <ErrorBoundary key={location.pathname} variant="inline">
            <Suspense fallback={<RouteSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </PageTransition>
      </main>

      <Footer />

      <CommandPalette />
    </div>
  );
}

export default MainLayout;
