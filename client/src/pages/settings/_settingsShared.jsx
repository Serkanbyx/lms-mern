/**
 * Shared building blocks for the auto-saving settings pages
 * (Appearance, Privacy, Notifications, Playback).
 *
 *  - `useAutoSaveIndicator()` + `<AutoSaveIndicator />` give every
 *    page a consistent "Saving… → Saved" badge synced to the
 *    ~600 ms debounce window of `PreferencesContext`.
 *  - `<SettingsRow />` is the canonical label-on-the-left,
 *    control-on-the-right layout used by every preference toggle.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Icon } from '../../components/ui/index.js';
import { cn } from '../../utils/cn.js';

const SAVING_DELAY_MS = 600;
const SAVED_VISIBLE_MS = 2000;

export const useAutoSaveIndicator = () => {
  const [status, setStatus] = useState('idle');
  const savingTimerRef = useRef(null);
  const savedTimerRef = useRef(null);

  const clearTimers = () => {
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savingTimerRef.current = null;
    savedTimerRef.current = null;
  };

  const markChanged = useCallback(() => {
    clearTimers();
    setStatus('saving');
    savingTimerRef.current = setTimeout(() => {
      setStatus('saved');
      savedTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, SAVED_VISIBLE_MS);
    }, SAVING_DELAY_MS);
  }, []);

  useEffect(() => clearTimers, []);

  return { status, markChanged };
};

export function AutoSaveIndicator({ status, className }) {
  if (status === 'idle') {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block h-5 w-20', className)}
      />
    );
  }

  const isSaving = status === 'saving';
  const label = isSaving ? 'Saving…' : 'Saved';
  const iconName = isSaving ? 'Loader2' : 'CheckCircle2';

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        isSaving ? 'text-text-muted' : 'text-success',
        className,
      )}
    >
      <Icon
        name={iconName}
        size={14}
        className={isSaving ? 'animate-spin' : undefined}
      />
      {label}
    </span>
  );
}

export function SettingsRow({ label, description, children }) {
  return (
    <section className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
      <div>
        <h3 className="text-sm font-medium text-text">{label}</h3>
        {description && (
          <p className="text-xs text-text-muted mt-1">{description}</p>
        )}
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </section>
  );
}

export function SegmentedControl({ name, value, onChange, options }) {
  const baseId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex rounded-lg border border-border-strong bg-bg p-0.5"
    >
      {options.map((option) => {
        const id = `${baseId}-${option.value}`;
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              selected
                ? 'bg-primary text-primary-fg shadow-xs'
                : 'text-text-muted hover:text-text',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon && <Icon name={option.icon} size={14} />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
