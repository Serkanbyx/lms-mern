/**
 * Cloudinary URL transformer.
 *
 * Cloudinary delivery URLs follow the shape:
 *   https://res.cloudinary.com/<cloud>/<asset>/upload/<rest>
 * Inserting a transformation segment between `/upload/` and `<rest>`
 * (`/upload/f_auto,q_auto,w_640/<rest>`) instructs Cloudinary to
 * serve the asset re-encoded to the modern format the browser
 * advertises (`f_auto`), at the smallest acceptable quality
 * (`q_auto`) and resized to the requested width.
 *
 * `withCloudinaryTransform(url, 'f_auto,q_auto,w_640')` is a no-op
 * for non-Cloudinary URLs (data URIs, blob previews, third-party
 * thumbnails) so call sites can wrap any image source defensively.
 *
 * `cloudinarySrcSet(url, [320, 640, 960, 1280])` builds an `srcset`
 * string that pairs each width-tagged URL with its `w` descriptor —
 * the browser then picks the closest match for the current viewport
 * + DPR, which is the cheapest meaningful win for image-heavy lists.
 */

const TRANSFORM_MARKER = '/upload/';

const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes(TRANSFORM_MARKER);

/**
 * Insert a Cloudinary transformation chain into `url`.
 *
 * If `url` already carries a transformation (e.g. someone built it
 * with extra options upstream), the segment between `/upload/` and
 * the next `/` is replaced — we never stack two transformation
 * blocks because Cloudinary would interpret them as a chained
 * pipeline, which is rarely what the caller wants and silently
 * doubles the delivery cost.
 */
export const withCloudinaryTransform = (url, transform) => {
  if (!isCloudinaryUrl(url) || !transform) return url ?? '';

  const [prefix, rest] = url.split(TRANSFORM_MARKER);
  if (!rest) return url;

  // If the existing first segment looks like a transformation block
  // (contains `_` after a 1-2 letter prefix, e.g. `f_auto`) drop it.
  const segments = rest.split('/');
  const looksLikeTransform = /^[a-z]{1,3}_[^/]+/i.test(segments[0]);
  const tail = looksLikeTransform ? segments.slice(1).join('/') : segments.join('/');

  return `${prefix}${TRANSFORM_MARKER}${transform}/${tail}`;
};

/**
 * Build a responsive `srcset` string from a single Cloudinary URL.
 *
 * @param {string} url     — original Cloudinary delivery URL
 * @param {number[]} widths — pixel widths to emit (default catalog grid set)
 * @param {string} [extra] — extra transformations to chain in (e.g. `c_fill,g_face`)
 * @returns {string} `<url> <w>w, <url> <w>w, …` or `''` for non-Cloudinary URLs
 */
export const cloudinarySrcSet = (
  url,
  widths = [320, 640, 960, 1280],
  extra = '',
) => {
  if (!isCloudinaryUrl(url)) return '';
  const base = extra ? `f_auto,q_auto,${extra}` : 'f_auto,q_auto';
  return widths
    .map((width) => `${withCloudinaryTransform(url, `${base},w_${width}`)} ${width}w`)
    .join(', ');
};

/**
 * Common preset wrappers — keep call sites declarative ("give me a
 * card-sized thumbnail") instead of leaking Cloudinary param strings
 * across the component tree.
 */
export const cloudinaryPresets = {
  cardThumb: (url) => withCloudinaryTransform(url, 'f_auto,q_auto,w_640'),
  heroThumb: (url) => withCloudinaryTransform(url, 'f_auto,q_auto,w_1600'),
  avatar: (url, size = 96) =>
    withCloudinaryTransform(url, `f_auto,q_auto,w_${size},h_${size},c_fill,g_face`),
};

/**
 * STEP 48 — Low-Quality Image Placeholder (LQIP).
 *
 * Returns a tiny (~500 B) heavily-blurred preview of the same Cloudinary
 * asset. Strategy:
 *   1. Render the LQIP as a CSS `background-image` on the thumbnail wrapper.
 *   2. Layer the real `<img>` on top with `loading="lazy"` and a fade-in
 *      transition controlled by an `onLoad` handler.
 *   3. Result: instant perceived load on the catalog grid, smooth
 *      blur-to-sharp transition once the high-res asset arrives.
 *
 * `e_blur:1000` is Cloudinary's max blur strength; `q_1` drops quality to
 * the cheapest possible JPEG / WebP encoding; `f_auto` lets the browser
 * negotiate the smallest format it accepts. The placeholder weighs in at
 * roughly the size of a single TLS frame, so loading it is essentially free.
 *
 * Returns `''` for non-Cloudinary URLs so call sites can wrap any image
 * source defensively without branching.
 */
export const cloudinaryLqip = (url) =>
  isCloudinaryUrl(url) ? withCloudinaryTransform(url, 'e_blur:1000,q_1,f_auto,w_64') : '';

export default withCloudinaryTransform;
