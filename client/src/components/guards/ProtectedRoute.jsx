/**
 * `ProtectedRoute` — gate any page that requires an authenticated session.
 *
 * Behaviour:
 *  - While `AuthContext` is still hydrating the token (`loading === true`)
 *    we render a full-page spinner instead of redirecting. Without this
 *    the browser would briefly bounce to `/login` on every refresh of a
 *    protected page before `GET /auth/me` resolved, causing a flash.
 *  - When unauthenticated we redirect to `/login?next=<current url>` and
 *    use `replace` so the back button does not loop the user through the
 *    rejected URL. The `next` value is URL-encoded so query strings on
 *    the original page survive the round trip.
 *  - A polite "please sign in to continue" toast accompanies the
 *    redirect so the user understands why the URL bar suddenly changed.
 *
 * SECURITY: Guards are a UX convenience. The server is the source of
 * truth for authorization — every protected endpoint enforces its own
 * checks regardless of what this component decides.
 */

import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../utils/constants.js';
import { FullPageSpinner } from './FullPageSpinner.jsx';
import { RedirectWithToast } from './RedirectWithToast.jsx';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
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

  return children ?? <Outlet />;
}

export default ProtectedRoute;
