/**
 * Lesson + Section service — wraps `/api/lessons/*` and `/api/sections/*`.
 *
 * The two resources share a service file because they form a single
 * authoring tree on the UI side (sections own lessons, the curriculum
 * editor manipulates both in the same screen).
 *
 * Routing reminder (see `server/routes/section.routes.js` +
 * `server/routes/lesson.routes.js`):
 *   - Section CREATE / REORDER are scoped under the parent course
 *     (`/api/courses/:courseId/sections`).
 *   - Lesson  CREATE / REORDER are scoped under the parent section
 *     (`/api/sections/:sectionId/lessons`).
 *   - Update / delete operations live on the bare `/:id` paths.
 */

import api from '../api/axios.js';

export const getLesson = async (id) => {
  const { data } = await api.get(`/lessons/${id}`);
  return data;
};

export const createLesson = async (sectionId, payload) => {
  const { data } = await api.post(`/sections/${sectionId}/lessons`, payload);
  return data;
};

export const updateLesson = async (id, updates) => {
  const { data } = await api.patch(`/lessons/${id}`, updates);
  return data;
};

export const deleteLesson = async (id) => {
  const { data } = await api.delete(`/lessons/${id}`);
  return data;
};

export const reorderLessons = async (sectionId, orderedIds) => {
  const { data } = await api.patch(`/sections/${sectionId}/lessons/reorder`, {
    orderedIds,
  });
  return data;
};

export const createSection = async (courseId, payload) => {
  const { data } = await api.post(`/courses/${courseId}/sections`, payload);
  return data;
};

export const updateSection = async (id, updates) => {
  const { data } = await api.patch(`/sections/${id}`, updates);
  return data;
};

export const deleteSection = async (id) => {
  const { data } = await api.delete(`/sections/${id}`);
  return data;
};

export const reorderSections = async (courseId, orderedIds) => {
  const { data } = await api.patch(`/courses/${courseId}/sections/reorder`, {
    orderedIds,
  });
  return data;
};

export default {
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
};
