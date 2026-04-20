/**
 * Catch-all 404 handler.
 *
 * Mounted AFTER every real route so any unmatched URL is converted into a
 * structured `ApiError` and forwarded to the central error middleware. This
 * keeps the response shape identical to other failures (`{ success, message }`).
 */

import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
