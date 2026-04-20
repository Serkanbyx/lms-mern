/**
 * Progress service.
 *
 * Lesson-level mutations (`mark complete`, `mark incomplete`, bump
 * "Continue learning" pointer) live on the lesson sub-router:
 *   POST   /api/lessons/:id/complete
 *   DELETE /api/lessons/:id/complete
 *   POST   /api/lessons/:id/access
 *
 * Course-level reads + the certificate request live on the course router:
 *   GET  /api/courses/:id/progress
 *   POST /api/courses/:id/certificate
 */

import api from '../api/axios.js';

export const markComplete = async (lessonId) => {
  const { data } = await api.post(`/lessons/${lessonId}/complete`);
  return data;
};

export const markIncomplete = async (lessonId) => {
  const { data } = await api.delete(`/lessons/${lessonId}/complete`);
  return data;
};

export const setLastAccessed = async (lessonId) => {
  const { data } = await api.post(`/lessons/${lessonId}/access`);
  return data;
};

export const getCourseProgress = async (courseId) => {
  const { data } = await api.get(`/courses/${courseId}/progress`);
  return data;
};

export const requestCertificate = async (courseId) => {
  const { data } = await api.post(`/courses/${courseId}/certificate`);
  return data;
};

export default {
  markComplete,
  markIncomplete,
  setLastAccessed,
  getCourseProgress,
  requestCertificate,
};
