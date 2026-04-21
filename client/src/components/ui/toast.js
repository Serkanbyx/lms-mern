/**
 * Brand-styled wrapper around `react-hot-toast`.
 *
 * Single import surface for the rest of the app:
 *   import { toast } from '@/components/ui/toast.js';
 *   toast.success('Saved');
 *
 * Why wrap?
 *   - Pin a single set of `toastOptions` so every notification looks
 *     identical (rounded shape, soft shadow, brand-coloured accents,
 *     `aria-live="polite"` region).
 *   - Re-theme automatically: the toast styling reads CSS custom
 *     properties from `index.css`, so light/dark mode toggles flow
 *     through without re-mounting `<Toaster />`.
 *   - Keep the rest of the codebase decoupled from the underlying
 *     library — if we ever swap to a different toaster, only this file
 *     changes.
 *
 * The single `<Toaster />` mount lives in `main.jsx`.
 */

import baseToast from 'react-hot-toast';

const SHARED_OPTIONS = {
  duration: 4000,
  position: 'top-right',
  ariaProps: {
    role: 'status',
    'aria-live': 'polite',
  },
  style: {
    background: 'var(--color-bg-subtle)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    fontSize: '14px',
    padding: '10px 14px',
    maxWidth: '380px',
  },
};

const VARIANT_OPTIONS = {
  success: {
    iconTheme: {
      primary: 'var(--color-success)',
      secondary: 'var(--color-bg)',
    },
  },
  error: {
    iconTheme: {
      primary: 'var(--color-danger)',
      secondary: 'var(--color-bg)',
    },
  },
  loading: {
    iconTheme: {
      primary: 'var(--color-primary)',
      secondary: 'var(--color-bg)',
    },
  },
};

export const toast = {
  success: (message, options) =>
    baseToast.success(message, {
      ...SHARED_OPTIONS,
      ...VARIANT_OPTIONS.success,
      ...options,
    }),
  error: (message, options) =>
    baseToast.error(message, {
      ...SHARED_OPTIONS,
      ...VARIANT_OPTIONS.error,
      duration: 5000,
      ...options,
    }),
  info: (message, options) =>
    baseToast(message, {
      ...SHARED_OPTIONS,
      icon: 'ℹ',
      ...options,
    }),
  loading: (message, options) =>
    baseToast.loading(message, {
      ...SHARED_OPTIONS,
      ...VARIANT_OPTIONS.loading,
      ...options,
    }),
  promise: (promise, msgs, options) =>
    baseToast.promise(
      promise,
      {
        loading: msgs.loading ?? 'Loading…',
        success: msgs.success ?? 'Done',
        error: msgs.error ?? 'Something went wrong',
      },
      { ...SHARED_OPTIONS, ...options },
    ),
  dismiss: (id) => baseToast.dismiss(id),
  remove: (id) => baseToast.remove(id),
};

export default toast;
