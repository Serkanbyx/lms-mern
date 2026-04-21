/**
 * `EnrolledRoute` — guards the lesson player and quiz pages.
 *
 * Composes on top of `ProtectedRoute` (auth is required) and additionally
 * verifies the current user is enrolled in the course referenced by the
 * `:slug` URL param. If not enrolled we surface a toast and redirect to
 * the public course detail page where the user can hit "Enroll".
 *
 * Implementation notes:
 *  - We resolve `slug → courseId` via `getCourseBySlug` because the
 *    enrollment endpoint is keyed by id, while routes are keyed by slug
 *    for shareability.
 *  - Any failure in either request is treated as "not enrolled" — a 404
 *    on the course also shouldn't leave the user staring at a blank
 *    player.
 *  - Both requests are guarded by an `ignore` flag to avoid setting
 *    state on an unmounted component when the user navigates away mid-
 *    fetch.
 *  - The "not enrolled" toast is fired through `RedirectWithToast` so
 *    `StrictMode`'s double render in dev never produces duplicate
 *    toasts.
 */

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import * as courseService from '../../services/course.service.js';
import * as enrollmentService from '../../services/enrollment.service.js';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';
import { RedirectWithToast } from './RedirectWithToast.jsx';

export function EnrolledRoute({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { slug } = useParams();
  const location = useLocation();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (authLoading || !isAuthenticated || !slug) return undefined;

    let ignore = false;
    setStatus('checking');

    (async () => {
      try {
        const courseResp = await courseService.getCourseBySlug(slug);
        const course = courseResp?.course ?? courseResp;
        const courseId = course?._id ?? course?.id;
        if (!courseId) throw new Error('Course not found');

        const enrollmentResp =
          await enrollmentService.getEnrollmentForCourse(courseId);
        const enrollment =
          enrollmentResp?.enrollment ??
          enrollmentResp?.data ??
          enrollmentResp;

        if (ignore) return;
        setStatus(enrollment ? 'enrolled' : 'not-enrolled');
      } catch {
        if (!ignore) setStatus('not-enrolled');
      }
    })();

    return () => {
      ignore = true;
    };
  }, [authLoading, isAuthenticated, slug]);

  if (authLoading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <RedirectWithToast
        to={`${ROUTES.login}?next=${next}`}
        message="Please sign in to continue."
        variant="info"
      />
    );
  }

  if (status === 'checking') {
    return <FullPageSpinner label="Checking access…" />;
  }

  if (status === 'not-enrolled') {
    return (
      <RedirectWithToast
        to={ROUTES.courseDetail(slug)}
        message="Enroll to access this lesson."
        variant="info"
      />
    );
  }

  return children ?? <Outlet />;
}

export default EnrolledRoute;
