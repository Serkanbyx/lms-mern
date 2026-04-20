import * as LucideIcons from 'lucide-react';

/**
 * Single icon entry-point for the entire app.
 *
 * Why this wrapper exists:
 *  - Enforces a consistent size + stroke-width across every icon in the UI
 *    (no mixed icon libraries, no off-spec sizes).
 *  - Lets us pass icons by string name (`<Icon name="Search" />`), which keeps
 *    component props serializable and grep-friendly.
 *  - Defaults to `aria-hidden` because most icons sit beside a visible text
 *    label; pass `label` to expose the icon as a standalone, labeled image
 *    (e.g., icon-only buttons must provide one).
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className = '',
  label,
  ...rest
}) {
  const Component = LucideIcons[name];

  if (!Component) {
    if (import.meta.env?.DEV) {
      console.warn(`[Icon] Unknown lucide icon: "${name}".`);
    }
    return null;
  }

  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', focusable: 'false' };

  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      {...a11y}
      {...rest}
    />
  );
}

export default Icon;
