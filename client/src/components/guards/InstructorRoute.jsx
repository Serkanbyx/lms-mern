/**
 * `InstructorRoute` — must be authenticated AND have the `instructor` or
 * `admin` role. A signed-in student lands on `/dashboard` (their natural
 * home) instead of seeing a 404 or a permission error mid-page.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';

export function InstructorRoute({ children }) {
  const { isAuthenticated, isInstructor, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.login}?next=${next}`} replace />;
  }

  if (!isInstructor && !isAdmin) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return children ?? <Outlet />;
}

export default InstructorRoute;
