/**
 * User controller — self-service preferences + public profile lookup.
 *
 * Auth-related self-service (name/avatar/bio/headline updates, password
 * change, account deletion) lives in `auth.controller.js`. This file
 * owns the two surfaces that fall outside the auth flow:
 *
 *   PATCH /api/users/me/preferences  — partial update of the embedded
 *                                       `preferences` subdocument
 *   GET   /api/users/:id              — public profile of any user,
 *                                       respecting `preferences.privacy.*`
 *
 * Security guarantees enforced here:
 *  - Mass-assignment defence: every update goes through `pickFields`,
 *    so no `role` / `email` / `isActive` / `password` field can ever
 *    flow in via the body even if the client tries.
 *  - Privacy: `getPublicProfile` honours the target user's
 *    `preferences.privacy.showEmail` flag (email omitted unless the
 *    user opted in) and `preferences.privacy.showEnrolledCourses`
 *    flag (enrolled-courses count omitted otherwise). Disabled
 *    accounts (`isActive: false`) are rendered as 404 to prevent
 *    enumeration of soft-deleted users.
 *  - Preferences updates are always scoped to `req.user._id`. The
 *    target user id is NEVER read from the URL or body — that would
 *    let any authenticated user mutate another user's preferences.
 */

import { Course } from '../models/Course.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const PREFERENCE_TOP_KEYS = Object.freeze([
  'theme',
  'fontSize',
  'contentDensity',
  'animations',
  'language',
  'privacy',
  'notifications',
  'playback',
  // STEP 39 — onboarding additions. Both are top-level scalars/arrays so
  // they merge through the same path as `theme` / `fontSize` (no nested
  // group merge needed).
  'interests',
  'onboardingCompletedAt',
]);

const PREFERENCE_PRIVACY_KEYS = Object.freeze(['showEmail', 'showEnrolledCourses']);

const PREFERENCE_NOTIFICATION_KEYS = Object.freeze([
  'emailOnEnroll',
  'emailOnQuizGraded',
]);

const PREFERENCE_PLAYBACK_KEYS = Object.freeze(['autoplayNext', 'defaultSpeed']);

const PUBLIC_PROFILE_FIELDS = Object.freeze([
  '_id',
  'name',
  'role',
  'avatar',
  'bio',
  'headline',
  'createdAt',
]);

/**
 * Merge a partial preferences payload onto the user's existing
 * preferences subdocument WITHOUT overwriting nested objects in their
 * entirety. A naive `Object.assign(user.preferences, body)` would
 * replace `privacy` whole-cloth and silently reset
 * `showEnrolledCourses` to its default whenever the client only
 * touched `showEmail`.
 *
 * The shape is enforced by `updatePreferencesValidator` upstream, so
 * we trust the keys but never the depth — anything outside the four
 * known nested groups is dropped by the field whitelists.
 */
const mergePreferences = (user, payload) => {
  const top = pickFields(payload, PREFERENCE_TOP_KEYS);

  for (const key of [
    'theme',
    'fontSize',
    'contentDensity',
    'animations',
    'language',
    'interests',
    'onboardingCompletedAt',
  ]) {
    if (Object.prototype.hasOwnProperty.call(top, key)) {
      user.preferences[key] = top[key];
    }
  }

  if (top.privacy) {
    const privacy = pickFields(top.privacy, PREFERENCE_PRIVACY_KEYS);
    Object.assign(user.preferences.privacy, privacy);
  }

  if (top.notifications) {
    const notifications = pickFields(top.notifications, PREFERENCE_NOTIFICATION_KEYS);
    Object.assign(user.preferences.notifications, notifications);
  }

  if (top.playback) {
    const playback = pickFields(top.playback, PREFERENCE_PLAYBACK_KEYS);
    Object.assign(user.preferences.playback, playback);
  }

  // Explicitly mark the path so Mongoose persists the nested mutation —
  // direct assignment on a `Mixed`-feeling subdoc is sometimes missed by
  // the default change tracker, and the few extra bytes are cheap.
  user.markModified('preferences');
};

/**
 * PATCH /api/users/me/preferences
 *
 * Partial-update the authenticated user's preferences subdocument.
 * Returns the full updated user (via `toSafeJSON`) so the client can
 * reconcile its `PreferencesContext` cache without a follow-up GET.
 */
export const updateMyPreferences = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw ApiError.badRequest('Request body must be a JSON object.');
  }

  const allowedTop = pickFields(req.body, PREFERENCE_TOP_KEYS);
  if (Object.keys(allowedTop).length === 0) {
    throw ApiError.badRequest('No updatable preference fields provided.');
  }

  mergePreferences(req.user, allowedTop);
  await req.user.save();

  res.json({
    success: true,
    user: req.user.toSafeJSON(),
  });
});

/**
 * GET /api/users/:id
 *
 * Returns the public-facing profile for any user. Enforces:
 *   - 404 for missing OR disabled (`isActive: false`) accounts so the
 *     endpoint never confirms whether a given id was ever a real user.
 *   - `preferences.privacy.showEmail` — email is included only when the
 *     target user opted in.
 *   - `preferences.privacy.showEnrolledCourses` — enrollment counter
 *     omitted when the target user opted out.
 *   - Instructors get an extra `coursesPublished` counter (published
 *     courses only — drafts/pending stay private to the owner/admin).
 *
 * The endpoint is public (no `protect` on the route) on purpose so an
 * instructor card on a course detail page can deep-link to the
 * profile without forcing a login.
 */
export const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    [...PUBLIC_PROFILE_FIELDS, 'email', 'isActive', 'preferences'].join(' '),
  );

  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found.');
  }

  const profile = {
    _id: user._id,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    headline: user.headline,
    createdAt: user.createdAt,
  };

  if (user.preferences?.privacy?.showEmail) {
    profile.email = user.email;
  }

  // Counter projections — both are computed lazily so an opt-out user
  // never triggers the underlying query at all.
  if (user.preferences?.privacy?.showEnrolledCourses) {
    profile.enrolledCoursesCount = await Enrollment.countDocuments({ userId: user._id });
  }

  if (user.role === 'instructor') {
    profile.coursesPublished = await Course.countDocuments({
      instructor: user._id,
      status: 'published',
    });
  }

  res.json({ success: true, user: profile });
});

export default {
  updateMyPreferences,
  getPublicProfile,
};
