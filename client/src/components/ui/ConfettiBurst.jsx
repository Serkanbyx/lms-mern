/**
 * `ConfettiBurst` — one-shot CSS-only celebratory confetti.
 *
 * Pure CSS keyframes (declared in `index.css` as `@keyframes confettiFall`)
 * generate ~28 colored chips that fall from above the viewport with a
 * random horizontal drift and rotation. No JS animation loop, no
 * framer-motion, no canvas — the cheapest possible "yay you did it!"
 * moment.
 *
 * Reduced-motion guard:
 *   The CSS already collapses every animation to `0.01ms` under the
 *   `prefers-reduced-motion: reduce` media query (see `index.css`), so
 *   the confetti effectively turns into an invisible no-op for users
 *   who opt out. Callers don't need to gate it themselves.
 *
 * Lifecycle:
 *   The burst is meant to be remounted (via `key={Date.now()}`) every
 *   time you want it to fire. After ~3s it calls `onDone` so the parent
 *   can unmount it and free the DOM nodes.
 *
 * Usage:
 *   ```jsx
 *   const [burstKey, setBurstKey] = useState(null);
 *   // … on success
 *   setBurstKey(Date.now());
 *   // …
 *   {burstKey && (
 *     <ConfettiBurst key={burstKey} onDone={() => setBurstKey(null)} />
 *   )}
 *   ```
 */

import { useEffect, useMemo } from 'react';

const CONFETTI_COLORS = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-danger)',
];

const DEFAULT_PIECE_COUNT = 28;
const DEFAULT_DURATION_MS = 3000;

export function ConfettiBurst({
  pieces = DEFAULT_PIECE_COUNT,
  durationMs = DEFAULT_DURATION_MS,
  onDone,
}) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        x: `${Math.round((Math.random() - 0.5) * 200)}px`,
        rot: `${Math.round(360 + Math.random() * 720)}deg`,
        delay: `${Math.random() * 0.4}s`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [pieces],
  );

  useEffect(() => {
    if (!onDone) return undefined;
    const id = setTimeout(() => onDone(), durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onDone]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-120 overflow-hidden"
    >
      {items.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block animate-confetti rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.5,
            background: piece.color,
            animationDelay: piece.delay,
            '--confetti-x': piece.x,
            '--confetti-rot': piece.rot,
          }}
        />
      ))}
    </div>
  );
}

export default ConfettiBurst;
