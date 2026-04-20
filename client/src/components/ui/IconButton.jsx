/**
 * `IconButton` — square button for icon-only actions.
 *
 * Wraps `Button` with `size="icon"` and enforces an `aria-label` so the
 * action is announced to screen readers (without it, the button is silent).
 * Use this whenever the only child is an icon — a regular `Button` with an
 * icon and no text is an accessibility footgun.
 */

import { forwardRef } from 'react';
import { Button } from './Button.jsx';

export const IconButton = forwardRef(function IconButton(
  { 'aria-label': ariaLabel, variant = 'ghost', children, ...rest },
  ref,
) {
  if (import.meta.env?.DEV && !ariaLabel) {
    console.warn('[IconButton] Missing required `aria-label` prop.');
  }

  return (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </Button>
  );
});

export default IconButton;
