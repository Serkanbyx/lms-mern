/**
 * Validation chains for the `/api/lessons` and
 * `/api/sections/:sectionId/lessons` route groups.
 *
 * The validator deliberately mirrors the model's field-level constraints
 * (HTTPS-only video URLs, public-id namespace allowlist, content length,
 * type/provider enums) so request bodies are rejected at the edge before
 * a Mongoose validation round-trip is needed. The model retains the same
 * checks as a defense-in-depth layer for any future direct write paths.
 *
 * Conditional rules (e.g. "video lessons must have a videoUrl") live on
 * the schema instead of being duplicated here — Mongoose runs them on
 * `.save()` and surfaces a `ValidationError` that the central error
 * middleware translates into a 422.
 */

import { body } from 'express-validator';

import {
  LESSON_CONTENT_MAX_LENGTH,
  LESSON_TYPE_VALUES,
  LESSON_VIDEO_PROVIDERS,
} from '../models/Lesson.model.js';
import { mongoIdParam } from './course.validator.js';

const HTTPS_URL_REGEX = /^https:\/\/[^\s]+$/i;
const PUBLIC_ID_PATTERN = /^lms\/[\w/-]+$/;
const REORDER_MIN_ITEMS = 1;
const REORDER_MAX_ITEMS = 500;

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

const typeChain = ({ optional = false } = {}) => {
  const chain = body('type');
  if (optional) chain.optional();
  return chain
    .isIn(LESSON_TYPE_VALUES)
    .withMessage(`Type must be one of: ${LESSON_TYPE_VALUES.join(', ')}.`);
};

const videoUrlChain = () =>
  body('videoUrl')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('videoUrl must be a string.')
    .bail()
    .matches(HTTPS_URL_REGEX)
    .withMessage('videoUrl must be a valid HTTPS URL.');

const videoPublicIdChain = () =>
  body('videoPublicId')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('videoPublicId must be a string.')
    .bail()
    .matches(PUBLIC_ID_PATTERN)
    .withMessage('videoPublicId must match the pattern "lms/...".');

const videoProviderChain = () =>
  body('videoProvider')
    .optional()
    .isIn(LESSON_VIDEO_PROVIDERS)
    .withMessage(`videoProvider must be one of: ${LESSON_VIDEO_PROVIDERS.join(', ')}.`);

const contentChain = () =>
  body('content')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Content must be a string.')
    .bail()
    .isLength({ max: LESSON_CONTENT_MAX_LENGTH })
    .withMessage(`Content must be at most ${LESSON_CONTENT_MAX_LENGTH} characters.`);

const durationChain = () =>
  body('duration')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Duration must be a non-negative number (seconds).')
    .bail()
    .toFloat();

const isFreePreviewChain = () =>
  body('isFreePreview')
    .optional()
    .isBoolean()
    .withMessage('isFreePreview must be a boolean.')
    .bail()
    .toBoolean();

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

export const createLessonValidator = [
  mongoIdParam('sectionId'),
  titleChain(),
  typeChain(),
  videoUrlChain(),
  videoPublicIdChain(),
  videoProviderChain(),
  contentChain(),
  durationChain(),
  isFreePreviewChain(),
];

export const updateLessonValidator = [
  mongoIdParam('id'),
  titleChain({ optional: true }),
  typeChain({ optional: true }),
  videoUrlChain(),
  videoPublicIdChain(),
  videoProviderChain(),
  contentChain(),
  durationChain(),
  isFreePreviewChain(),
];

export const lessonIdParamValidator = [mongoIdParam('id')];

export const reorderLessonsValidator = [mongoIdParam('sectionId'), ...reorderItemsChains()];

export default {
  createLessonValidator,
  updateLessonValidator,
  lessonIdParamValidator,
  reorderLessonsValidator,
};
