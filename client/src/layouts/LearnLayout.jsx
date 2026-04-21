/**
 * Lesson player shell — minimal, dark, distraction-free chrome wrapped
 * around the player canvas (lesson video / quiz).
 *
 * Differences from `MainLayout`:
 *  - No global Navbar / Footer.
 *  - A thin top bar with "back to course" + course title (resolved by
 *    the page below us via context or URL params; this layout only
 *    provides the slot).
 *  - The body fills the viewport and forces a `dark` class so even
 *    light-mode users get the cinematic player background.
 *
 * The collapsible curriculum drawer lives inside the page itself
 * (LessonPlayerPage / QuizPage) because its data dependencies belong
 * to the page, not the layout.
 */

import { Suspense } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import {
  OfflineBanner,
  PageTransition,
  RouteSkeleton,
} from '../components/layout/index.js';
import { Seo } from '../components/seo/index.js';
import { Avatar, Icon } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROUTES } from '../utils/constants.js';

export function LearnLayout() {
  const { slug } = useParams();
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="dark min-h-screen flex flex-col bg-bg text-text">
      {/* Lesson player + quiz pages are enrollment-gated; keep them out
          of the search index. */}
      <Seo noIndex />

      <a
        href="#player"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-fg focus:shadow-lg"
      >
        Skip to player
      </a>

      <OfflineBanner />

      <header className="h-12 shrink-0 border-b border-border bg-bg-subtle/80 backdrop-blur-md">
        <div className="h-full mx-auto max-w-7xl px-4 flex items-center gap-3">
          <Link
            to={slug ? ROUTES.courseDetail(slug) : ROUTES.catalog}
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            <Icon name="ChevronLeft" size={16} />
            Back to course
          </Link>

          <div
            id="lesson-title-slot"
            className="flex-1 text-center text-sm font-medium text-text truncate"
          />

          {user && (
            <Avatar
              src={user.avatarUrl}
              name={user.name}
              size="xs"
              alt={user.name}
            />
          )}
        </div>
      </header>

      <main
        id="player"
        tabIndex={-1}
        className="flex-1 min-w-0 overflow-hidden"
      >
        <PageTransition>
          <ErrorBoundary key={location.pathname} variant="inline">
            <Suspense fallback={<RouteSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </PageTransition>
      </main>
    </div>
  );
}

export default LearnLayout;
