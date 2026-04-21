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
  pwaVisitCount: 'lms.pwa.visits',
  pwaEnrolledOnce: 'lms.pwa.enrolled',
  pwaInstallDismissedAt: 'lms.pwa.installDismissedAt',
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

/**
 * Course taxonomy enums — mirrored from `server/models/Course.model.js`.
 *
 * Authoring forms (create/edit) and any read-side UI that decorates a
 * course (catalog filter chips, dashboards) consume these labels so we
 * never ship a hand-typed "Programming" string that would drift out of
 * sync with the server-side enum.
 */
export const COURSE_CATEGORIES = Object.freeze([
  { value: 'programming', label: 'Programming' },
  { value: 'design', label: 'Design' },
  { value: 'business', label: 'Business' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'language', label: 'Language' },
  { value: 'other', label: 'Other' },
]);

export const COURSE_LEVELS = Object.freeze([
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]);

/**
 * Curated language list. The server accepts any lowercase string, but
 * narrowing the UI to a curated set keeps catalog filters meaningful
 * and discourages typos that would fragment the catalog.
 */
export const COURSE_LANGUAGES = Object.freeze([
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ar', label: 'العربية' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
]);

/**
 * Learning interest catalog used by the post-register `OnboardingModal`.
 * Each interest's `value` mirrors a `COURSE_CATEGORIES` id so the modal's
 * "your first course" panel can map an interest straight to a catalog
 * category filter without an intermediate lookup table.
 */
export const LEARNING_INTERESTS = Object.freeze([
  { value: 'programming', label: 'Web Development', icon: 'Code2' },
  { value: 'design', label: 'Design', icon: 'Palette' },
  { value: 'business', label: 'Business', icon: 'Briefcase' },
  { value: 'marketing', label: 'Marketing', icon: 'Megaphone' },
  { value: 'data-science', label: 'Data Science', icon: 'LineChart' },
  { value: 'language', label: 'Languages', icon: 'Languages' },
  { value: 'other', label: 'Something else', icon: 'Sparkles' },
]);

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
  forgotPassword: '/forgot-password',
  resetPassword: (token) => `/reset-password/${token}`,
  verifyEmail: (token) => `/verify-email/${token}`,
  verifyEmailPending: '/verify-email/pending',
  dashboard: '/dashboard',
  catalog: '/courses',
  courseDetail: (slug) => `/courses/${slug}`,
  courseLearn: (slug) => `/courses/${slug}/learn`,
  lesson: (courseSlug, lessonId) =>
    `/courses/${courseSlug}/learn/${lessonId}`,
  quiz: (courseSlug, quizId) => `/courses/${courseSlug}/quiz/${quizId}`,
  teach: '/teach',
  profile: (id) => `/u/${id}`,
  settings: '/settings',
  settingsAccount: '/settings/account',
  settingsAppearance: '/settings/appearance',
  settingsPrivacy: '/settings/privacy',
  settingsNotifications: '/settings/notifications',
  settingsPlayback: '/settings/playback',
  instructor: '/instructor',
  instructorCourseCreate: '/instructor/courses/new',
  instructorCourseEdit: (id) => `/instructor/courses/${id}/edit`,
  instructorCurriculum: (id) => `/instructor/courses/${id}/curriculum`,
  instructorQuizBuilder: (lessonId) => `/instructor/lessons/${lessonId}/quiz`,
  admin: '/admin',
  adminUsers: '/admin/users',
  adminCourses: '/admin/courses',
  adminPending: '/admin/pending',
  about: '/about',
  terms: '/terms',
  privacy: '/privacy',
  styleGuide: '/styleguide',
});
