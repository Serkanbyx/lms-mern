/**
 * `JsonLd` — emits a `<script type="application/ld+json">` tag through
 * `react-helmet-async` so structured data lives next to the page that
 * owns it (e.g. `Course` schema on the course detail page).
 *
 * The payload is JSON-stringified once per render; we deliberately
 * avoid pretty-printing because crawlers don't need whitespace and
 * compact output keeps the document slimmer.
 *
 * Pass it as a child of `<Seo>` so all metadata for a route is grouped
 * in a single Helmet subtree.
 */

import { Helmet } from 'react-helmet-async';

export function JsonLd({ data }) {
  if (!data) return null;
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

export default JsonLd;
