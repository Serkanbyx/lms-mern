/**
 * STEP 49 — `useFeature(name)` hook.
 *
 * Thin React wrapper over `features` so components can read flags
 * declaratively and so test suites can mock a flag for a single
 * render without touching `import.meta.env`.
 *
 *   const showCert = useFeature('certificates');
 *   {showCert && <CertificateButton enrollment={e} />}
 *
 * Returns `false` for unknown keys (rather than `undefined`) so
 * callers never need a `?? false` defensively. Logs a `console.warn`
 * in dev when an unknown key is requested — typos are a frequent
 * source of "the button never appears" bugs and silent fallbacks
 * mask them.
 */

import { features } from '../config/features.js';

export const useFeature = (name) => {
  const enabled = Object.prototype.hasOwnProperty.call(features, name)
    ? Boolean(features[name])
    : false;

  if (import.meta.env.DEV && !Object.prototype.hasOwnProperty.call(features, name)) {
    console.warn(`[useFeature] Unknown feature flag: "${name}".`);
  }

  return enabled;
};

export default useFeature;
