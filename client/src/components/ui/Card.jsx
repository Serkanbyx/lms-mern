/**
 * `Card` — surface container with consistent padding, border, shadow, and
 * optional hover lift. Used everywhere a list item, dashboard tile, or
 * panel needs to feel "raised" off the page background.
 *
 * `interactive` adds the hover lift + cursor and is meant for cards that
 * also receive an `onClick` or wrap a `<Link>`. We do NOT make the card
 * itself a button — the click-target should be a real anchor/button inside
 * (a "card-as-link" pattern with `::after` overlays is the typical play).
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';

const PADDING = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export const Card = forwardRef(function Card(
  {
    as: Component = 'div',
    padding = 'md',
    interactive = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={cn(
        'bg-bg-subtle border border-border rounded-xl shadow-xs',
        'transition-all duration-200 ease-out',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-border-strong',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Card;
