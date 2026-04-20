/**
 * `FormField` — wraps a label + control + helper/error in a consistent
 * vertical stack. Pages compose this with any input primitive so spacing,
 * typography, and ARIA wiring stay identical across the entire app.
 *
 * Pattern:
 *   <FormField label="Email" error={errors.email} helper="We'll never share it">
 *     {(props) => <Input type="email" {...props} />}
 *   </FormField>
 *
 * The render-prop receives `{ id, 'aria-describedby', 'aria-invalid' }` so
 * the input is correctly linked to its label and to the helper/error message.
 * Plain children (non-function) are rendered as-is for cases where the
 * caller already controls the wiring (e.g., custom widgets).
 */

import { useId } from 'react';
import { cn } from '../../utils/cn.js';

export function FormField({
  label,
  helper,
  error,
  required = false,
  hideLabel = false,
  className,
  children,
  htmlFor,
}) {
  const generatedId = useId();
  const id = htmlFor ?? `field-${generatedId}`;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  const controlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-text',
            hideLabel && 'sr-only',
          )}
        >
          {label}
          {required && (
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {typeof children === 'function' ? children(controlProps) : children}

      {helper && !error && (
        <p id={helperId} className="text-xs text-text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
