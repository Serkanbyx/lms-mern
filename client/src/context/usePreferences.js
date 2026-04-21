/**
 * `usePreferences` — convenience hook for consuming the `PreferencesContext`.
 *
 * Lives in its own module (not the provider file) so React Fast Refresh
 * can keep `PreferencesContext.jsx` as a components-only module,
 * preserving component state across hot reloads.
 */

import { useContext } from 'react';

import PreferencesContext from './PreferencesContext.jsx';

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  }
  return ctx;
};
