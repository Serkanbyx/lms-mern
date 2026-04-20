/**
 * Admin service — wraps `/api/admin/*` (platform moderation surface).
 *
 * Every endpoint on the backend is gated by `protect + adminOnly +
 * adminLimiter`. The client just needs to call them; if the requester
 * isn't an admin the API returns 403 and the response interceptor
 * surfaces a normalised error.
 *
 * `forceDeleteCourse` requires `{ confirm: true }` in the body — the
 * server uses this as the last-line guard against accidental cascades,
 * so the helper hard-codes it instead of trusting callers to remember.
 */

import api from '../api/axios.js';
import { PAGINATION_DEFAULTS } from '../utils/constants.js';

export const getStats = async () => {
  const { data } = await api.get('/admin/stats');
  return data;
};

export const listUsers = async ({
  q,
  role,
  isActive,
  page = PAGINATION_DEFAULTS.page,
  limit = PAGINATION_DEFAULTS.limit,
} = {}) => {
  const { data } = await api.get('/admin/users', {
    params: { q, role, isActive, page, limit },
  });
  return data;
};

export const getUserById = async (id) => {
  const { data } = await api.get(`/admin/users/${id}`);
  return data;
};

export const updateUserRole = async (id, role) => {
  const { data } = await api.patch(`/admin/users/${id}/role`, { role });
  return data;
};

export const toggleUserActive = async (id, isActive) => {
  const { data } = await api.patch(`/admin/users/${id}/active`, { isActive });
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data;
};

export const listCoursesAdmin = async ({
  q,
  status,
  page = PAGINATION_DEFAULTS.page,
  limit = PAGINATION_DEFAULTS.limit,
} = {}) => {
  const { data } = await api.get('/admin/courses', {
    params: { q, status, page, limit },
  });
  return data;
};

export const getPendingCourses = async () => {
  const { data } = await api.get('/admin/courses/pending');
  return data;
};

export const approveCourse = async (id) => {
  const { data } = await api.post(`/admin/courses/${id}/approve`);
  return data;
};

export const rejectCourse = async (id, reason) => {
  const { data } = await api.post(`/admin/courses/${id}/reject`, { reason });
  return data;
};

export const archiveCourseAdmin = async (id) => {
  const { data } = await api.post(`/admin/courses/${id}/archive`);
  return data;
};

export const forceDeleteCourse = async (id) => {
  const { data } = await api.delete(`/admin/courses/${id}`, {
    data: { confirm: true },
  });
  return data;
};

export default {
  getStats,
  listUsers,
  getUserById,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  listCoursesAdmin,
  getPendingCourses,
  approveCourse,
  rejectCourse,
  archiveCourseAdmin,
  forceDeleteCourse,
};
