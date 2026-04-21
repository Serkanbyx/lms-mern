/**
 * Structured request logger.
 *
 * Replaces `morgan` with `pino-http` so every request line is a single JSON
 * record in production (machine-parseable for the log aggregator) and a
 * pretty-printed dev line locally. The logger is configured with:
 *
 *  - `genReqId`: reuse the `req.id` minted by `requestId.middleware.js` so
 *    the per-request correlation id appears in EVERY log line and matches
 *    the `X-Request-ID` response header the client sees.
 *  - `redact`: scrub authorization headers, cookies, and password fields
 *    from the request snapshot so secrets and JWTs never leak into logs.
 *  - `customLogLevel`: downgrade 4xx noise to `warn` and reserve `error`
 *    for true 5xx incidents so log-based alerting stays signal-heavy.
 *  - `serializers`: keep request/response objects to their useful fields
 *    only (method, url, status, duration) — the default pino-http payload
 *    is verbose and includes proxy-set headers we don't need.
 *
 * Always mount this AFTER `requestId` (so `req.id` is populated) and before
 * any route handler.
 */

import pino from 'pino';
import pinoHttp from 'pino-http';

import { env } from '../config/env.js';

const transport = env.isProd
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        singleLine: true,
        ignore: 'pid,hostname',
      },
    };

/**
 * Base structured logger.
 *
 * Use this for non-request lifecycle events (server bootstrap, graceful
 * shutdown, cron jobs, background workers) so they share the same JSON
 * shape and log level as the per-request lines emitted by `httpLogger`.
 *
 * Avoid `console.log` outside of `seeders/` and one-shot CLI scripts —
 * `pino`'s structured output is the only thing the production log
 * aggregator can index reliably.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  base: { service: 'lms-api', env: env.NODE_ENV },
});

export const httpLogger = pinoHttp({
  level: env.LOG_LEVEL,
  transport,
  // The id is set by `requestId` middleware before this logger fires.
  genReqId: (req) => req.id,
  // Inheriting `req.id` into every emitted line keeps logs joinable.
  customProps: (req) => ({ requestId: req.id }),
  // Collapse 4xx into warn so error-only alerting only triggers on 5xx.
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Redact secrets at the LOGGER level so a misconfigured route handler
  // can't accidentally leak them into a log line.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'req.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

export default httpLogger;
