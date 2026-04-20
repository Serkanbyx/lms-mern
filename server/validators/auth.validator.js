/**
 * Validation chains for the `/api/auth` route group.
 *
 * Validation lives separate from controllers so the rules can be reused
 * (e.g. an admin "create user" endpoint sharing the same password policy)
 * and so the controller bodies stay focused on business logic.
 *
 * Notes:
 *  - Email is normalized (`normalizeEmail`) so `Foo@Example.com ` matches the
 *    stored lowercase value.
 *  - Password policy: min 8 chars + at least one letter and one digit. The
 *    upper limit (128) blocks bcrypt's truncation footgun (>72 bytes) plus a
 *    safety margin against denial-of-service via huge inputs.
 *  - We never validate `role` — it is server-controlled (see the controller).
 */

import { body } from 'express-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)[\s\S]{8,128}$/;

const passwordChain = (field = 'password', label = 'Password') =>
  body(field)
    .isString()
    .withMessage(`${label} must be a string.`)
    .bail()
    .matches(PASSWORD_RULE)
    .withMessage(
      `${label} must be 8–128 characters and include at least one letter and one number.`,
    );

export const registerValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .bail()
    .normalizeEmail(),
  passwordChain('password'),
];

export const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .bail()
    .normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

export const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters.'),
  body('avatar')
    .optional()
    .trim()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Avatar must be a valid HTTPS URL.'),
  body('bio')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Bio must be at most 500 characters.'),
  body('headline')
    .optional()
    .isString()
    .isLength({ max: 120 })
    .withMessage('Headline must be at most 120 characters.'),
];

export const changePasswordValidator = [
  body('currentPassword')
    .isString()
    .notEmpty()
    .withMessage('Current password is required.'),
  passwordChain('newPassword', 'New password'),
];

export const deleteAccountValidator = [
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

export default {
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
  deleteAccountValidator,
};
