/**
 * Shared "page coming soon" stub used by route files that haven't been
 * implemented yet.
 *
 * Living in a single file keeps the placeholder visual consistent and
 * means we can later grep for `_PlaceholderPage` to confirm every route
 * has been built.
 */

import { EmptyState } from '../components/ui/index.js';

export function PlaceholderPage({ name, description }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <EmptyState
        icon="Construction"
        title={name}
        description={description ?? 'This page is coming soon.'}
      />
    </div>
  );
}

export default PlaceholderPage;
