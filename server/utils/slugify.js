/**
 * Centralized slug generator.
 *
 * Wrapping the third-party `slugify` package gives us a single place to:
 *   - enforce platform-wide options (lowercase, strict ASCII, hyphen separator)
 *   - swap implementations later without touching every model/controller
 *   - guarantee deterministic, URL-safe output for slugs that hit the unique
 *     index on `Course.slug` (and any future sluggable resource)
 *
 * `strict: true` strips every char that isn't `[a-zA-Z0-9-]`, which kills
 * accent / emoji / punctuation attacks on routes built from user input.
 */

import slugifyLib from 'slugify';

const DEFAULT_OPTIONS = Object.freeze({
  lower: true,
  strict: true,
  trim: true,
  locale: 'en',
  replacement: '-',
});

export function slugify(input, overrides = {}) {
  if (typeof input !== 'string' || input.trim().length === 0) return '';
  return slugifyLib(input, { ...DEFAULT_OPTIONS, ...overrides });
}

export default slugify;
