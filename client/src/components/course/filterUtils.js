/**
 * Pure helpers for the course catalog filter state.
 *
 * Lives in its own module (not the chip component) so React Fast
 * Refresh can keep treating `ActiveFilterChips.jsx` as a
 * components-only file.
 */

import { DEFAULT_PRICE_MODE, PRICE_LIMITS } from './filterConstants.js';

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
