/**
 * Validation chains for the `/api/sections` and
 * `/api/courses/:courseId/sections` route groups.
 *
 * The `mongoIdParam` helper is shared with the course validator so a
 * single regex powers every ObjectId path-param check across the API.
 *
 * Notes:
 *  - `courseId`, `sectionId`, and `order` are NEVER accepted from the
 *    request body — they are server-derived from the URL params and the
 *    auto-numbering logic in the controller. Mass assignment is blocked
 *    downstream by `pickFields`, so the validator only inspects the one
 *    user-editable field (`title`).
 *  - The reorder body is a bare JSON array (`[{ id, order }, ...]`).
 *    express-validator supports root arrays via `body()` plus the `*`
 *    wildcard for per-item fields.
 */

import { body } from 'express-validator';

import { mongoIdParam } from './course.validator.js';

const REORDER_MIN_ITEMS = 1;
const REORDER_MAX_ITEMS = 200;

const titleChain = ({ optional = false } = {}) => {
  const chain = body('title');
  if (optional) chain.optional();
  return chain
    .isString()
    .withMessage('Title must be a string.')
    .bail()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage('Title must be between 3 and 120 characters.');
};

const reorderItemsChains = () => [
  body()
    .isArray({ min: REORDER_MIN_ITEMS, max: REORDER_MAX_ITEMS })
    .withMessage(
      `Body must be an array of ${REORDER_MIN_ITEMS}-${REORDER_MAX_ITEMS} { id, order } items.`,
    ),
  body('*.id').isMongoId().withMessage('Each item must include a valid id.'),
  body('*.order')
    .isInt({ min: 0 })
    .withMessage('Each item order must be a non-negative integer.')
    .bail()
    .toInt(),
];

export const createSectionValidator = [mongoIdParam('courseId'), titleChain()];

export const updateSectionValidator = [mongoIdParam('id'), titleChain({ optional: true })];

export const sectionIdParamValidator = [mongoIdParam('id')];

export const reorderSectionsValidator = [mongoIdParam('courseId'), ...reorderItemsChains()];

export default {
  createSectionValidator,
  updateSectionValidator,
  sectionIdParamValidator,
  reorderSectionsValidator,
};
