/**
 * LMS API — Express 5 entry point.
 *
 * Middleware ordering follows STEP 2 of the build guide, refined by the
 * STEP 47 hardening pass. Order matters:
 *
 *   1. `trust proxy`          — required so `req.secure`, `req.ip`, and the
 *                               rate limiter all see the real client IP /
 *                               protocol behind Render's load balancer.
 *   2. `requestId`            — every request gets a correlation id BEFORE
 *                               anything that might log or bounce.
 *   3. `redirectToHttps`      — bounce HTTP → HTTPS in production before
 *                               we waste cycles on heavier middleware.
 *   4. `securityHeaders`      — explicit Helmet / CSP / HSTS bundle.
 *   5. `denyObsoleteMethods`  — kill TRACE / TRACK at the edge.
 *   6. `cors`                 — CORS preflight cached 24h, exposes the
 *                               request id so clients can echo it back.
 *   7. `compression`          — STEP 48: gzip JSON/HTML responses ≥ 1 KB.
 *                               Mounted BEFORE body parsers so it can
 *                               wrap every downstream `res.write/end`.
 *   8. body parsers           — capped at 10 KB.
 *   9. `cookie-parser`        — refresh-token HttpOnly cookie reader.
 *  10. mongo-sanitize         — body + params (Express 5 won't let us touch
 *                               req.query).
 *  11. `httpLogger`           — structured pino request log.
 *  12. `apiLimiter`           — global rate-limit floor.
 *  13. routes
 *  14. notFound + errorHandler — last.
 *
 * EXPRESS 5 NOTE: `req.query` is a read-only getter, so the `express-mongo-
 * sanitize` middleware (which mutates req.query) crashes when used as
 * `app.use(mongoSanitize())`. We sanitize `req.body` and `req.params` only,
 * which is sufficient because Mongoose query operators in URL query strings
 * are blocked by validators before they reach the database.
 */

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import {
  denyObsoleteMethods,
  redirectToHttps,
  securityHeaders,
} from './middleware/security.middleware.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import instructorRoutes from './routes/instructor.routes.js';
import lessonRoutes from './routes/lesson.routes.js';
import progressRoutes from './routes/progress.routes.js';
import quizStudentRoutes from './routes/quiz.student.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import sectionRoutes, { courseSectionsRouter } from './routes/section.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import userRoutes from './routes/user.routes.js';
import { httpLogger, logger } from './utils/logger.js';

const app = express();

// 1) Strip Express fingerprinting header.
app.disable('x-powered-by');

// 2) Trust the FIRST hop in front of us (Render's load balancer) so:
//      - `req.secure` reflects the original client protocol.
//      - `req.ip` is the real client IP (used by `express-rate-limit`).
//    Setting more than 1 would let a client spoof its IP via X-Forwarded-For.
if (env.isProd) {
  app.set('trust proxy', 1);
}

// 3) Per-request correlation id — must run before the logger and any
//    middleware that might short-circuit (HTTPS redirect, rate limit).
app.use(requestId);

// 4) Force HTTPS in production. No-op in dev.
app.use(redirectToHttps);

// 5) Security headers — strict CSP, HSTS preload, frame-ancestors deny,
//    CORP same-site. Replaces the bare `helmet()` default.
app.use(securityHeaders);

// 6) Block obsolete HTTP methods (TRACE/TRACK — XST attack surface).
app.use(denyObsoleteMethods);

// 7) CORS — allowlist driven by env (CLIENT_URL + optional CORS_ORIGINS).
//    `maxAge` caches the preflight response for 24h to cut OPTIONS chatter.
//    `exposedHeaders` lets browser callers read the `X-Request-ID` we set.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server requests with no Origin header.
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    maxAge: 86_400,
    exposedHeaders: [
      'X-Request-Id',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Cache-Control',
      'Vary',
    ],
  }),
);

// 8) Response compression (STEP 48).
//    gzip every response body ≥ `threshold` bytes. JSON catalogs and
//    curriculum trees shrink ~70 % on the wire, which is the cheapest
//    meaningful win for a list-heavy SPA.
//
//    - `level: 6` is the zlib default — best size/CPU trade-off; higher
//      levels burn the event loop without much further savings on JSON.
//    - `threshold: 1024` skips tiny responses (auth check pings, empty
//      204s) where gzip framing overhead would actually grow the payload.
//    - Clients that opt out via `Cache-Control: no-transform` (rare, but
//      e.g. some intermediate proxies) keep their guarantee — `compression`
//      respects that header by default.
//    - Mounted BEFORE body parsers / routes so it can wrap every
//      downstream response. Mounting it AFTER routes would be a no-op
//      because the handler has already flushed `res.end`.
app.use(compression({ level: 6, threshold: 1024 }));

// 9) Body parsers — capped at 10 KB to mitigate payload-DoS.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 10) Cookie parser — required so the refresh-token HttpOnly cookie can
//     reach `req.cookies` in the auth controller. The cookie itself is
//     never signed (the JWT inside is self-authenticating).
app.use(cookieParser());

// 11) Mongo-sanitize on body + params only (Express 5 safe — see file header).
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// 12) Structured request logging (pino-http). Every line carries `req.id`
//     and authorization / cookie / password fields are pre-redacted.
app.use(httpLogger);

// 13) Global rate limiter — `apiLimiter` lives in the shared rate-limit
//     module so the per-route limiters (auth, password, upload, quiz,
//     admin, enroll) and this global cap stay in one place. The global
//     bucket forms the outermost layer of defence; per-route limiters
//     narrow specific endpoints further down the chain.
//
//     STEP 48: when `REDIS_URL` is set the limiter uses a shared Redis
//     store so multiple API replicas count against a single bucket per
//     IP / user. Without that, each replica's in-memory counter would
//     silently multiply the cap by the replica count.
app.use(apiLimiter);

// 14) Health check — used by uptime probes and load balancers.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// 15) Feature route modules — mounted under /api/*. Additional groups
//     (quizzes, enrollments, …) are added by later steps.
//
//    Mount order notes:
//    - The course-scoped sections sub-router
//      (`/api/courses/:courseId/sections/...`) is registered BEFORE
//      the bare course router so its more specific path wins the match
//      instead of being shadowed by `/api/courses/:id`.
//    - `progressRoutes` is mounted at `/api/lessons` BEFORE
//      `lessonRoutes` so its student-only `/:id/complete` and
//      `/:id/access` paths are matched without first traversing the
//      `protect + instructorOrAdmin` gate that lessonRoutes installs.
//    - `quizStudentRoutes` is mounted at `/api/quizzes` BEFORE
//      `quizRoutes` for the same reason: its student-facing reads
//      (`GET /:id`, `GET /:id/best/mine`, `GET /:id/attempts/mine`)
//      and submit (`POST /:id/submit`) use only `protect`, while the
//      instructor router locks every handler behind `instructorOrAdmin`.
app.use('/api/auth', authRoutes);
app.use('/api/courses/:courseId/sections', courseSectionsRouter);
app.use('/api/courses', courseRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/lessons', progressRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizStudentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// 16) 404 handler — must come after all real routes.
app.use(notFound);

// 17) Error handler — must be the last middleware. Express 5 forwards
//     thrown errors and rejected promises here automatically.
app.use(errorHandler);

// STEP 49 — Graceful shutdown.
//
// Without this hook a deploy (or `kill` from your shell) drops every
// in-flight request and leaves the database / Redis connections half-
// closed. Render fires SIGTERM with a 30 s grace window before SIGKILL;
// this handler stops accepting new connections, drains the existing
// ones, then closes Mongo + Redis cleanly. The 10 s fallback exit
// guarantees we never hang the deploy if a long-poll refuses to drain.
const FORCE_EXIT_TIMEOUT_MS = 10_000;

const start = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `LMS API listening on http://localhost:${env.PORT}`,
    );
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received — draining connections.');

    // Stop accepting new connections and wait for in-flight requests to finish.
    const httpClosed = new Promise((resolve) => {
      server.close((err) => {
        if (err) logger.error({ err }, 'HTTP server close errored.');
        else logger.info('HTTP server closed.');
        resolve();
      });
    });

    // Hard cap so a stuck keep-alive connection cannot deadlock the deploy.
    const forceExit = setTimeout(() => {
      logger.warn(
        { timeoutMs: FORCE_EXIT_TIMEOUT_MS },
        'Forced exit — graceful shutdown took too long.',
      );
      process.exit(1);
    }, FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();

    try {
      await httpClosed;
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
      if (redis) {
        await redis.quit().catch(() => redis.disconnect());
        logger.info('Redis connection closed.');
      }
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown.');
      process.exit(1);
      return;
    }

    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Last-line-of-defence handlers: fatal errors that escape a request
  // handler MUST tear the process down and let the orchestrator restart
  // it. Continuing to serve traffic with corrupted state is worse than
  // a brief 503.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandledRejection — initiating shutdown.');
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — initiating shutdown.');
    shutdown('uncaughtException');
  });
};

start().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error.');
  process.exit(1);
});

export default app;
