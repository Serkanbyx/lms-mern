/**
 * `Pagination` — page-number navigation that preserves URL state.
 *
 * Computes a windowed list of page numbers around the current page so the
 * control stays compact (1 … 4 5 [6] 7 8 … 99) and never overflows the
 * row. Calls `onPageChange(nextPage)` for parent-driven URL updates.
 *
 * The whole control is wrapped in `<nav aria-label="Pagination">` and each
 * page button has `aria-current="page"` when active for assistive tech.
 */

import { cn } from '../../utils/cn.js';
import { Button } from './Button.jsx';
import { IconButton } from './IconButton.jsx';
import { Icon } from './Icon.jsx';

const buildPageList = (current, total, siblings = 1) => {
  const pages = new Set([1, total]);
  for (let p = current - siblings; p <= current + siblings; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
};

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  className,
}) {
  if (!pageCount || pageCount < 2) return null;
  const list = buildPageList(page, pageCount, siblings);

  const go = (next) => {
    if (next < 1 || next > pageCount || next === page) return;
    onPageChange?.(next);
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <IconButton
        aria-label="Previous page"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
      >
        <Icon name="ChevronLeft" size={16} />
      </IconButton>
      {list.map((entry, index) =>
        entry === '…' ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="px-2 text-text-subtle"
          >
            …
          </span>
        ) : (
          <Button
            key={entry}
            size="sm"
            variant={entry === page ? 'primary' : 'ghost'}
            aria-current={entry === page ? 'page' : undefined}
            aria-label={`Page ${entry}`}
            onClick={() => go(entry)}
            className="min-w-9"
          >
            {entry}
          </Button>
        ),
      )}
      <IconButton
        aria-label="Next page"
        onClick={() => go(page + 1)}
        disabled={page >= pageCount}
      >
        <Icon name="ChevronRight" size={16} />
      </IconButton>
    </nav>
  );
}

export default Pagination;
