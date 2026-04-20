/**
 * `AdminRoute` — admins only. Non-admin signed-in users are sent to their
 * dashboard. Anonymous visitors get the standard login redirect with
 * `?next=` preservation so they can be brought back after signing in
 * (provided they actually have admin privileges).
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.login}?next=${next}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return children ?? <Outlet />;
}

export default AdminRoute;
