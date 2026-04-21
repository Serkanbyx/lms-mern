/**
 * i18n scaffold (English-only for v1).
 *
 * The client ships in a single language today, but every user-facing
 * string flows through `react-i18next`'s `t()` so adding a second
 * locale becomes a translation file (`tr.json`, `de.json`, …) rather
 * than a refactor across hundreds of components.
 *
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <h1>{t('catalog.empty')}</h1>
 *
 * Conventions:
 *  - Keys are dot-namespaced by feature (`auth.*`, `catalog.*`,
 *    `quiz.*`). New screens add their own namespace block to keep
 *    `en.json` browseable.
 *  - Plurals use the `_plural` suffix that i18next understands
 *    natively (`{{count}} lesson` / `{{count}} lessons`).
 *  - NEVER concatenate translated fragments — pass interpolation
 *    placeholders so word order can be flipped per locale.
 *
 * Bundle cost: i18next + react-i18next ≈ 14 KB gzip with the
 * single-file resource bundle below. Acceptable for the scaffold;
 * lazy-load namespace files if a future locale adds noticeable bulk.
 *
 * `escapeValue: false` is intentional — React already escapes the
 * interpolated values it renders, so re-escaping inside i18next
 * would double-encode entities.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  // Turn off "missing key" warnings in production logs — the warn-only
  // ESLint rule (`eslint-plugin-i18next`) is the dev-time safety net.
  saveMissing: false,
  returnNull: false,
});

export default i18n;
