/**
 * Wrap an async route handler so rejected promises forward to Express's
 * error middleware via `next(err)`.
 *
 * Express 5 already auto-forwards rejected promises from handlers, but using
 * this wrapper keeps the contract explicit, works with future-default-async
 * middlewares, and lets us guard against accidental sync throws too.
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
