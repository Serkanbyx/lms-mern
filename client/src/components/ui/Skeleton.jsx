/**
 * `Skeleton` — placeholder shape shown while data loads. The shimmer
 * keyframe is defined in `index.css` (gated by `prefers-reduced-motion`)
 * so motion-sensitive users see a calm static block instead of a moving
 * gradient.
 *
 * Three variants cover almost every loading shape: rectangle (cards,
 * thumbnails), text (line of copy with relaxed height), and circle
 * (avatars, ring progress).
 *
 * Contrast strategy:
 *   The base fill (`bg-bg-muted`) and the shimmer highlight are both
 *   derived from the theme tokens, but on the dark surface they sit
 *   only a few luminance steps above the page background — barely
 *   visible. We layer a `ring-1` inset border (`--color-border`) so
 *   the shape always has a crisp edge, and bump the shimmer mix to
 *   ~14% of the foreground colour so the highlight reads on both
 *   light and dark themes without changing its hue.
 */

import { cn } from '../../utils/cn.js';

const VARIANT_CLASSES = {
  rect: 'rounded-md',
  text: 'rounded h-3.5',
  circle: 'rounded-full',
};

export function Skeleton({
  variant = 'rect',
  width,
  height,
  className,
  style,
  ...rest
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block relative overflow-hidden bg-bg-muted',
        'ring-1 ring-inset ring-border',
        'bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--color-text)_14%,transparent)_50%,transparent_100%)]',
        'bg-no-repeat bg-size-[200%_100%] animate-shimmer',
        VARIANT_CLASSES[variant],
        className,
      )}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}

export default Skeleton;
