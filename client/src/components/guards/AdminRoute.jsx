/**
 * `AdminRoute` — admins only.
 *
 * Behaviour:
 *  - Anonymous visitors are redirected to `/login?next=…` with a polite
 *    "please sign in" toast.
 *  - Non-admin signed-in users are redirected to the public home and
 *    shown a deliberately neutral "Page not available" toast.
 *
 * SECURITY: The wording must not leak that an admin area exists. A
 * "Admins only" message would tell a curious user that the URL they
 * just probed is a real privileged surface — useful intel for an
 * attacker. We mirror what the public 404 conveys instead. The server
 * is, as always, the source of truth: every admin endpoint enforces
 * its own authorization regardless of what this guard decides.
 */

import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';
import { RedirectWithToast } from './RedirectWithToast.jsx';

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
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

  if (!isAdmin) {
    return (
      <RedirectWithToast
        to={ROUTES.home}
        message="That page isn't available."
        variant="info"
      />
    );
  }

  return children ?? <Outlet />;
}

export default AdminRoute;
