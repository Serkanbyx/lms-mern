/**
 * `Banner` — full-width announcement bar mounted at the top of a layout
 * (rejected-course notice, planned-maintenance warning, "verify your email"
 * CTA). Spans the viewport edge-to-edge unlike `Alert`, which is inline.
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';
import { IconButton } from './IconButton.jsx';

const VARIANTS = {
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  primary: 'bg-primary/10 text-primary border-primary/30',
};

const ICONS = {
  info: 'Info',
  success: 'CheckCircle2',
  warning: 'AlertTriangle',
  danger: 'AlertOctagon',
  primary: 'Megaphone',
};

export function Banner({
  variant = 'info',
  icon,
  children,
  action,
  onDismiss,
  className,
  ...rest
}) {
  return (
    <div
      role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
      className={cn(
        'w-full border-b py-2.5 px-4',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Icon name={icon ?? ICONS[variant]} size={18} className="shrink-0" />
        <div className="flex-1 text-sm text-text">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
        {onDismiss && (
          <IconButton
            aria-label="Dismiss banner"
            onClick={onDismiss}
            className="h-7 w-7 text-current"
          >
            <Icon name="X" size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

export default Banner;
