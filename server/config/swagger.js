/**
 * Swagger / OpenAPI configuration.
 *
 * Generates an OpenAPI 3.0 document from JSDoc comments in route files.
 * The document is served at `/api-docs` (interactive UI) and `/api-docs.json`
 * (raw JSON spec) by `index.js`.
 *
 * - The `info.contact` block embeds the maintainer details so anyone hitting
 *   the docs knows who built/owns the API.
 * - `servers` is populated from `env.CLIENT_URL` / `env.PORT` so the "Try it
 *   out" button targets the right base URL in dev and prod.
 * - `securitySchemes.bearerAuth` mirrors the JWT access-token contract used by
 *   `protect`; routes can opt-in via `security: [{ bearerAuth: [] }]`.
 * - The `apis` glob scans every `routes/*.js` and `controllers/*.js` so future
 *   `@openapi` JSDoc blocks are picked up automatically.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import swaggerJsdoc from 'swagger-jsdoc';

import { env } from './env.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

const apiBaseUrl = env.isProd
  ? env.CLIENT_URL.replace(/\/$/, '')
  : `http://localhost:${env.PORT}`;

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Lumen LMS API',
    version: pkg.version,
    description:
      'Production-grade Learning Management System REST API — authentication, courses, sections, lessons, quizzes, enrollments, progress tracking, uploads, and admin moderation.',
    contact: {
      name: 'Serkanby',
      url: 'https://serkanbayraktar.com/',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: apiBaseUrl,
      description: env.isProd ? 'Production' : 'Local development',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Registration, login, password & session management' },
    { name: 'Users', description: 'Public profile reads and self-service updates' },
    { name: 'Courses', description: 'Catalog, course CRUD, draft → review → publish lifecycle' },
    { name: 'Sections', description: 'Curriculum sections (ordered groups of lessons)' },
    { name: 'Lessons', description: 'Video / text lessons inside a section' },
    { name: 'Quizzes', description: 'Quiz authoring & student submission (graded server-side)' },
    { name: 'Enrollments', description: 'Student enrollment lifecycle' },
    { name: 'Progress', description: 'Lesson completion tracking & certificate eligibility' },
    { name: 'Uploads', description: 'Cloudinary signed uploads for images and video' },
    { name: 'Instructors', description: 'Public instructor profiles & course rosters' },
    { name: 'Admin', description: 'Platform metrics, user management, moderation queue' },
    { name: 'System', description: 'Health checks & infrastructure endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Short-lived access token issued by `POST /api/auth/login`. Send as `Authorization: Bearer <token>`.',
      },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: env.REFRESH_COOKIE_NAME ?? 'lms.refresh',
        description:
          'HttpOnly refresh-token cookie set on login and rotated on every `POST /api/auth/refresh` call.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Validation failed.' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Email is required.' },
              },
            },
          },
        },
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          uptime: { type: 'number', example: 1234.56 },
          timestamp: { type: 'string', format: 'date-time' },
          env: { type: 'string', example: 'production' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid access token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Authenticated but lacks the required role / ownership.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource does not exist.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Request body or params failed validation.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Too many requests — see `Retry-After` header.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  security: [],
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness probe',
        description: 'Returns process uptime, environment, and timestamp. Used by Render and uptime monitors.',
        responses: {
          200: {
            description: 'Service is up.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [
    path.join(serverRoot, 'routes', '*.js'),
    path.join(serverRoot, 'controllers', '*.js'),
  ],
});

export const swaggerUiOptions = {
  customSiteTitle: 'Lumen LMS API — Reference',
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #1e1b4b; }
    .swagger-ui .info .title small { background: #f59e0b; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    tryItOutEnabled: true,
  },
};

export default swaggerSpec;
