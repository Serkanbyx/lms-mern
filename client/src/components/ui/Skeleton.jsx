/**
 * `Skeleton` — placeholder shape shown while data loads. The shimmer
 * keyframe is defined in `index.css` (gated by `prefers-reduced-motion`)
 * so motion-sensitive users see a calm static block instead of a moving
 * gradient.
 *
 * Three variants cover almost every loading shape: rectangle (cards,
 * thumbnails), text (line of copy with relaxed height), and circle
 * (avatars, ring progress).
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
        'bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--color-text)_8%,transparent)_50%,transparent_100%)]',
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
