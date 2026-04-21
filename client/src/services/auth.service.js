/**
 * Auth service — wraps `/api/auth/*`.
 *
 * Every function returns ONLY the response payload (`response.data`). The
 * raw axios envelope never escapes this module — components stay free of
 * HTTP plumbing.
 *
 * Server response shapes (see `server/controllers/auth.controller.js`):
 *   register / login / refresh   → { success, token, user }
 *   getMe / updateProfile        → { success, user }
 *   changePassword               → { success, message, token }
 *   verifyEmail                  → { success, message, user }
 *   resendVerification           → { success, message }
 *   forgotPassword               → { success, message }
 *   resetPassword                → { success, message }
 *   logout / logoutAll           → { success, message }
 *   deleteAccount                → { success, message }
 *
 * Refresh-token note: the refresh token lives in an HttpOnly
 * cookie scoped to `/api/auth`. Because the axios instance is created
 * with `withCredentials: true`, every call below already ships and
 * receives that cookie automatically — no manual header plumbing.
 */

import api from '../api/axios.js';

export const register = async ({ name, email, password }) => {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data;
};

export const login = async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const updateProfile = async (updates) => {
  const { data } = await api.patch('/auth/me', updates);
  return data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  const { data } = await api.patch('/auth/me/password', {
    currentPassword,
    newPassword,
  });
  return data;
};

export const deleteAccount = async ({ password }) => {
  const { data } = await api.delete('/auth/me', { data: { password } });
  return data;
};

// --- Verification, reset, refresh, logout(s) -----------------------------

export const verifyEmail = async (token) => {
  const { data } = await api.get(`/auth/verify-email/${encodeURIComponent(token)}`);
  return data;
};

export const resendVerification = async (email) => {
  const payload = email ? { email } : {};
  const { data } = await api.post('/auth/resend-verification', payload);
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
};

export const resetPassword = async ({ token, password }) => {
  const { data } = await api.post(
    `/auth/reset-password/${encodeURIComponent(token)}`,
    { password },
  );
  return data;
};

/**
 * Mark this call as `silent` so the global axios interceptor does NOT
 * fire its toast / redirect chain when the refresh fails — the caller
 * (axios interceptor or AuthContext) handles the failure path itself.
 */
export const refreshAccessToken = async () => {
  const { data } = await api.post('/auth/refresh', null, { silent: true });
  return data;
};

export const logout = async () => {
  const { data } = await api.post('/auth/logout', null, { silent: true });
  return data;
};

export const logoutAll = async () => {
  const { data } = await api.post('/auth/logout-all');
  return data;
};

export default {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
  logoutAll,
};
