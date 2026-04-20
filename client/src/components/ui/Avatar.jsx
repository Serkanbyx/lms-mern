/**
 * `Avatar` — circular profile image with deterministic-color fallback.
 *
 * If `src` loads, we render the image. If it errors or is missing, we
 * derive initials from `name` and pick a hue from a stable hash of the
 * same name — the same user always gets the same background color, which
 * makes scanning long lists easier.
 *
 * `ring` adds a focus-style ring (used in Navbar avatars when the dropdown
 * is open).
 */

import { useMemo, useState } from 'react';
import { cn } from '../../utils/cn.js';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const FALLBACK_HUES = [210, 260, 290, 340, 20, 50, 140, 170];

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function Avatar({
  src,
  name = '',
  size = 'md',
  ring = false,
  className,
  alt,
  ...rest
}) {
  const [errored, setErrored] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const hue = useMemo(
    () => FALLBACK_HUES[hashString(name) % FALLBACK_HUES.length],
    [name],
  );

  const showImage = src && !errored;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-semibold select-none',
        ring && 'ring-2 ring-primary ring-offset-2 ring-offset-bg',
        SIZES[size],
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              backgroundColor: `hsl(${hue} 70% 92%)`,
              color: `hsl(${hue} 60% 30%)`,
            }
      }
      aria-label={alt ?? name}
      role="img"
      {...rest}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? name}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

export default Avatar;
