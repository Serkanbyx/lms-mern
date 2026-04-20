/**
 * `Alert` — inline informational / status block (info / success / warning /
 * danger). Shown above forms, beside fields, in dashboards. Optionally
 * dismissable via the close button (caller controls visibility through
 * `onDismiss`).
 *
 * Renders as `role="alert"` for danger/warning (assertive announcement)
 * and `role="status"` (polite) for info/success — matching WCAG 4.1.3
 * guidance.
 */

import { cn } from '../../utils/cn.js';
import { Icon } from './Icon.jsx';
import { IconButton } from './IconButton.jsx';

const VARIANTS = {
  info: {
    icon: 'Info',
    classes: 'bg-info/10 border-info/30 text-info',
    role: 'status',
  },
  success: {
    icon: 'CheckCircle2',
    classes: 'bg-success/10 border-success/30 text-success',
    role: 'status',
  },
  warning: {
    icon: 'AlertTriangle',
    classes: 'bg-warning/10 border-warning/30 text-warning',
    role: 'alert',
  },
  danger: {
    icon: 'AlertOctagon',
    classes: 'bg-danger/10 border-danger/30 text-danger',
    role: 'alert',
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className,
  ...rest
}) {
  const meta = VARIANTS[variant];

  return (
    <div
      role={meta.role}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3.5',
        meta.classes,
        className,
      )}
      {...rest}
    >
      <Icon name={meta.icon} size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm text-text">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        {children && <div className="text-text-muted">{children}</div>}
      </div>
      {onDismiss && (
        <IconButton
          aria-label="Dismiss"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="-mr-1 -mt-1 h-7 w-7 text-current"
        >
          <Icon name="X" size={14} />
        </IconButton>
      )}
    </div>
  );
}

export default Alert;
