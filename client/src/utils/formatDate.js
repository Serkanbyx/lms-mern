/**
 * Date formatting helpers shared across pages.
 *
 * Two named exports:
 *  - `formatDate`        — short locale-aware "Apr 21, 2026" style.
 *  - `formatRelativeTime` — "just now / 5 min ago / 3 days ago / Apr 21".
 *
 * Both are tolerant of `null`, `undefined`, and invalid inputs (return a
 * single em-dash) so dashboards never render `NaN` or "Invalid Date" when
 * a backend payload is missing a timestamp.
 *
 * `formatRelativeTime` uses the native `Intl.RelativeTimeFormat` API so we
 * avoid bundling a date library purely for "n days ago" strings. Any value
 * older than 30 days falls back to the absolute short date — beyond that
 * window relative time is more confusing than helpful.
 */

const DEFAULT_LOCALE = undefined; // honours the user's browser locale

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
  numeric: 'auto',
  style: 'long',
});

const toDate = (value) => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatDate = (value, { withTime = false } = {}) => {
  const date = toDate(value);
  if (!date) return '—';
  return (withTime ? dateTimeFormatter : dateFormatter).format(date);
};

const RELATIVE_THRESHOLDS = [
  { unit: 'second', divisor: 1, max: 60 },
  { unit: 'minute', divisor: 60, max: 60 },
  { unit: 'hour', divisor: 60 * 60, max: 24 },
  { unit: 'day', divisor: 60 * 60 * 24, max: 30 },
];

export const formatRelativeTime = (value, { now = Date.now() } = {}) => {
  const date = toDate(value);
  if (!date) return '—';

  const diffMs = date.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) return 'just now';

  for (const { unit, divisor, max } of RELATIVE_THRESHOLDS) {
    const value = diffSeconds / divisor;
    if (Math.abs(value) < max) {
      return relativeFormatter.format(Math.round(value), unit);
    }
  }

  return dateFormatter.format(date);
};

export default { formatDate, formatRelativeTime };
