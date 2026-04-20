/**
 * `Button` — primary clickable primitive.
 *
 * Variants encode intent (primary action vs. destructive vs. quiet ghost) so
 * pages never reach for raw colors. Sizes match the spacing scale tokens, and
 * an icon-only `size="icon"` keeps the square hit-target consistent.
 *
 * Behavior:
 *   - `loading` swaps the leading icon for a `Spinner`, disables the button,
 *     and adds `aria-busy` so assistive tech announces the pending state.
 *   - `disabled` and `loading` both block clicks; the visual cursor reflects it.
 *   - Forwards `ref` so it can be focused programmatically (focus traps,
 *     menu controllers, form submissions).
 *
 * Accessibility:
 *   - Always rendered as a real `<button>` (or `<a>` when `as="a"`) so it
 *     keeps the native keyboard activation and focus ring.
 *   - When `loading`, the button label remains visible — never replaced by
 *     "Loading..." — to preserve context for keyboard / screen reader users.
 */

import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';
import { Spinner } from './Spinner.jsx';

const VARIANT_CLASSES = {
  primary:
    'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs hover:shadow-md active:scale-[0.98]',
  secondary:
    'bg-bg-muted text-text hover:bg-border border border-border active:scale-[0.98]',
  outline:
    'bg-transparent text-text border border-border-strong hover:bg-bg-muted active:scale-[0.98]',
  ghost:
    'bg-transparent text-text hover:bg-bg-muted active:scale-[0.98]',
  danger:
    'bg-danger text-white hover:opacity-90 shadow-xs active:scale-[0.98]',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto shadow-none',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-base gap-2 rounded-lg',
  icon: 'h-10 w-10 p-0 rounded-lg',
};

export const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    type,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isButton = Component === 'button';
  const isDisabled = disabled || loading;

  return (
    <Component
      ref={ref}
      type={isButton ? type ?? 'button' : undefined}
      disabled={isButton ? isDisabled : undefined}
      aria-disabled={!isButton ? isDisabled || undefined : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-all duration-200 ease-out select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'sm' : 'xs'} aria-hidden="true" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </Component>
  );
});

export default Button;
