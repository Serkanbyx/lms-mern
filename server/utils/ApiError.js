/**
 * Operational error class for predictable HTTP failures.
 *
 * Throwing an `ApiError` from a controller signals an expected failure mode
 * (validation, auth, not-found, conflict). The central error middleware uses
 * the `statusCode` to shape the response, and the `isOperational` flag lets us
 * distinguish these from unexpected programmer errors that should be logged
 * with a stack trace.
 */

export class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code) this.code = code;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', meta) {
    return new ApiError(400, message, meta);
  }

  static unauthorized(message = 'Unauthorized', meta) {
    return new ApiError(401, message, meta);
  }

  static forbidden(message = 'Forbidden', meta) {
    return new ApiError(403, message, meta);
  }

  static notFound(message = 'Resource not found', meta) {
    return new ApiError(404, message, meta);
  }

  static conflict(message = 'Conflict', meta) {
    return new ApiError(409, message, meta);
  }

  static unprocessable(message = 'Unprocessable entity', meta) {
    return new ApiError(422, message, meta);
  }

  static tooMany(message = 'Too many requests', meta) {
    return new ApiError(429, message, meta);
  }

  static internal(message = 'Internal server error', meta) {
    const err = new ApiError(500, message, meta);
    err.isOperational = false;
    return err;
  }
}

export default ApiError;
