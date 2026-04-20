/**
 * LMS API — Express 5 entry point.
 *
 * Middleware ordering follows STEP 2 of the build guide. Order matters:
 * security headers and CORS run before the body parsers, sanitization runs
 * after parsing, the global rate limiter wraps every route, and the error
 * handlers stay last so they catch anything that throws above them.
 *
 * EXPRESS 5 NOTE: `req.query` is a read-only getter, so the `express-mongo-
 * sanitize` middleware (which mutates req.query) crashes when used as
 * `app.use(mongoSanitize())`. We sanitize `req.body` and `req.params` only,
 * which is sufficient because Mongoose query operators in URL query strings
 * are blocked by validators before they reach the database.
 */

import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/course.routes.js';
import lessonRoutes from './routes/lesson.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import sectionRoutes, { courseSectionsRouter } from './routes/section.routes.js';
import uploadRoutes from './routes/upload.routes.js';

const app = express();

// 1) Strip Express fingerprinting header.
app.disable('x-powered-by');

// 2) Security headers (CSP is tightened in a later hardening step).
app.use(helmet());

// 3) CORS — allowlist driven by env (CLIENT_URL + optional CORS_ORIGINS).
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server requests with no Origin header.
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

// 4) Body parsers — capped at 10 KB to mitigate payload-DoS.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5) Mongo-sanitize on body + params only (Express 5 safe — see file header).
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// 6) Request logging (dev only — pino-http takes over in a later step).
if (!env.isProd) {
  app.use(morgan('dev'));
}

// 7) Global rate limiter.
//    NOTE: A Redis-backed factory (`apiLimiter`) lands in the rate-limit step;
//    until then we use an in-memory limiter with the same window/limit defaults.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// 8) Health check — used by uptime probes and load balancers.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// 9) Feature route modules — mounted under /api/*. Additional groups
//    (quizzes, enrollments, …) are added by later steps.
//
//    Mount order note: the course-scoped sections sub-router
//    (`/api/courses/:courseId/sections/...`) is registered BEFORE the
//    bare course router so its more specific path wins the match
//    instead of being shadowed by `/api/courses/:id`.
app.use('/api/auth', authRoutes);
app.use('/api/courses/:courseId/sections', courseSectionsRouter);
app.use('/api/courses', courseRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/upload', uploadRoutes);

// 10) 404 handler — must come after all real routes.
app.use(notFound);

// 11) Error handler — must be the last middleware. Express 5 forwards
//     thrown errors and rejected promises here automatically.
app.use(errorHandler);

const start = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] LMS API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received — shutting down gracefully.`);
    server.close(() => process.exit(0));
    // Force-exit if connections hang for too long.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

export default app;
