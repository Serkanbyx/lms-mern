/**
 * `useAuth` — convenience hook for consuming the `AuthContext`.
 *
 * Lives in its own module (not the provider file) so React Fast Refresh
 * can keep `AuthContext.jsx` as a components-only module, preserving
 * component state across hot reloads.
 */

import { useContext } from 'react';

import AuthContext from './AuthContext.jsx';

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
};
