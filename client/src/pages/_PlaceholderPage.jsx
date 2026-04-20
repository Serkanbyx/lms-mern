/**
 * Shared "page coming soon" stub used by route files that haven't been
 * implemented yet (STEP 26 onwards swaps each one out for the real page).
 *
 * Living in a single file keeps the placeholder visual consistent and
 * means we can later grep for `_PlaceholderPage` to confirm every route
 * has been built.
 */

import { EmptyState } from '../components/ui/index.js';

export function PlaceholderPage({ name, step, description }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <EmptyState
        icon="Construction"
        title={name}
        description={
          description ??
          `This page is scaffolded and will be implemented in STEP ${step}.`
        }
      />
    </div>
  );
}

export default PlaceholderPage;
