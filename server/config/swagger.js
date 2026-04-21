/**
 * Swagger / OpenAPI configuration.
 *
 * Generates the OpenAPI 3.0.3 document served at:
 *   - `/api-docs`        interactive Swagger UI
 *   - `/api-docs.json`   raw JSON spec
 *
 * Design choices:
 *   - The full path catalogue is declared inline below (single source of
 *     truth). The `apis` glob is kept so future ad-hoc `@openapi` JSDoc
 *     blocks on routes/controllers are still picked up and merged.
 *   - `securitySchemes.bearerAuth` mirrors the JWT access-token contract
 *     used by `protect`. Routes opt-in via `security: [{ bearerAuth: [] }]`.
 *   - Reusable schemas (User, Course, Lesson, Section, Quiz, Enrollment, …)
 *     live under `components.schemas` so each operation references rather
 *     than duplicates them.
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

// ---------------------------------------------------------------------------
// Reusable response shorthands. Most controllers wrap their payload in
// `{ success, data }`; auth + admin endpoints occasionally return raw fields
// (`accessToken`, `user`). Both shapes are documented below.
// ---------------------------------------------------------------------------

const jsonResponse = (description, schemaRef) => ({
  description,
  content: { 'application/json': { schema: { $ref: schemaRef } } },
});

const errorResponses = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  409: { $ref: '#/components/responses/Conflict' },
  422: { $ref: '#/components/responses/ValidationError' },
  429: { $ref: '#/components/responses/RateLimited' },
};

const bearer = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Shared parameter shorthands.
// ---------------------------------------------------------------------------

const idParam = (name = 'id', description = 'MongoDB ObjectId') => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', pattern: '^[a-f0-9]{24}$', example: '6650b18a3a91c3a25c1f4c2a' },
});

const slugParam = {
  name: 'slug',
  in: 'path',
  required: true,
  description: 'URL-friendly course slug',
  schema: { type: 'string', example: 'modern-react-patterns' },
};

const tokenParam = {
  name: 'token',
  in: 'path',
  required: true,
  description: 'Single-use opaque token issued by email',
  schema: { type: 'string' },
};

const pageQuery = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Lumen LMS API',
    version: pkg.version,
    description:
      'Production-grade Learning Management System REST API — authentication, courses, sections, lessons, quizzes, enrollments, progress tracking, uploads, and admin moderation.',
    contact: { name: 'Serkanby', url: 'https://serkanbayraktar.com/' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [
    { url: apiBaseUrl, description: env.isProd ? 'Production' : 'Local development' },
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
      // ---------- Generic envelope --------------------------------------
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', additionalProperties: true },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
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
      Pagination: {
        type: 'object',
        properties: {
          items: { type: 'array', items: {} },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 142 },
          totalPages: { type: 'integer', example: 8 },
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

      // ---------- Domain models -----------------------------------------
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '6650b18a3a91c3a25c1f4c2a' },
          name: { type: 'string', example: 'Ada Lovelace' },
          email: { type: 'string', format: 'email', example: 'ada@example.com' },
          role: { type: 'string', enum: ['student', 'instructor', 'admin'], example: 'student' },
          avatarUrl: { type: 'string', format: 'uri' },
          headline: { type: 'string', example: 'Front-end engineer' },
          bio: { type: 'string' },
          isEmailVerified: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
          preferences: { type: 'object', additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          accessToken: { type: 'string', description: 'Short-lived JWT (15m default)' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      Course: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string', example: 'Modern React Patterns' },
          slug: { type: 'string', example: 'modern-react-patterns' },
          description: { type: 'string' },
          summary: { type: 'string' },
          thumbnailUrl: { type: 'string', format: 'uri' },
          level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          category: { type: 'string', example: 'Programming' },
          tags: { type: 'array', items: { type: 'string' } },
          price: { type: 'number', example: 0 },
          status: { type: 'string', enum: ['draft', 'pending', 'published', 'rejected', 'archived'] },
          instructor: { type: 'string', description: 'Instructor user id' },
          enrollmentCount: { type: 'integer', example: 0 },
          rating: { type: 'number', example: 4.8 },
          ratingCount: { type: 'integer', example: 0 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Section: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          courseId: { type: 'string' },
          title: { type: 'string', example: 'Hooks deep-dive' },
          order: { type: 'integer', example: 0 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Lesson: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          sectionId: { type: 'string' },
          title: { type: 'string', example: 'useEffect cleanup' },
          type: { type: 'string', enum: ['video', 'text'] },
          videoUrl: { type: 'string', format: 'uri' },
          videoPublicId: { type: 'string' },
          durationSec: { type: 'integer', example: 720 },
          content: { type: 'string', description: 'Markdown body for text lessons' },
          isFreePreview: { type: 'boolean', example: false },
          order: { type: 'integer', example: 0 },
          hasQuiz: { type: 'boolean', example: false },
        },
      },
      QuizQuestion: {
        type: 'object',
        properties: {
          prompt: { type: 'string', example: 'What does useState return?' },
          options: { type: 'array', items: { type: 'string' }, example: ['A pair', 'A function', 'An object', 'A promise'] },
          correctIndex: { type: 'integer', example: 0, description: 'Hidden from students' },
          explanation: { type: 'string', description: 'Hidden from students' },
        },
      },
      Quiz: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          lessonId: { type: 'string' },
          title: { type: 'string', example: 'Hooks quiz' },
          passingScore: { type: 'integer', example: 70 },
          questions: { type: 'array', items: { $ref: '#/components/schemas/QuizQuestion' } },
        },
      },
      QuizAttempt: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          quizId: { type: 'string' },
          userId: { type: 'string' },
          score: { type: 'integer', example: 80 },
          passed: { type: 'boolean', example: true },
          submittedAt: { type: 'string', format: 'date-time' },
        },
      },
      Enrollment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          courseId: { type: 'string' },
          userId: { type: 'string' },
          status: { type: 'string', enum: ['in-progress', 'completed'] },
          progressPercent: { type: 'number', example: 42.5 },
          completedLessonIds: { type: 'array', items: { type: 'string' } },
          lastAccessedLessonId: { type: 'string' },
          certificateIssuedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      UploadResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              publicId: { type: 'string' },
              width: { type: 'integer' },
              height: { type: 'integer' },
              duration: { type: 'number', description: 'Seconds (video only)' },
              bytes: { type: 'integer' },
              format: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: jsonResponse('Malformed request.', '#/components/schemas/ApiError'),
      Unauthorized: jsonResponse('Missing or invalid access token.', '#/components/schemas/ApiError'),
      Forbidden: jsonResponse('Authenticated but lacks the required role / ownership.', '#/components/schemas/ApiError'),
      NotFound: jsonResponse('Resource does not exist.', '#/components/schemas/ApiError'),
      Conflict: jsonResponse('Resource conflict (e.g. duplicate, already exists).', '#/components/schemas/ApiError'),
      ValidationError: jsonResponse('Request body or params failed validation.', '#/components/schemas/ApiError'),
      RateLimited: jsonResponse('Too many requests — see `Retry-After` header.', '#/components/schemas/ApiError'),
    },
  },
  security: [],
  paths: {
    // =====================================================================
    // SYSTEM
    // =====================================================================
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness probe',
        description: 'Returns process uptime, environment, and timestamp. Used by Render and uptime monitors.',
        responses: {
          200: jsonResponse('Service is up.', '#/components/schemas/HealthStatus'),
        },
      },
    },

    // =====================================================================
    // AUTH
    // =====================================================================
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create account & send verification email',
        description: 'Rate limited (10 / 15 min, IP+email keyed). Sends a verification email; the account is created in `isEmailVerified=false` state.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Ada Lovelace' },
                  email: { type: 'string', format: 'email', example: 'ada@example.com' },
                  password: { type: 'string', format: 'password', minLength: 8, example: 'StrongP@ssw0rd' },
                  role: { type: 'string', enum: ['student', 'instructor'], default: 'student' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Account created; verification email queued.', '#/components/schemas/AuthSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user',
        description: 'Email + password login. Sets HttpOnly refresh cookie and returns a short-lived access token. Rate limited (10 / 15 min) with IP+email keyed lockout.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'ada@example.com' },
                  password: { type: 'string', format: 'password', example: 'StrongP@ssw0rd' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Login successful.', '#/components/schemas/AuthSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate access token',
        description: 'Reads the HttpOnly refresh cookie, rotates it, and issues a new access token. Rate limited 30 / 1 min.',
        responses: {
          200: jsonResponse('Refreshed.', '#/components/schemas/AuthSuccess'),
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/auth/verify-email/{token}': {
      get: {
        tags: ['Auth'],
        summary: 'Confirm email address',
        description: 'Consumes the verification token emailed to the user. Idempotent — already-verified accounts return 200.',
        parameters: [tokenParam],
        responses: {
          200: jsonResponse('Email verified.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification email',
        description: 'Rate limited 5 / 15 min. Always returns 200 (anti-enumeration).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Email queued (if account exists).', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password-reset email',
        description: 'Always returns 200 to prevent account enumeration. Rate limited 3 / 1 hour (IP+email keyed).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Reset email queued (if account exists).', '#/components/schemas/ApiSuccess'),
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/api/auth/reset-password/{token}': {
      post: {
        tags: ['Auth'],
        summary: 'Consume reset link & set new password',
        description: 'Rate limited 5 / 15 min (IP+token keyed). Bumps `tokenVersion` so all existing sessions are invalidated.',
        parameters: [tokenParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: { password: { type: 'string', format: 'password', minLength: 8 } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Password updated.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user profile',
        security: bearer,
        responses: {
          200: jsonResponse('Authenticated user.', '#/components/schemas/User'),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        description: 'Partial update — only the fields below are accepted.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  avatarUrl: { type: 'string', format: 'uri' },
                  bio: { type: 'string' },
                  headline: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated.', '#/components/schemas/User'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Delete own account',
        description: 'Requires current password. Rate limited 5 / 15 min (user-id keyed).',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: { password: { type: 'string', format: 'password' } },
              },
            },
          },
        },
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },
    '/api/auth/me/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change password',
        description: 'Bumps `tokenVersion` → invalidates every existing session. Rate limited 5 / 15 min.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', format: 'password' },
                  newPassword: { type: 'string', format: 'password', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Password changed.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Clear refresh-token cookie',
        security: bearer,
        responses: {
          200: jsonResponse('Logged out.', '#/components/schemas/ApiSuccess'),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Logout from every session',
        description: 'Bumps `tokenVersion` → all existing JWTs are rejected on next request.',
        security: bearer,
        responses: {
          200: jsonResponse('All sessions invalidated.', '#/components/schemas/ApiSuccess'),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // =====================================================================
    // USERS
    // =====================================================================
    '/api/users/me/preferences': {
      patch: {
        tags: ['Users'],
        summary: 'Update my preferences',
        description: 'Partial update of `user.preferences` (theme, locale, notification toggles, privacy flags).',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                example: { theme: 'dark', locale: 'tr', privacy: { showEmail: false } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Preferences updated.', '#/components/schemas/User'),
          ...errorResponses,
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get public profile',
        description: 'Privacy filter is applied server-side (`preferences.privacy.*`).',
        parameters: [idParam('id', 'User ObjectId')],
        responses: {
          200: jsonResponse('Public profile.', '#/components/schemas/User'),
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // =====================================================================
    // COURSES
    // =====================================================================
    '/api/courses': {
      get: {
        tags: ['Courses'],
        summary: 'Public catalog',
        description: 'Filterable, paginated list of published courses. `optionalAuth` — owners/admins may see their own draft courses.',
        parameters: [
          ...pageQuery,
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text search' },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] } },
          { name: 'price', in: 'query', schema: { type: 'string', enum: ['free', 'paid'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'popular', 'rating', 'price-asc', 'price-desc'] } },
        ],
        responses: {
          200: jsonResponse('Paginated catalog.', '#/components/schemas/Pagination'),
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
      post: {
        tags: ['Courses'],
        summary: 'Create draft course',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  summary: { type: 'string' },
                  category: { type: 'string' },
                  level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                  tags: { type: 'array', items: { type: 'string' } },
                  price: { type: 'number' },
                  thumbnailUrl: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Draft created.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/mine': {
      get: {
        tags: ['Courses'],
        summary: 'Owner — my courses',
        description: 'Instructor / admin view: every course owned by the requester regardless of status.',
        security: bearer,
        parameters: pageQuery,
        responses: {
          200: jsonResponse('Owned courses.', '#/components/schemas/Pagination'),
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/courses/{slug}/curriculum': {
      get: {
        tags: ['Courses'],
        summary: 'Public curriculum',
        description: 'Sections + lessons tree. Lessons that are not free-preview are gated unless the requester is enrolled / owner / admin.',
        parameters: [slugParam],
        responses: {
          200: jsonResponse('Curriculum tree.', '#/components/schemas/ApiSuccess'),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/courses/{slug}': {
      get: {
        tags: ['Courses'],
        summary: 'Public course detail',
        parameters: [slugParam],
        responses: {
          200: jsonResponse('Course detail.', '#/components/schemas/Course'),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/courses/{id}/enroll': {
      post: {
        tags: ['Courses'],
        summary: 'Enroll in a course',
        description: 'Rate limited 10 / 1 min per user. Idempotent — returns existing enrollment if already enrolled.',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          201: jsonResponse('Enrolled.', '#/components/schemas/Enrollment'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Courses'],
        summary: 'Unenroll',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          204: { description: 'Unenrolled.' },
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}/enrollment': {
      get: {
        tags: ['Courses'],
        summary: 'My enrollment for this course',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Enrollment.', '#/components/schemas/Enrollment'),
          404: { $ref: '#/components/responses/NotFound' },
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}/progress': {
      get: {
        tags: ['Courses'],
        summary: 'My progress for this course',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Progress payload.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}/certificate': {
      post: {
        tags: ['Courses'],
        summary: 'Issue completion certificate',
        description: 'Allowed only when `progressPercent === 100`. Stamps `certificateIssuedAt` on the enrollment.',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Certificate issued.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}/submit': {
      post: {
        tags: ['Courses'],
        summary: 'Submit draft for review',
        description: 'Promotes `draft → pending`. Owner / admin only.',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Submitted.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}/archive': {
      post: {
        tags: ['Courses'],
        summary: 'Archive a published course',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Archived.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/{id}': {
      patch: {
        tags: ['Courses'],
        summary: 'Update course',
        description: 'Partial update of soft fields (title, description, thumbnail, price, tags…).',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Course' } } },
        },
        responses: {
          200: jsonResponse('Updated.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Courses'],
        summary: 'Delete course',
        description: 'Cascade-delete sections, lessons, quizzes, enrollments. Blocked if enrollments exist (use admin force-delete instead).',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // SECTIONS
    // =====================================================================
    '/api/courses/{courseId}/sections': {
      post: {
        tags: ['Sections'],
        summary: 'Create section under a course',
        security: bearer,
        parameters: [idParam('courseId', 'Course ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: { title: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Section created.', '#/components/schemas/Section'),
          ...errorResponses,
        },
      },
    },
    '/api/courses/{courseId}/sections/reorder': {
      patch: {
        tags: ['Sections'],
        summary: 'Reorder all sections in a course',
        security: bearer,
        parameters: [idParam('courseId', 'Course ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderedIds'],
                properties: {
                  orderedIds: { type: 'array', items: { type: 'string' }, description: 'Section ids in their new order' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Reordered.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/sections/{sectionId}/lessons': {
      post: {
        tags: ['Lessons'],
        summary: 'Create lesson in a section',
        security: bearer,
        parameters: [idParam('sectionId', 'Section ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'type'],
                properties: {
                  title: { type: 'string' },
                  type: { type: 'string', enum: ['video', 'text'] },
                  videoUrl: { type: 'string', format: 'uri' },
                  videoPublicId: { type: 'string' },
                  durationSec: { type: 'integer' },
                  content: { type: 'string' },
                  isFreePreview: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Lesson created.', '#/components/schemas/Lesson'),
          ...errorResponses,
        },
      },
    },
    '/api/sections/{sectionId}/lessons/reorder': {
      patch: {
        tags: ['Lessons'],
        summary: 'Reorder lessons in a section',
        security: bearer,
        parameters: [idParam('sectionId', 'Section ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderedIds'],
                properties: { orderedIds: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Reordered.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/sections/{id}': {
      patch: {
        tags: ['Sections'],
        summary: 'Rename section',
        security: bearer,
        parameters: [idParam('id', 'Section ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { title: { type: 'string' } } },
            },
          },
        },
        responses: {
          200: jsonResponse('Updated.', '#/components/schemas/Section'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Sections'],
        summary: 'Delete section (cascade)',
        description: 'Cascade-deletes all lessons and quizzes in the section.',
        security: bearer,
        parameters: [idParam('id', 'Section ObjectId')],
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // LESSONS (instructor surface)
    // =====================================================================
    '/api/lessons/{lessonId}/quiz': {
      get: {
        tags: ['Quizzes'],
        summary: 'Get quiz attached to a lesson (authoring)',
        description: 'Returns `{ quiz: null }` if no quiz exists yet — used by the authoring UI to bootstrap.',
        security: bearer,
        parameters: [idParam('lessonId', 'Lesson ObjectId')],
        responses: {
          200: jsonResponse('Quiz (or null).', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
      post: {
        tags: ['Quizzes'],
        summary: 'Create the quiz for a lesson',
        description: '409 if a quiz already exists (one quiz per lesson).',
        security: bearer,
        parameters: [idParam('lessonId', 'Lesson ObjectId')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Quiz' } } },
        },
        responses: {
          201: jsonResponse('Quiz created.', '#/components/schemas/Quiz'),
          ...errorResponses,
        },
      },
    },
    '/api/lessons/{id}': {
      get: {
        tags: ['Lessons'],
        summary: 'Instructor lesson detail',
        description: 'Full document including authoring-only fields.',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        responses: {
          200: jsonResponse('Lesson.', '#/components/schemas/Lesson'),
          ...errorResponses,
        },
      },
      patch: {
        tags: ['Lessons'],
        summary: 'Update lesson',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Lesson' } } },
        },
        responses: {
          200: jsonResponse('Updated.', '#/components/schemas/Lesson'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Lessons'],
        summary: 'Delete lesson',
        description: 'Cascade-deletes the attached quiz and removes the Cloudinary asset (if any).',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // QUIZZES — student surface
    // =====================================================================
    '/api/quizzes/{id}': {
      get: {
        tags: ['Quizzes'],
        summary: 'Student quiz detail',
        description: 'Returns the question stems and options without the answer key. Requester must be enrolled in the parent course.',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        responses: {
          200: jsonResponse('Quiz (no answer key).', '#/components/schemas/Quiz'),
          ...errorResponses,
        },
      },
      patch: {
        tags: ['Quizzes'],
        summary: 'Update quiz (instructor)',
        description: 'Partial update. Sending `questions` fully replaces the stored set.',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Quiz' } } },
        },
        responses: {
          200: jsonResponse('Updated.', '#/components/schemas/Quiz'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Quizzes'],
        summary: 'Delete quiz (instructor)',
        description: 'Sets `Lesson.hasQuiz = false` on the parent lesson.',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },
    '/api/quizzes/{id}/submit': {
      post: {
        tags: ['Quizzes'],
        summary: 'Submit quiz answers',
        description: 'Server-side grading. Rate limited 30 / 10 min per user.',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['answers'],
                properties: {
                  answers: {
                    type: 'array',
                    items: { type: 'integer', minimum: 0 },
                    description: 'Selected option index per question, in order.',
                    example: [0, 2, 1, 3],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Score + pass/fail breakdown.', '#/components/schemas/QuizAttempt'),
          ...errorResponses,
        },
      },
    },
    '/api/quizzes/{id}/attempts/mine': {
      get: {
        tags: ['Quizzes'],
        summary: 'My attempt history for a quiz',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId'), ...pageQuery],
        responses: {
          200: jsonResponse('Paginated attempts.', '#/components/schemas/Pagination'),
          ...errorResponses,
        },
      },
    },
    '/api/quizzes/{id}/best/mine': {
      get: {
        tags: ['Quizzes'],
        summary: 'My best score for a quiz',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        responses: {
          200: jsonResponse('Best score + total attempts.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/quizzes/{id}/instructor': {
      get: {
        tags: ['Quizzes'],
        summary: 'Authoring view (full document with answer key)',
        security: bearer,
        parameters: [idParam('id', 'Quiz ObjectId')],
        responses: {
          200: jsonResponse('Quiz with answer key.', '#/components/schemas/Quiz'),
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // ENROLLMENTS
    // =====================================================================
    '/api/enrollments/mine': {
      get: {
        tags: ['Enrollments'],
        summary: 'My enrollments (paginated)',
        security: bearer,
        parameters: [
          ...pageQuery,
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'in-progress', 'completed'], default: 'all' } },
        ],
        responses: {
          200: jsonResponse('Paginated enrollments.', '#/components/schemas/Pagination'),
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // PROGRESS (student lesson tracking)
    // =====================================================================
    '/api/lessons/{id}/complete': {
      post: {
        tags: ['Progress'],
        summary: 'Mark lesson complete',
        description: 'Idempotent. Recomputes `Enrollment.progressPercent`.',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        responses: {
          200: jsonResponse('Updated progress.', '#/components/schemas/Enrollment'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Progress'],
        summary: 'Mark lesson incomplete',
        description: 'Idempotent.',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        responses: {
          200: jsonResponse('Updated progress.', '#/components/schemas/Enrollment'),
          ...errorResponses,
        },
      },
    },
    '/api/lessons/{id}/access': {
      post: {
        tags: ['Progress'],
        summary: 'Record last-accessed lesson',
        description: 'Bumps the "Continue learning" pointer on the enrollment.',
        security: bearer,
        parameters: [idParam('id', 'Lesson ObjectId')],
        responses: {
          200: jsonResponse('Pointer updated.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // UPLOADS
    // =====================================================================
    '/api/upload/image': {
      post: {
        tags: ['Uploads'],
        summary: 'Upload course thumbnail',
        description: 'Multipart field name: `image`. Rate limited 20 / 10 min per IP.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { image: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Uploaded.', '#/components/schemas/UploadResult'),
          ...errorResponses,
        },
      },
    },
    '/api/upload/video': {
      post: {
        tags: ['Uploads'],
        summary: 'Upload lesson video',
        description: 'Multipart field name: `video`. Rate limited 20 / 10 min per IP.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { video: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Uploaded.', '#/components/schemas/UploadResult'),
          ...errorResponses,
        },
      },
    },
    '/api/upload/{publicId}': {
      delete: {
        tags: ['Uploads'],
        summary: 'Destroy a Cloudinary asset',
        security: bearer,
        parameters: [
          {
            name: 'publicId',
            in: 'path',
            required: true,
            description: 'URL-encoded Cloudinary `public_id` (e.g. `lumen/courses/abc123`).',
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: { description: 'Destroyed.' },
          ...errorResponses,
        },
      },
    },

    // =====================================================================
    // INSTRUCTORS (public)
    // =====================================================================
    '/api/instructors/{id}/courses': {
      get: {
        tags: ['Instructors'],
        summary: 'Public courses by instructor',
        parameters: [idParam('id', 'Instructor (user) ObjectId'), ...pageQuery],
        responses: {
          200: jsonResponse('Paginated published courses.', '#/components/schemas/Pagination'),
          404: { $ref: '#/components/responses/NotFound' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // =====================================================================
    // ADMIN
    // =====================================================================
    '/api/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Dashboard aggregate counters',
        description: 'Total users, active users, total/published courses, total enrollments, recent signups, etc.',
        security: bearer,
        responses: {
          200: jsonResponse('Stats payload.', '#/components/schemas/ApiSuccess'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Paginated user directory',
        security: bearer,
        parameters: [
          ...pageQuery,
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search by name / email' },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['student', 'instructor', 'admin'] } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: jsonResponse('Paginated users.', '#/components/schemas/Pagination'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Full user record + derived counters',
        security: bearer,
        parameters: [idParam('id', 'User ObjectId')],
        responses: {
          200: jsonResponse('User detail.', '#/components/schemas/User'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Hard delete user (cascade)',
        description: 'Removes all owned courses, enrollments, attempts. Last-admin guard prevents deleting the only admin.',
        security: bearer,
        parameters: [idParam('id', 'User ObjectId')],
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
        },
      },
    },
    '/api/admin/users/{id}/role': {
      patch: {
        tags: ['Admin'],
        summary: 'Promote / demote user',
        security: bearer,
        parameters: [idParam('id', 'User ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: { role: { type: 'string', enum: ['student', 'instructor', 'admin'] } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Role updated.', '#/components/schemas/User'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/users/{id}/active': {
      patch: {
        tags: ['Admin'],
        summary: 'Enable / disable user',
        description: 'Inactive users are logged out on next request (token rejected).',
        security: bearer,
        parameters: [idParam('id', 'User ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: { isActive: { type: 'boolean' } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Toggled.', '#/components/schemas/User'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses': {
      get: {
        tags: ['Admin'],
        summary: 'Course directory (any status)',
        security: bearer,
        parameters: [
          ...pageQuery,
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'pending', 'published', 'rejected', 'archived'] } },
        ],
        responses: {
          200: jsonResponse('Paginated courses.', '#/components/schemas/Pagination'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses/pending': {
      get: {
        tags: ['Admin'],
        summary: 'Moderation queue (status=pending)',
        security: bearer,
        responses: {
          200: jsonResponse('Pending courses.', '#/components/schemas/Pagination'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses/{id}/approve': {
      post: {
        tags: ['Admin'],
        summary: 'Approve pending course → published',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Approved.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses/{id}/reject': {
      post: {
        tags: ['Admin'],
        summary: 'Reject pending course (with reason)',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', minLength: 5 } },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Rejected.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses/{id}/archive': {
      post: {
        tags: ['Admin'],
        summary: 'Force-archive any course',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        responses: {
          200: jsonResponse('Archived.', '#/components/schemas/Course'),
          ...errorResponses,
        },
      },
    },
    '/api/admin/courses/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Force-delete course (cascade)',
        description: 'Requires `{ confirm: true }` in the body. Cascade-deletes sections, lessons, quizzes, enrollments.',
        security: bearer,
        parameters: [idParam('id', 'Course ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['confirm'],
                properties: { confirm: { type: 'boolean', enum: [true] } },
              },
            },
          },
        },
        responses: {
          204: { description: 'Deleted.' },
          ...errorResponses,
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
