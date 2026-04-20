/**
 * `EmptyState` — used wherever a list is empty (no enrolments, no search
 * results, no pending courses). Always show:
 *   1. An illustration / icon (visual anchor)
 *   2. A clear title (what's missing)
 *   3. A short description (why or what to do)
 *   4. An optional CTA (the next best action)
 *
 * Centralising this prevents the scattered "No data." text strings that
 * make a product feel half-finished.
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';

export function EmptyState({
  icon = 'Inbox',
  title,
  description,
  action,
  size = 'md',
  className,
}) {
  const padding = size === 'sm' ? 'py-8' : size === 'lg' ? 'py-20' : 'py-14';
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 56 : 44;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        padding,
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-bg-muted text-text-subtle"
      >
        {typeof icon === 'string' ? <Icon name={icon} size={iconSize} /> : icon}
      </div>
      {title && (
        <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-text-muted max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
