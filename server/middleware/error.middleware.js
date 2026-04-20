/**
 * Centralized error middleware.
 *
 * Normalizes every thrown/forwarded error into a uniform JSON response:
 *
 *   { success: false, message: string, errors?: object[], code?: string }
 *
 * In production the stack trace is hidden, internal Mongoose paths are
 * scrubbed from validation messages, and unexpected errors are logged with
 * full context so we can debug them without leaking implementation details
 * to clients.
 */

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const formatMongooseValidation = (err) => {
  const errors = Object.values(err.errors || {}).map((e) => ({
    field: env.isProd ? undefined : e.path,
    message: e.message,
  }));
  return new ApiError(400, 'Validation failed.', { details: errors });
};

const formatDuplicateKey = (err) => {
  const fields = err.keyValue ? Object.keys(err.keyValue) : [];
  // Generic message in production prevents user enumeration via duplicate-email probes.
  if (env.isProd) {
    return new ApiError(409, 'A record with the provided value already exists.');
  }
  const field = fields[0] || 'field';
  return new ApiError(409, `Duplicate value for "${field}".`);
};

const formatCastError = () => new ApiError(400, 'Invalid identifier format.');

const formatJwtError = (err) => {
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Authentication token has expired.');
  }
  return new ApiError(401, 'Invalid authentication token.');
};

const normalizeError = (err) => {
  if (err instanceof ApiError) return err;
  if (err?.name === 'ValidationError') return formatMongooseValidation(err);
  if (err?.name === 'CastError') return formatCastError();
  if (err?.code === 11000) return formatDuplicateKey(err);
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return formatJwtError(err);
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request payload is too large.');
  }
  const status = err?.status || err?.statusCode || 500;
  const apiErr = new ApiError(status, err?.message || 'Internal server error');
  apiErr.isOperational = false;
  return apiErr;
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const apiError = normalizeError(err);

  const payload = {
    success: false,
    message: apiError.message,
  };
  if (apiError.code) payload.code = apiError.code;
  if (apiError.details) payload.errors = apiError.details;
  if (!env.isProd && err?.stack) payload.stack = err.stack;

  if (apiError.statusCode >= 500 || !apiError.isOperational) {
    // eslint-disable-next-line no-console
    console.error('[error]', {
      method: req.method,
      url: req.originalUrl,
      message: err?.message,
      stack: err?.stack,
    });
  }

  res.status(apiError.statusCode).json(payload);
};

export default errorHandler;
