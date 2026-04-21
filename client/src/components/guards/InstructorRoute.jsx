/**
 * `InstructorRoute` — must be authenticated AND have the `instructor` or
 * `admin` role.
 *
 * Behaviour:
 *  - Anonymous visitors are redirected to `/login?next=…` with a polite
 *    "please sign in" toast and the original URL preserved so we can
 *    bring them back after the auth flow.
 *  - Signed-in users without instructor privileges are sent to the
 *    public home (not the dashboard) with a toast explaining why. We
 *    deliberately route to `/` rather than `/dashboard` so a student
 *    poking at a deep instructor URL doesn't get teleported into a
 *    private surface they didn't ask for.
 */

import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/useAuth.js';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';
import { RedirectWithToast } from './RedirectWithToast.jsx';

export function InstructorRoute({ children }) {
  const { isAuthenticated, isInstructor, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

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

  if (!isInstructor && !isAdmin) {
    return (
      <RedirectWithToast
        to={ROUTES.home}
        message="This area is for instructors only."
        variant="info"
      />
    );
  }

  return children ?? <Outlet />;
}

export default InstructorRoute;
