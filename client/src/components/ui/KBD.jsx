/**
 * `KBD` — renders a keyboard-shortcut hint chip ("⌘K", "Esc", "/").
 * Uses a real `<kbd>` so assistive tech announces it as a key.
 */

import { cn } from '../../utils/cn.js';

export function KBD({ children, className, ...rest }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-6 h-5 px-1.5',
        'rounded border border-border-strong bg-bg-muted text-[11px] font-mono text-text-muted',
        'shadow-xs',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

export default KBD;
