/**
 * User service — wraps `/api/users/*` (non-auth user surface).
 *
 * Auth-related self-service (register / login / profile update / password
 * change / account delete) lives in `auth.service.js`. This module owns
 * the two endpoints that fall outside the auth flow:
 *
 *   GET   /api/users/:id              public profile (privacy filtered)
 *   PATCH /api/users/me/preferences   update theme / density / privacy / etc.
 */

import api from '../api/axios.js';

export const getPublicProfile = async (id) => {
  const { data } = await api.get(`/users/${id}`);
  return data;
};

export const updatePreferences = async (preferences) => {
  const { data } = await api.patch('/users/me/preferences', preferences);
  return data;
};

export default {
  getPublicProfile,
  updatePreferences,
};
