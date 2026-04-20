/**
 * express-validator runner.
 *
 * Routes declare their validation rules as an array of express-validator
 * chains. This helper executes every chain, collects the results, and forwards
 * a structured 422 `ApiError` to the central error middleware on failure.
 *
 * Field-level details are always included so the client can render inline
 * form errors next to the offending input. Sensitive values (passwords,
 * tokens) are stripped from the echoed `value` field — only the field name
 * and message are returned.
 */

import { validationResult } from 'express-validator';

import { ApiError } from '../utils/ApiError.js';

const SENSITIVE_FIELDS = new Set(['password', 'currentPassword', 'newPassword', 'token']);

export const validate = (rules = []) => [
  ...rules,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const errors = result.array({ onlyFirstError: true }).map((e) => ({
      field: e.path || e.param,
      message: e.msg,
      value: SENSITIVE_FIELDS.has(e.path || e.param) ? undefined : e.value,
    }));

    return next(ApiError.unprocessable('Validation failed.', { details: errors }));
  },
];

export default validate;
