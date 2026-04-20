/**
 * Lumen LMS brand logo (inline SVG so consumers can re-color via `currentColor`
 * or pass an explicit color, and so it scales crisply at any DPI).
 *
 * Variants:
 *  - "wordmark"  → mark + "Lumen LMS" text (default; for navbars, footers).
 *  - "mark"      → square icon only (for compact spaces, favicons-in-app, avatars).
 *
 * Color model:
 *  - The outer rounded square uses `color` (defaults to `currentColor`) so the
 *    logo inherits the surrounding text color — switch themes for free.
 *  - Inner geometric layers use `accent` (defaults to white). Pass a darker
 *    accent when rendering on a light background where the mark is filled
 *    with a dark color.
 *
 * Accessibility:
 *  - When `title` is provided, the SVG is exposed as an image with that label.
 *  - When `decorative` is true, the SVG is hidden from assistive tech.
 */
export function Logo({
  variant = 'wordmark',
  size = 32,
  color = 'currentColor',
  accent = '#ffffff',
  className = '',
  title = 'Lumen LMS',
  decorative = false,
  ...rest
}) {
  const isWordmark = variant === 'wordmark';
  const viewBox = isWordmark ? '0 0 160 32' : '0 0 32 32';
  const width = isWordmark ? Math.round(size * (160 / 32)) : size;

  const a11y = decorative
    ? { 'aria-hidden': 'true', focusable: 'false' }
    : { role: 'img', 'aria-label': title };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={size}
      className={className}
      {...a11y}
      {...rest}
    >
      {!decorative && <title>{title}</title>}
      <rect width="32" height="32" rx="8" fill={color} />
      <path d="M16 6 L24 13 L16 20 L8 13 Z" fill={accent} fillOpacity="0.95" />
      <path d="M16 14 L24 21 L16 28 L8 21 Z" fill={accent} fillOpacity="0.6" />
      {isWordmark && (
        <>
          <text
            x="42"
            y="22"
            fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            fontSize="18"
            fontWeight="700"
            letterSpacing="-0.01em"
            fill={color}
          >
            Lumen
          </text>
          <text
            x="105"
            y="22"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="13"
            fontWeight="500"
            letterSpacing="0.12em"
            fill={color}
            fillOpacity="0.55"
          >
            LMS
          </text>
        </>
      )}
    </svg>
  );
}

export default Logo;
