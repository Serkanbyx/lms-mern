/**
 * Validation chains for the `/api/admin` route group.
 *
 * Every endpoint here sits behind `protect + adminOnly`, so the validator
 * only guards request shape (param formats, query bounds, body enums) —
 * privilege checks and business rules (self-protection, last-admin
 * protection, instructor-with-active-enrollments protection) live in the
 * controller because they all need a database round-trip.
 *
 * Notes:
 *  - `mongoIdParam` is reused from the course validator so the rejection
 *    message stays consistent across the API surface.
 *  - We re-import the schema's frozen `USER_ROLES` enum so the validator
 *    and the model can never drift out of sync.
 *  - Express 5 NOTE: `req.query` is a read-only getter. We deliberately
 *    avoid `.toInt()` / `.toFloat()` sanitizers that would mutate the
 *    query object and crash the request — the controller re-parses the
 *    (validated) string values itself.
 */

import { body, query } from 'express-validator';

import { USER_ROLES } from '../models/User.model.js';
import { mongoIdParam } from './course.validator.js';

const SEARCH_MAX_LENGTH = 100;
const PAGINATION_DEFAULT_LIMIT = 20;
const PAGINATION_MAX_LIMIT = 100;

const USER_LIST_SORT_VALUES = Object.freeze([
  'newest',
  'oldest',
  'name',
  'email',
  'role',
]);

const pageChain = () =>
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer.');

const limitChain = () =>
  query('limit')
    .optional()
    .isInt({ min: 1, max: PAGINATION_MAX_LIMIT })
    .withMessage(`Limit must be between 1 and ${PAGINATION_MAX_LIMIT}.`);

const searchChain = () =>
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string.')
    .bail()
    .trim()
    .isLength({ max: SEARCH_MAX_LENGTH })
    .withMessage(`Search must be at most ${SEARCH_MAX_LENGTH} characters.`);

const roleQueryChain = () =>
  query('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage(`Role must be one of: ${USER_ROLES.join(', ')}.`);

const isActiveQueryChain = () =>
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be "true" or "false".');

const sortChain = () =>
  query('sort')
    .optional()
    .isIn(USER_LIST_SORT_VALUES)
    .withMessage(`Sort must be one of: ${USER_LIST_SORT_VALUES.join(', ')}.`);

const roleBodyChain = () =>
  body('role')
    .exists({ checkNull: true })
    .withMessage('Role is required.')
    .bail()
    .isIn(USER_ROLES)
    .withMessage(`Role must be one of: ${USER_ROLES.join(', ')}.`);

const isActiveBodyChain = () =>
  body('isActive')
    .exists({ checkNull: true })
    .withMessage('isActive is required.')
    .bail()
    .isBoolean()
    .withMessage('isActive must be a boolean.');

export const listUsersValidator = [
  searchChain(),
  roleQueryChain(),
  isActiveQueryChain(),
  sortChain(),
  pageChain(),
  limitChain(),
];

export const userIdParamValidator = [mongoIdParam('id')];

export const updateUserRoleValidator = [mongoIdParam('id'), roleBodyChain()];

export const toggleUserActiveValidator = [mongoIdParam('id'), isActiveBodyChain()];

export const ADMIN_USER_PAGINATION_DEFAULTS = Object.freeze({
  defaultLimit: PAGINATION_DEFAULT_LIMIT,
  maxLimit: PAGINATION_MAX_LIMIT,
});

export const ADMIN_USER_LIST_SORTS = USER_LIST_SORT_VALUES;

export default {
  listUsersValidator,
  userIdParamValidator,
  updateUserRoleValidator,
  toggleUserActiveValidator,
  ADMIN_USER_PAGINATION_DEFAULTS,
  ADMIN_USER_LIST_SORTS,
};
