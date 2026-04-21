/**
 * Course service — wraps `/api/courses/*` and `/api/instructors/:id/courses`.
 *
 * Surfaces the three personas of the catalog API:
 *   - Public:    list, slug detail, slug curriculum, instructor public listing.
 *   - Author:    create / update / delete + lifecycle (submit / archive).
 *   - Owner:    `getMyCourses()` for the instructor dashboard.
 */

import api from '../api/axios.js';

export const listCourses = async (params = {}) => {
  const { data } = await api.get('/courses', { params });
  return data;
};

export const getCourseBySlug = async (slug) => {
  const { data } = await api.get(`/courses/${encodeURIComponent(slug)}`);
  return data;
};

export const getCurriculum = async (slug) => {
  const { data } = await api.get(`/courses/${encodeURIComponent(slug)}/curriculum`);
  return data;
};

export const getMyCourses = async (params = {}) => {
  const { data } = await api.get('/courses/mine', { params });
  return data;
};

export const createCourse = async (payload) => {
  const { data } = await api.post('/courses', payload);
  return data;
};

export const updateCourse = async (id, updates) => {
  const { data } = await api.patch(`/courses/${id}`, updates);
  return data;
};

export const deleteCourse = async (id) => {
  const { data } = await api.delete(`/courses/${id}`);
  return data;
};

export const submitForReview = async (id) => {
  const { data } = await api.post(`/courses/${id}/submit`);
  return data;
};

export const archiveCourse = async (id) => {
  const { data } = await api.post(`/courses/${id}/archive`);
  return data;
};

export const getInstructorPublicCourses = async (instructorId, params = {}) => {
  const { data } = await api.get(`/instructors/${instructorId}/courses`, { params });
  return data;
};

export default {
  listCourses,
  getCourseBySlug,
  getCurriculum,
  getMyCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  submitForReview,
  archiveCourse,
  getInstructorPublicCourses,
};
