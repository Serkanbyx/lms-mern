/**
 * Privacy-friendly analytics wrapper.
 *
 * A thin façade over whichever cookieless analytics provider we wire in
 * later (Plausible / Umami / etc). Until that wiring lands the wrapper
 * is a deliberate no-op so:
 *
 *   - feature code can call `track('lesson_complete', { courseId })`
 *     today without crashing in dev,
 *   - the day a provider is chosen we add `<script>` to `index.html`
 *     and flip `VITE_FEATURE_ANALYTICS=true` — every existing call
 *     starts reporting without touching one component.
 *
 * Why a wrapper rather than direct `plausible(...)` calls everywhere:
 *   1. Future-proofing: swapping providers becomes a one-file change.
 *   2. Privacy gate: every event is funnelled through the
 *      `features.analytics` flag so we never accidentally emit
 *      telemetry while the toggle is off.
 *   3. Testability: components stay deterministic in unit tests; the
 *      wrapper can be mocked in one place.
 *
 * GDPR / CCPA: Plausible & Umami are cookieless and do NOT collect
 * PII, which removes the consent-banner requirement. Do NOT add
 * Google Analytics / Mixpanel through this wrapper without first
 * adding a consent banner and an opt-out path.
 *
 * Critical events to instrument as the surfaces ship (tracking these
 * gives us the funnel + activation metrics we actually use):
 *   - signup, login, email_verified
 *   - course_view, enroll, lesson_complete
 *   - quiz_start, quiz_submit, quiz_passed
 *   - certificate_downloaded
 *   - course_create, course_submit_review, course_published
 */

import { features } from '../config/features.js';

const isEnabled = () => features.analytics === true;

/**
 * Track a single analytics event.
 *
 * `props` should be flat (no nested objects), short string / number
 * values only — Plausible's custom-properties API rejects nested
 * payloads at ingest time. Numeric ids that we treat as opaque (course
 * ids, lesson ids) are fine; full objects are not.
 */
export const track = (event, props = {}) => {
  if (!event || !isEnabled()) return;
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, { props });
      return;
    }
    if (typeof window.umami?.track === 'function') {
      window.umami.track(event, props);
      return;
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[analytics] Failed to track event:', event, err);
    }
  }
};

/**
 * Page-view helper. Most providers fire one automatically on initial
 * load, but client-side router transitions need an explicit call. Wire
 * this in a top-level route effect once analytics is enabled:
 *
 *   useEffect(() => { pageview(location.pathname); }, [location]);
 */
export const pageview = (path) => {
  if (!isEnabled()) return;
  if (typeof window === 'undefined') return;
  if (typeof window.plausible === 'function') {
    window.plausible('pageview', { u: window.location.origin + path });
  }
};

export default { track, pageview };
