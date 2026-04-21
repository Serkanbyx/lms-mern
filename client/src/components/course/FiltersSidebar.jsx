/**
 * `FiltersSidebar` — controlled filter panel for the catalog page.
 *
 * The component is **stateless about persistence**: it never reads or
 * writes the URL itself. Instead it receives a parsed `filters` object
 * and a single `onChange(patch)` callback from the parent page, which
 * is the only place that knows about `useSearchParams`. That keeps:
 *
 *   - the URL contract in exactly one file (`CourseCatalogPage`),
 *   - this panel renderable inside both the desktop sticky column and
 *     the mobile bottom sheet without behaviour drift, and
 *   - the panel trivially testable — give it props, assert callbacks.
 *
 * Search input: the parent owns the debounced text → URL flow; this
 * panel exposes a controlled `Input` and surfaces every keystroke
 * upstream so the debounce can stay in one well-known location.
 */

import { Badge, Button, Checkbox, Icon, Input, Slider } from '../ui/index.js';
import { CATEGORIES, DURATION_BUCKETS, LEVELS, PRICE_LIMITS } from './filterConstants.js';
import { cn } from '../../utils/cn.js';

const PRICE_MODES = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export function FiltersSidebar({
  filters,
  onChange,
  onReset,
  onSearchChange,
  searchValue,
  className,
}) {
  const toggleArrayValue = (key, value) => {
    const current = filters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    onChange({ [key]: next });
  };

  const setPriceMode = (mode) => {
    onChange({
      priceMode: mode,
      priceMin: PRICE_LIMITS.min,
      priceMax: PRICE_LIMITS.max,
    });
  };

  const setDurationBucket = (bucketId) => {
    const next = filters.duration === bucketId ? null : bucketId;
    onChange({ duration: next });
  };

  return (
    <aside
      aria-label="Course filters"
      className={cn('flex flex-col gap-7 text-sm', className)}
    >
      <FilterSection title="Search" htmlForId="filter-search">
        <Input
          id="filter-search"
          type="search"
          placeholder="Search courses…"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          leadingIcon={<Icon name="Search" size={16} />}
          trailingIcon={
            searchValue ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange('')}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full
                  text-text-muted hover:bg-bg-muted hover:text-text
                  focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon name="X" size={12} />
              </button>
            ) : null
          }
        />
      </FilterSection>

      <FilterSection title="Category">
        <ul className="space-y-2">
          {CATEGORIES.map((category) => {
            const checked = (filters.categories ?? []).includes(category.id);
            // NOTE — Checkbox already renders its own <label> wrapping the
            // input + visual box. Wrapping it again in another <label> would
            // create a nested label which:
            //   1. Doubles the accessible name ("Programming Programming"),
            //   2. Causes some browsers to fire two click events and toggle
            //      the checkbox twice, netting to no change,
            //   3. Triggers test tooling to flag the visible <span> as a
            //      non-interactive intercept target.
            // Using a plain <div> for the row layout keeps the count badge
            // adjacent without layering interactivity.
            return (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3"
              >
                <Checkbox
                  label={category.label}
                  checked={checked}
                  onChange={() => toggleArrayValue('categories', category.id)}
                />
                {typeof category.count === 'number' && (
                  <span className="text-xs text-text-subtle tabular-nums">
                    {category.count}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </FilterSection>

      <FilterSection title="Level">
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((level) => {
            const active = (filters.levels ?? []).includes(level.id);
            return (
              <button
                key={level.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleArrayValue('levels', level.id)}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium',
                  'transition-colors duration-150',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-strong bg-bg text-text-muted hover:bg-bg-muted',
                )}
              >
                {level.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Price">
        <div
          role="radiogroup"
          aria-label="Price mode"
          className="inline-flex w-full rounded-lg border border-border bg-bg-muted p-1"
        >
          {PRICE_MODES.map((mode) => {
            const active = (filters.priceMode ?? 'all') === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPriceMode(mode.value)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-bg text-text shadow-xs'
                    : 'text-text-muted hover:text-text',
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {filters.priceMode !== 'free' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{formatCurrency(filters.priceMin ?? PRICE_LIMITS.min)}</span>
              <span>up to {formatCurrency(filters.priceMax ?? PRICE_LIMITS.max)}</span>
            </div>
            <Slider
              min={PRICE_LIMITS.min}
              max={PRICE_LIMITS.max}
              step={5}
              value={filters.priceMax ?? PRICE_LIMITS.max}
              onChange={(value) =>
                onChange({
                  priceMode: filters.priceMode === 'free' ? 'all' : filters.priceMode ?? 'all',
                  priceMax: value,
                })
              }
              showValue={false}
              aria-label="Maximum price"
            />
          </div>
        )}
      </FilterSection>

      <FilterSection title="Duration">
        <div className="flex flex-wrap gap-2">
          {DURATION_BUCKETS.map((bucket) => {
            const active = filters.duration === bucket.id;
            return (
              <button
                key={bucket.id}
                type="button"
                aria-pressed={active}
                onClick={() => setDurationBucket(bucket.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium',
                  'transition-colors duration-150',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-strong bg-bg text-text-muted hover:bg-bg-muted',
                )}
              >
                <Icon name="Clock" size={14} />
                {bucket.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <Button
        type="button"
        variant="link"
        onClick={onReset}
        className="self-start"
        leftIcon={<Icon name="RotateCcw" size={14} />}
      >
        Reset all filters
      </Button>
    </aside>
  );
}

const FilterSection = ({ title, children, htmlForId }) => (
  <section className="space-y-3">
    {htmlForId ? (
      <label
        htmlFor={htmlForId}
        className="text-xs font-semibold uppercase tracking-wide text-text-subtle"
      >
        {title}
      </label>
    ) : (
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
        {title}
      </h3>
    )}
    {children}
  </section>
);

/**
 * Convenience helper used by the catalog page for the mobile sheet
 * trigger — keeps the badge count rendering identical to whatever the
 * sidebar considers a "filter" without exposing internals.
 */
export const ActiveFiltersBadge = ({ count, className }) => {
  if (!count) return null;
  return (
    <Badge variant="primary" className={className}>
      {count}
    </Badge>
  );
};

export default FiltersSidebar;
