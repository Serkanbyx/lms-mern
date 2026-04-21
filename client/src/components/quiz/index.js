/**
 * Single import surface for quiz-feature components.
 *
 * Quiz-specific UI (option cards, countdown chips, review accordions)
 * lives next to the page that consumes it. Pages should import from
 * `@/components/quiz` (or the relative path) so the public surface
 * stays grep-friendly and renames are one-line changes.
 */

export { SelectableCard } from './SelectableCard.jsx';
