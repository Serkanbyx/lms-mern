/**
 * `/api/enrollments` route group — student-facing dashboard feed.
 *
 * Course-scoped enrollment endpoints (enroll, get-for-course, unenroll,
 * progress) live on the `/api/courses/:id/...` router so the URL
 * matches the resource hierarchy and ownership-by-course is enforced
 * by the same param. This router exists solely for the cross-course
 * "list everything I am enrolled in" feed which has no natural parent
 * course id to anchor it under.
 *
 * Endpoints:
 *   GET /mine — paginated list of the requester's enrollments
 *               (?status=all|in-progress|completed, ?page, ?limit)
 *
 * The router gate uses `protect` only — students, instructors, and
 * admins all consume the same dashboard surface, so we deliberately do
 * NOT add `instructorOrAdmin`.
 */

import { Router } from 'express';

import { getMyEnrollments } from '../controllers/enrollment.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { myEnrollmentsValidator } from '../validators/enrollment.validator.js';

const router = Router();

router.use(protect);

router.get('/mine', validate(myEnrollmentsValidator), getMyEnrollments);

export default router;
