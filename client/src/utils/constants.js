/**
 * Shared client-side constants.
 *
 * Anything that more than one module needs — storage keys, status enums,
 * pagination defaults, the public route map — lives here. Keeping it in
 * one file avoids the classic "magic string drift" bug where the API
 * client and a UI component disagree on what `'in-progress'` means.
 *
 * NEVER put secrets here: this file ships in the client bundle.
 */

export const STORAGE_KEYS = Object.freeze({
  token: 'lms.token',
  theme: 'lms.theme',
  preferences: 'lms.preferences',
  returnTo: 'lms.returnTo',
});

export const ROLES = Object.freeze({
  student: 'student',
  instructor: 'instructor',
  admin: 'admin',
});

export const COURSE_STATUS = Object.freeze({
  draft: 'draft',
  pending: 'pending',
  published: 'published',
  rejected: 'rejected',
  archived: 'archived',
});

export const ENROLLMENT_FILTERS = Object.freeze({
  all: 'all',
  inProgress: 'in-progress',
  completed: 'completed',
});

export const UPLOAD_RESOURCE_TYPES = Object.freeze({
  image: 'image',
  video: 'video',
  raw: 'raw',
});

export const PAGINATION_DEFAULTS = Object.freeze({
  page: 1,
  limit: 12,
});

export const HTTP_TIMEOUT_MS = 20_000;

/**
 * Frontend public route map. Centralised so navigation links and the
 * 401 redirect interceptor never disagree on a path.
 */
export const ROUTES = Object.freeze({
  home: '/',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  catalog: '/courses',
  courseDetail: (slug) => `/courses/${slug}`,
  lesson: (courseSlug, lessonId) => `/courses/${courseSlug}/learn/${lessonId}`,
  profile: (id) => `/u/${id}`,
  settings: '/settings',
  instructor: '/instructor',
  admin: '/admin',
});
