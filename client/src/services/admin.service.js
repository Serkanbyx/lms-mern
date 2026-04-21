/**
 * Admin service — wraps `/api/admin/*` (platform moderation surface).
 *
 * Every endpoint on the backend is gated by `protect + adminOnly +
 * adminLimiter`. The client just needs to call them; if the requester
 * isn't an admin the API returns 403 and the response interceptor
 * surfaces a normalised error.
 *
 * Param naming mirrors the server validators verbatim (`search`, not the
 * shorter `q`) so a typo here can never silently fall back to "no
 * filter". `forceDeleteCourse` requires `{ confirm: true }` in the body —
 * the server uses this as the last-line guard against accidental
 * cascades, so the helper hard-codes it instead of trusting callers to
 * remember.
 */

import api from '../api/axios.js';

const ADMIN_DEFAULT_LIMIT = 20;

export const getStats = async () => {
  const { data } = await api.get('/admin/stats');
  return data;
};

export const listUsers = async ({
  search,
  role,
  isActive,
  sort,
  page = 1,
  limit = ADMIN_DEFAULT_LIMIT,
} = {}) => {
  const { data } = await api.get('/admin/users', {
    params: { search, role, isActive, sort, page, limit },
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
  search,
  status,
  sort,
  page = 1,
  limit = ADMIN_DEFAULT_LIMIT,
} = {}) => {
  const { data } = await api.get('/admin/courses', {
    params: { search, status, sort, page, limit },
  });
  return data;
};

export const getPendingCourses = async ({
  page = 1,
  limit = ADMIN_DEFAULT_LIMIT,
} = {}) => {
  const { data } = await api.get('/admin/courses/pending', {
    params: { page, limit },
  });
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
