/**
 * `ActiveFilterChips` — removable summary of every active filter.
 *
 * Sits above the catalog grid so a user always knows why the result
 * count just changed. Each chip removes a single filter dimension on
 * click; clearing the last chip is equivalent to "Reset all filters".
 *
 * Like `FiltersSidebar`, this component is purely presentational —
 * the parent page owns the URL and is the only place that mutates
 * search params. We just emit `onRemove(patch)` calls describing
 * the field(s) to clear.
 */

import { Badge, Button, Icon } from '../ui/index.js';
import {
  CATEGORY_LABELS,
  DEFAULT_PRICE_MODE,
  DURATION_LABELS,
  LEVEL_LABELS,
  PRICE_LIMITS,
} from './filterConstants.js';
import { cn } from '../../utils/cn.js';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export function ActiveFilterChips({ filters, search, onRemove, onReset, className }) {
  const chips = buildChipList({ filters, search });
  if (chips.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Active filters"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {chips.map((chip) => (
        <Chip key={chip.id} chip={chip} onRemove={() => onRemove(chip.patch)} />
      ))}
      {chips.length > 1 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onReset}
          className="text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

const Chip = ({ chip, onRemove }) => (
  <span role="listitem" className="inline-flex">
    <Badge
      variant="primary"
      className="gap-1.5 pr-1 pl-2 h-7 text-xs"
    >
      <span>{chip.label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${chip.label}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full
          text-primary/70 hover:bg-primary/10 hover:text-primary
          focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="X" size={12} />
      </button>
    </Badge>
  </span>
);

const buildChipList = ({ filters, search }) => {
  const chips = [];

  if (search?.trim()) {
    chips.push({
      id: 'search',
      label: `“${search.trim()}”`,
      patch: { search: '' },
    });
  }

  for (const id of filters.categories ?? []) {
    chips.push({
      id: `category-${id}`,
      label: CATEGORY_LABELS[id] ?? id,
      patch: {
        categories: (filters.categories ?? []).filter((entry) => entry !== id),
      },
    });
  }

  for (const id of filters.levels ?? []) {
    chips.push({
      id: `level-${id}`,
      label: LEVEL_LABELS[id] ?? id,
      patch: {
        levels: (filters.levels ?? []).filter((entry) => entry !== id),
      },
    });
  }

  if (filters.priceMode && filters.priceMode !== DEFAULT_PRICE_MODE) {
    chips.push({
      id: 'priceMode',
      label: filters.priceMode === 'free' ? 'Free only' : 'Paid only',
      patch: { priceMode: DEFAULT_PRICE_MODE },
    });
  }

  if (
    typeof filters.priceMax === 'number' &&
    filters.priceMax < PRICE_LIMITS.max &&
    filters.priceMode !== 'free'
  ) {
    chips.push({
      id: 'priceMax',
      label: `Under ${formatCurrency(filters.priceMax)}`,
      patch: { priceMax: PRICE_LIMITS.max },
    });
  }

  if (filters.duration) {
    chips.push({
      id: 'duration',
      label: DURATION_LABELS[filters.duration] ?? filters.duration,
      patch: { duration: null },
    });
  }

  return chips;
};

/** Count of active filter dimensions — used by the mobile sheet trigger badge. */
export const countActiveFilters = ({ filters, search }) => {
  let count = 0;
  if (search?.trim()) count += 1;
  count += (filters.categories ?? []).length;
  count += (filters.levels ?? []).length;
  if (filters.priceMode && filters.priceMode !== DEFAULT_PRICE_MODE) count += 1;
  if (
    typeof filters.priceMax === 'number' &&
    filters.priceMax < PRICE_LIMITS.max &&
    filters.priceMode !== 'free'
  ) {
    count += 1;
  }
  if (filters.duration) count += 1;
  return count;
};

export default ActiveFilterChips;
