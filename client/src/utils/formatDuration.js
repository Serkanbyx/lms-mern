/**
 * Convert a duration in **minutes** into a compact human-readable string.
 *
 * Used by the catalog grid, course detail header and lesson list so a
 * lesson of 65 minutes consistently renders as `1h 5m`, not `65m` in
 * one place and `1.08h` in another.
 *
 * Rules:
 *   - 0 / nullish → `'—'` (em dash). The card is responsible for hiding
 *     the row entirely when no metric makes sense; the formatter never
 *     decides visibility, only how to render whatever it gets.
 *   - < 60 min   → `'45m'`
 *   - exact hour → `'2h'`
 *   - mixed      → `'1h 5m'`
 *   - long total → still hours-only (`'120h'`) — we never roll over
 *     into days because catalog cards optimise for scanability and
 *     learners expect "hours of content".
 */

export const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) {
    return '—';
  }

  const total = Math.max(0, Math.floor(Number(minutes)));
  if (total === 0) return '—';

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export default formatDuration;
