/**
 * Validation chains for the student-facing enrollment + progress route
 * groups (`/api/courses/:id/enroll`, `/api/courses/:id/enrollment`,
 * `/api/courses/:id/progress`, `/api/enrollments/mine`,
 * `/api/lessons/:id/complete`, `/api/lessons/:id/access`).
 *
 * The validator only guards request shape (param formats, optional
 * pagination bounds). Business rules — "course must be published",
 * "user cannot enroll twice", "lesson must belong to enrolled course",
 * "instructor cannot enroll in own course" — are enforced inside the
 * controllers because they require a database round-trip and would
 * leak ownership signals from the validator layer.
 *
 * `mongoIdParam` is reused from the course validator so the rejection
 * message stays consistent across the API surface.
 */

import { query } from 'express-validator';

import { mongoIdParam } from './course.validator.js';

const PAGINATION_DEFAULT_LIMIT = 12;
const PAGINATION_MAX_LIMIT = 50;

const ENROLLMENT_STATUS_VALUES = Object.freeze(['all', 'in-progress', 'completed']);

const pageChain = () =>
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer.')
    .bail()
    .toInt();

const limitChain = () =>
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION_MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION_MAX_LIMIT}.`)
    .bail()
    .toInt();

const statusChain = () =>
  query('status')
    .optional()
    .isIn(ENROLLMENT_STATUS_VALUES)
    .withMessage(`Status must be one of: ${ENROLLMENT_STATUS_VALUES.join(', ')}.`);

export const courseIdParamValidator = [mongoIdParam('id')];

export const lessonIdParamValidator = [mongoIdParam('id')];

export const myEnrollmentsValidator = [pageChain(), limitChain(), statusChain()];

export const ENROLLMENT_PAGINATION_DEFAULTS = Object.freeze({
  defaultLimit: PAGINATION_DEFAULT_LIMIT,
  maxLimit: PAGINATION_MAX_LIMIT,
});

export const ENROLLMENT_LIST_STATUSES = ENROLLMENT_STATUS_VALUES;

export default {
  courseIdParamValidator,
  lessonIdParamValidator,
  myEnrollmentsValidator,
  ENROLLMENT_PAGINATION_DEFAULTS,
  ENROLLMENT_LIST_STATUSES,
};
