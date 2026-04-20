/**
 * Section route group — exposes two routers because the URL hierarchy
 * spans two prefixes:
 *
 *   `courseSectionsRouter` is mounted at `/api/courses/:courseId/sections`
 *   and (with `mergeParams: true`) inherits the `:courseId` path param.
 *   It owns the create + reorder endpoints that need parent-scoped
 *   ownership checks.
 *
 *     POST  /                  → create a section under the course
 *     PATCH /reorder           → reorder all sections in the course
 *
 *   The `default` router is mounted at `/api/sections` and owns
 *   operations addressed by section id alone, plus the nested lesson
 *   create/reorder endpoints that flow through `/api/sections/:sectionId/...`
 *
 *     POST  /:sectionId/lessons          → create lesson in section
 *     PATCH /:sectionId/lessons/reorder  → reorder lessons in section
 *     PATCH /:id                          → rename section
 *     DELETE /:id                         → delete section (cascade)
 *
 * Route ordering: `/:sectionId/lessons/reorder` and `/:sectionId/lessons`
 * MUST precede the generic `/:id` matcher, otherwise Express would
 * capture `lessons` (or `lessons/reorder`) as a section id and the
 * lesson handlers would never run.
 */

import { Router } from 'express';

import {
  createLesson,
  reorderLessons,
} from '../controllers/lesson.controller.js';
import {
  createSection,
  deleteSection,
  reorderSections,
  updateSection,
} from '../controllers/section.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { instructorOrAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createLessonValidator,
  reorderLessonsValidator,
} from '../validators/lesson.validator.js';
import {
  createSectionValidator,
  reorderSectionsValidator,
  sectionIdParamValidator,
  updateSectionValidator,
} from '../validators/section.validator.js';

// Mounted at `/api/courses/:courseId/sections`. `mergeParams` so the
// validators and controllers see the inherited `:courseId` path param.
export const courseSectionsRouter = Router({ mergeParams: true });

courseSectionsRouter.use(protect, instructorOrAdmin);

// `/reorder` is declared BEFORE `/` so the static segment wins the
// match before the bare-create handler runs (express matches in order,
// but both endpoints use different methods so this is mostly defensive).
courseSectionsRouter.patch('/reorder', validate(reorderSectionsValidator), reorderSections);
courseSectionsRouter.post('/', validate(createSectionValidator), createSection);

// Mounted at `/api/sections`. Auth + role gate applied once here.
const sectionRouter = Router();

sectionRouter.use(protect, instructorOrAdmin);

// Nested lesson create + reorder endpoints — declared BEFORE the
// generic `/:id` matcher to keep `lessons` (and `lessons/reorder`)
// from being swallowed as a section id.
sectionRouter.patch(
  '/:sectionId/lessons/reorder',
  validate(reorderLessonsValidator),
  reorderLessons,
);
sectionRouter.post('/:sectionId/lessons', validate(createLessonValidator), createLesson);

sectionRouter
  .route('/:id')
  .patch(validate(updateSectionValidator), updateSection)
  .delete(validate(sectionIdParamValidator), deleteSection);

export default sectionRouter;
