/**
 * `GuestOnlyRoute` — inverse of `ProtectedRoute`.
 *
 * Wraps the auth screens (`/login`, `/register`, `/forgot-password`) so an
 * already-signed-in user is bounced to their dashboard instead of seeing a
 * confusing duplicate sign-in form. Honours a `?next=` query param so a
 * deep-link login flow can resume the user's intended destination.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/useAuth.js';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';

export function GuestOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    return <Navigate to={next || ROUTES.dashboard} replace />;
  }

  return children ?? <Outlet />;
}

export default GuestOnlyRoute;
