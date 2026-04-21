/**
 * `Divider` — horizontal or vertical separator with an optional centered
 * label ("OR", "Continue with…"). Renders the proper ARIA role automatically:
 * a labeled divider is announced as a separator with that label.
 */

import { cn } from '../../utils/cn.js';

export function Divider({
  orientation = 'horizontal',
  label,
  className,
}) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block w-px self-stretch bg-border', className)}
      />
    );
  }

  if (!label) {
    return (
      <hr
        className={cn('border-0 border-t border-border my-4', className)}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn('flex items-center gap-3 my-4 text-text-subtle', className)}
    >
      <span className="flex-1 h-px bg-border" />
      <span className="text-xs uppercase tracking-wider">{label}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export default Divider;
