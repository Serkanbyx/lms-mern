/**
 * Enrollment service.
 *
 * Course-scoped operations live on `/api/courses/:id/enroll` and
 * `/api/courses/:id/enrollment` (the URL anchors the resource hierarchy).
 * The dashboard "list everything I'm enrolled in" feed lives on
 * `/api/enrollments/mine` because it has no natural parent course.
 */

import api from '../api/axios.js';
import { ENROLLMENT_FILTERS, PAGINATION_DEFAULTS } from '../utils/constants.js';

export const enroll = async (courseId) => {
  const { data } = await api.post(`/courses/${courseId}/enroll`);
  return data;
};

export const unenroll = async (courseId) => {
  const { data } = await api.delete(`/courses/${courseId}/enroll`);
  return data;
};

export const getEnrollmentForCourse = async (courseId) => {
  const { data } = await api.get(`/courses/${courseId}/enrollment`);
  return data;
};

export const getMyEnrollments = async ({
  status = ENROLLMENT_FILTERS.all,
  page = PAGINATION_DEFAULTS.page,
  limit = PAGINATION_DEFAULTS.limit,
} = {}) => {
  const { data } = await api.get('/enrollments/mine', {
    params: { status, page, limit },
  });
  return data;
};

export default {
  enroll,
  unenroll,
  getEnrollmentForCourse,
  getMyEnrollments,
};
