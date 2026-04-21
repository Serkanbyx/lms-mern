/**
 * Validation chains for the `/api/users` route group.
 *
 * This file guards the two surfaces a user can drive directly that aren't
 * covered by the auth controller (which already owns `name`/`avatar`/
 * `bio`/`headline`/`password`):
 *
 *   PATCH /api/users/me/preferences   — partial preferences update
 *   GET   /api/users/:id              — public profile fetch
 *
 * Design notes:
 *  - The preferences validator is a STRICT WHITELIST. Each top-level key
 *    is `optional()`, and unknown keys are dropped by `pickFields` in the
 *    controller. Nested keys (`privacy.showEmail`, `notifications.*`,
 *    `playback.*`) are validated explicitly so a malformed nested
 *    payload surfaces a 422 with a precise field path instead of a
 *    silent partial save.
 *  - All enums are re-imported from the User schema so the validator and
 *    the model can never drift out of sync. Adding a new theme to the
 *    schema instantly becomes accepted here without a code change.
 *  - The schema's `preferences.privacy.*` flags are the SOURCE of truth
 *    for what `getPublicProfile` is allowed to return. The validator
 *    only enforces the input shape — the privacy filtering itself lives
 *    in the controller (it needs the persisted user document).
 *  - `mongoIdParam` is reused from the course validator so the rejection
 *    message stays consistent across the API surface.
 *  - We deliberately do NOT validate `role`, `email`, `isActive`, or any
 *    other server-controlled field. Those are stripped by `pickFields`
 *    in the controller, but rejecting them here would leak the field
 *    name to a probing client.
 */

import { body } from 'express-validator';

import {
  USER_DENSITIES,
  USER_FONT_SIZES,
  USER_INTERESTS,
  USER_LANGUAGES,
  USER_PLAYBACK_SPEEDS,
  USER_THEMES,
} from '../models/User.model.js';
import { mongoIdParam } from './course.validator.js';

const optionalBoolean = (path, label) =>
  body(path)
    .optional()
    .isBoolean()
    .withMessage(`${label} must be a boolean.`)
    .bail()
    .toBoolean();

const optionalEnum = (path, label, values) =>
  body(path)
    .optional()
    .isIn(values)
    .withMessage(`${label} must be one of: ${values.join(', ')}.`);

export const updatePreferencesValidator = [
  optionalEnum('theme', 'Theme', USER_THEMES),
  optionalEnum('fontSize', 'Font size', USER_FONT_SIZES),
  optionalEnum('contentDensity', 'Content density', USER_DENSITIES),
  optionalBoolean('animations', 'Animations'),
  optionalEnum('language', 'Language', USER_LANGUAGES),

  // `privacy` and `notifications` are sub-objects; the top-level body
  // chain only checks that the key (when supplied) is a plain object so
  // nested chains below can run safely against `req.body.privacy.*` /
  // `req.body.notifications.*` without crashing on `null`/array inputs.
  body('privacy')
    .optional()
    .isObject({ strict: true })
    .withMessage('Privacy must be an object.'),
  optionalBoolean('privacy.showEmail', 'privacy.showEmail'),
  optionalBoolean('privacy.showEnrolledCourses', 'privacy.showEnrolledCourses'),

  body('notifications')
    .optional()
    .isObject({ strict: true })
    .withMessage('Notifications must be an object.'),
  optionalBoolean('notifications.emailOnEnroll', 'notifications.emailOnEnroll'),
  optionalBoolean('notifications.emailOnQuizGraded', 'notifications.emailOnQuizGraded'),

  body('playback')
    .optional()
    .isObject({ strict: true })
    .withMessage('Playback must be an object.'),
  optionalBoolean('playback.autoplayNext', 'playback.autoplayNext'),
  body('playback.defaultSpeed')
    .optional()
    .isFloat()
    .withMessage('playback.defaultSpeed must be a number.')
    .bail()
    .toFloat()
    .custom((value) => USER_PLAYBACK_SPEEDS.includes(value))
    .withMessage(
      `playback.defaultSpeed must be one of: ${USER_PLAYBACK_SPEEDS.join(', ')}.`,
    ),

  // Onboarding additions.
  body('interests')
    .optional()
    .isArray({ max: USER_INTERESTS.length })
    .withMessage(`Interests must be an array of at most ${USER_INTERESTS.length} items.`),
  body('interests.*')
    .optional()
    .isString()
    .bail()
    .isIn(USER_INTERESTS)
    .withMessage(`Each interest must be one of: ${USER_INTERESTS.join(', ')}.`),

  body('onboardingCompletedAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('onboardingCompletedAt must be an ISO 8601 timestamp.')
    .bail()
    .toDate(),
];

/**
 * `GET /api/users/:id` only needs to confirm the URL param is a valid
 * Mongo id. The controller decides what fields to return (privacy
 * flags are enforced server-side), so the validator stops at shape.
 */
export const publicProfileParamValidator = [mongoIdParam('id')];

export default {
  updatePreferencesValidator,
  publicProfileParamValidator,
};
