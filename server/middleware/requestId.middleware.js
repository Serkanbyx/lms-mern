/**
 * Per-request correlation id (STEP 47).
 *
 * Tags every incoming request with a stable identifier so structured logs,
 * error reports, and (eventually) client-side telemetry can be correlated
 * across services. The id is taken from the `X-Request-ID` header when the
 * caller already supplied one (so an upstream load balancer or our own
 * client can join its trace), otherwise a fresh 10-char nanoid is minted.
 *
 * The id is exposed back to the client via the `X-Request-ID` response
 * header (also added to the CORS `exposedHeaders` list so browser callers
 * can read it) and attached to `req.id` for downstream middleware /
 * loggers (`pino-http` is wired to use `req.id` as the per-line correlation
 * key). Always mount this BEFORE the logger and the rate limiter so every
 * log line carries the id and the logger can link a 429 back to the offender.
 *
 * The id is intentionally short (10 chars) and url-safe — it is not a
 * security token and is OK to surface in error pages, browser dev-tools,
 * or support tickets.
 */

import { nanoid } from 'nanoid';

const HEADER_NAME = 'X-Request-Id';
const MAX_HEADER_LENGTH = 64;
const SAFE_HEADER_PATTERN = /^[\w.-]+$/;

const sanitizeIncoming = (raw) => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_HEADER_LENGTH) return null;
  return SAFE_HEADER_PATTERN.test(trimmed) ? trimmed : null;
};

export const requestId = (req, res, next) => {
  const incoming = sanitizeIncoming(req.headers['x-request-id']);
  req.id = incoming ?? nanoid(10);
  res.setHeader(HEADER_NAME, req.id);
  next();
};

export default requestId;
