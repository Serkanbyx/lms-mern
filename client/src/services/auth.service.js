/**
 * Auth service — wraps `/api/auth/*`.
 *
 * Every function returns ONLY the response payload (`response.data`). The
 * raw axios envelope never escapes this module — components stay free of
 * HTTP plumbing.
 *
 * Server response shapes (see `server/controllers/auth.controller.js`):
 *   register / login        → { success, token, user }
 *   getMe / updateProfile   → { success, user }
 *   changePassword          → { success, message }
 *   deleteAccount           → { success, message }
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

export default {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
};
