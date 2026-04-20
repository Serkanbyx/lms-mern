/**
 * `FullPageSpinner` — neutral, viewport-filling loading state used by
 * route guards while session/role checks are still resolving.
 *
 * Kept here (not in `components/ui`) because guards are the only callers.
 * The Spinner primitive does the actual animation; this component only
 * pins it to the centre of the screen so the page never flashes wrong
 * content during the brief auth hydration window.
 */

import { Spinner } from '../ui/index.js';

export function FullPageSpinner({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex items-center justify-center"
    >
      <Spinner size="lg" label={label} />
    </div>
  );
}

export default FullPageSpinner;
