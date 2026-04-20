/**
 * Catch-all 404 page (final route in `App.jsx`).
 *
 * Polished further in STEP 45 — for now this is a friendly empty state
 * with a link back to the catalog so users never end up trapped on a
 * dead URL.
 */

import { Link } from 'react-router-dom';

import { Button, EmptyState } from '../../components/ui/index.js';
import { ROUTES } from '../../utils/constants.js';

export default function NotFoundPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <EmptyState
        icon="Compass"
        title="404 — page not found"
        description="The page you were looking for doesn't exist or has moved."
        action={
          <Link to={ROUTES.home}>
            <Button>Back to home</Button>
          </Link>
        }
      />
    </div>
  );
}
