/**
 * Course catalog — `/courses`
 *
 * Two-column desktop (sticky `FiltersSidebar` + `CoursesGrid`); on mobile
 * the filters live in a bottom `Sheet` opened by a "Filters · N" pill.
 *
 * URL is the single source of truth
 * --------------------------------
 * Every filter, the search query, the sort and the page number live in
 * `useSearchParams`. That gives us:
 *   - Shareable URLs (`/courses?category=design,programming&level=beginner`).
 *   - Free browser back/forward navigation between filter states.
 *   - No duplicated React state to keep in sync with the address bar.
 *
 * The page reads the params once into a memoised `filters` object,
 * renders, and writes back through `updateFilters(patch)` — a single
 * small helper that handles defaults (drop the param when it's the
 * default) and resets pagination to page 1 on every filter change so
 * users never end up on an empty "page 7 of 1".
 *
 * Search is debounced 400ms locally so we don't hammer `/api/courses`
 * on every keystroke; the debounced text then flows back into the
 * URL through the same `updateFilters` helper.
 *
 * Each render the page derives a single API request from the current
 * URL, fires it, and renders one of: loading skeletons, error alert,
 * empty state, or the result grid + pagination. A request counter
 * guards against out-of-order responses (an older slow request never
 * overwrites a newer fresh one).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  ActiveFilterChips,
  ActiveFiltersBadge,
  CoursesGrid,
  DEFAULT_PRICE_MODE,
  DEFAULT_SORT,
  FiltersSidebar,
  PRICE_LIMITS,
  SORT_OPTIONS,
  countActiveFilters,
  findDurationBucket,
} from '../../components/course/index.js';
import { Button, Icon, Pagination, Select, Sheet } from '../../components/ui/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { listCourses } from '../../services/course.service.js';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

const parseList = (value) =>
  typeof value === 'string' && value.length > 0
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFiltersFromParams = (params) => {
  const priceModeRaw = params.get('priceMode');
  const priceMode = ['free', 'paid'].includes(priceModeRaw)
    ? priceModeRaw
    : DEFAULT_PRICE_MODE;

  const priceMax = parseNumber(params.get('priceMax'), PRICE_LIMITS.max);
  const priceMin = parseNumber(params.get('priceMin'), PRICE_LIMITS.min);

  return {
    search: params.get('search') ?? '',
    categories: parseList(params.get('category')),
    levels: parseList(params.get('level')),
    priceMode,
    priceMin: Math.max(PRICE_LIMITS.min, priceMin),
    priceMax: Math.min(PRICE_LIMITS.max, priceMax),
    duration: params.get('duration') || null,
    sort:
      SORT_OPTIONS.some((option) => option.value === params.get('sort'))
        ? params.get('sort')
        : DEFAULT_SORT,
    page: Math.max(1, parseNumber(params.get('page'), 1)),
  };
};

/**
 * Translate the merged filter object back into URL params, dropping any
 * key that matches its default. We never persist defaults — they belong
 * to the schema, not to the address bar — which keeps shared URLs
 * pleasantly short and human-readable.
 */
const filtersToParams = (filters) => {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.categories?.length) params.set('category', filters.categories.join(','));
  if (filters.levels?.length) params.set('level', filters.levels.join(','));
  if (filters.priceMode && filters.priceMode !== DEFAULT_PRICE_MODE) {
    params.set('priceMode', filters.priceMode);
  }
  if (filters.priceMode !== 'free' && filters.priceMax < PRICE_LIMITS.max) {
    params.set('priceMax', String(filters.priceMax));
  }
  if (filters.duration) params.set('duration', filters.duration);
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
};

/**
 * Build the API query from the current filter state. The server speaks
 * `category` / `level` (comma-separated), `minPrice` / `maxPrice`,
 * `priceMode`, `minDuration` / `maxDuration` (minutes), `sort`, `page`,
 * `limit`. Any filter equal to its default is omitted.
 */
const buildApiQuery = (filters) => {
  const query = {
    sort: filters.sort,
    page: filters.page,
    limit: PAGE_SIZE,
  };

  if (filters.search?.trim()) query.search = filters.search.trim();
  if (filters.categories.length) query.category = filters.categories.join(',');
  if (filters.levels.length) query.level = filters.levels.join(',');

  if (filters.priceMode === 'free') {
    query.priceMode = 'free';
  } else {
    if (filters.priceMode === 'paid') query.priceMode = 'paid';
    if (filters.priceMax < PRICE_LIMITS.max) query.maxPrice = filters.priceMax;
  }

  const bucket = findDurationBucket(filters.duration);
  if (bucket) {
    if (bucket.min !== null && bucket.min !== undefined) query.minDuration = bucket.min;
    if (bucket.max !== null && bucket.max !== undefined) query.maxDuration = bucket.max;
  }

  return query;
};

export default function CourseCatalogPage() {
  useDocumentTitle('Browse courses');

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);

  // Local search input — kept separate from the debounced URL value so
  // typing feels instant even though we only fetch every 400ms.
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const debouncedSearch = useDebounce(searchDraft, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setSearchDraft(filters.search);
    // We deliberately depend on the URL value only — re-syncing the input
    // when the URL changes (e.g. browser back, chip removal) keeps the
    // input in lockstep without entering an infinite update loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const updateParams = useCallback(
    (patch) => {
      const merged = { ...filters, ...patch };
      // Any change other than pure pagination resets to page 1 so the
      // user never lands on an out-of-range page after narrowing.
      if (!('page' in patch)) merged.page = 1;
      setSearchParams(filtersToParams(merged), { replace: true });
    },
    [filters, setSearchParams],
  );

  // Fold debounced search back into the URL the moment it stops changing.
  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    updateParams({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, updateParams]);

  const resetFilters = useCallback(() => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const goToPage = useCallback(
    (next) => {
      updateParams({ page: next });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [updateParams],
  );

  const [data, setData] = useState({
    status: 'loading',
    items: [],
    total: 0,
    totalPages: 1,
    error: null,
  });

  // Out-of-order guard: every fetch increments this counter; a response
  // is committed to state only if it was the last one we kicked off.
  const requestId = useRef(0);

  const apiQuery = useMemo(() => buildApiQuery(filters), [filters]);

  const fetchCourses = useCallback(async () => {
    requestId.current += 1;
    const myId = requestId.current;
    setData((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const payload = await listCourses(apiQuery);
      if (myId !== requestId.current) return;
      const items = payload?.data?.items ?? payload?.items ?? [];
      const total = payload?.data?.total ?? payload?.total ?? items.length;
      const totalPages =
        payload?.data?.totalPages ??
        payload?.totalPages ??
        Math.max(1, Math.ceil(total / PAGE_SIZE));
      setData({ status: 'ready', items, total, totalPages, error: null });
    } catch (error) {
      if (myId !== requestId.current) return;
      setData({
        status: 'error',
        items: [],
        total: 0,
        totalPages: 1,
        error: error?.message ?? 'Could not load courses.',
      });
    }
  }, [apiQuery]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeCount = countActiveFilters({ filters, search: filters.search });

  const sidebar = (
    <FiltersSidebar
      filters={filters}
      searchValue={searchDraft}
      onSearchChange={setSearchDraft}
      onChange={updateParams}
      onReset={resetFilters}
    />
  );

  const showingFrom = data.total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(filters.page * PAGE_SIZE, data.total);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          Browse courses
        </h1>
        <p className="mt-2 max-w-2xl text-text-muted">
          Explore lessons taught by working professionals. Filter by topic, level,
          price or length to find the right path.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        {isDesktop && (
          <div className="sticky top-20 self-start">
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              {sidebar}
            </div>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-text-muted">
              {data.status === 'loading' ? (
                <span>Loading courses…</span>
              ) : data.status === 'ready' ? (
                <span>
                  Showing <strong className="text-text">{showingFrom}</strong>–
                  <strong className="text-text">{showingTo}</strong> of{' '}
                  <strong className="text-text">{data.total}</strong> courses
                </span>
              ) : (
                <span>—</span>
              )}
            </p>

            <div className="flex items-center gap-2">
              {!isDesktop && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Icon name="SlidersHorizontal" size={14} />}
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  Filters
                  <ActiveFiltersBadge count={activeCount} className="ml-2" />
                </Button>
              )}
              <label className="sr-only" htmlFor="catalog-sort">
                Sort courses
              </label>
              <Select
                id="catalog-sort"
                size="sm"
                value={filters.sort}
                onChange={(event) => updateParams({ sort: event.target.value })}
                options={SORT_OPTIONS}
                className="min-w-40"
              />
            </div>
          </div>

          <ActiveFilterChips
            filters={filters}
            search={filters.search}
            onRemove={updateParams}
            onReset={resetFilters}
            className="mb-5"
          />

          <CoursesGrid
            status={data.status}
            items={data.items}
            error={data.error}
            onRetry={fetchCourses}
            onResetFilters={resetFilters}
          />

          {data.status === 'ready' && data.totalPages > 1 && (
            <div className="mt-10">
              <Pagination
                page={filters.page}
                pageCount={data.totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </div>
      </div>

      {!isDesktop && (
        <Sheet
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title="Filters"
          footer={
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setMobileFiltersOpen(false)}>
                Show {data.total} courses
              </Button>
            </div>
          }
        >
          {sidebar}
        </Sheet>
      )}
    </div>
  );
}
