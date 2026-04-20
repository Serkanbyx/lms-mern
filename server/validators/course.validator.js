/**
 * Validation chains for the `/api/courses` route group (instructor side).
 *
 * Validation lives separate from controllers so the rules can be reused
 * (e.g. an admin "edit any course" endpoint sharing the same field policy)
 * and so the controller bodies stay focused on business logic.
 *
 * Notes:
 *  - We deliberately re-import the schema's frozen `COURSE_CATEGORIES` /
 *    `COURSE_LEVELS` enums so the validator and the model can never drift
 *    out of sync. A new category added to the schema instantly becomes
 *    accepted by the validator without a code change here.
 *  - Mass assignment is already blocked downstream by `pickFields`, so
 *    these chains intentionally do NOT validate `instructor`, `slug`,
 *    `status`, or any denormalized counter — those fields can never reach
 *    the controller payload regardless of what the client sends.
 *  - URL fields are restricted to HTTPS to match the schema's transport
 *    policy and to prevent mixed-content issues on the client.
 */

import { body, param } from 'express-validator';

import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
} from '../models/Course.model.js';

const TAG_MAX_LENGTH = 20;
const TAGS_MAX_COUNT = 10;
const REQUIREMENTS_MAX_COUNT = 10;
const OUTCOMES_MAX_COUNT = 10;
const REQUIREMENT_MAX_LENGTH = 200;
const OUTCOME_MAX_LENGTH = 200;
const PUBLIC_ID_PATTERN = /^lms\/[\w/-]+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStringWithin = (value, min, max) =>
  typeof value === 'string' && value.length >= min && value.length <= max;

const titleChain = ({ optional = false } = {}) => {
  const chain = body('title');
  if (optional) chain.optional();
  return chain
    .isString()
    .withMessage('Title must be a string.')
    .bail()
    .trim()
    .isLength({ min: 5, max: 120 })
    .withMessage('Title must be between 5 and 120 characters.');
};

const descriptionChain = ({ optional = false } = {}) => {
  const chain = body('description');
  if (optional) chain.optional();
  return chain
    .isString()
    .withMessage('Description must be a string.')
    .bail()
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be between 20 and 5000 characters.');
};

const shortDescriptionChain = () =>
  body('shortDescription')
    .optional()
    .isString()
    .withMessage('Short description must be a string.')
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Short description must be at most 200 characters.');

const priceChain = ({ optional = false } = {}) => {
  const chain = body('price');
  if (optional) chain.optional();
  return chain
    .isFloat({ min: 0, max: 9999 })
    .withMessage('Price must be a number between 0 and 9999.')
    .bail()
    .toFloat();
};

const categoryChain = ({ optional = false } = {}) => {
  const chain = body('category');
  if (optional) chain.optional();
  return chain
    .isIn(COURSE_CATEGORIES)
    .withMessage(`Category must be one of: ${COURSE_CATEGORIES.join(', ')}.`);
};

const levelChain = () =>
  body('level')
    .optional()
    .isIn(COURSE_LEVELS)
    .withMessage(`Level must be one of: ${COURSE_LEVELS.join(', ')}.`);

const languageChain = () =>
  body('language')
    .optional()
    .isString()
    .withMessage('Language must be a string.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language must be between 2 and 10 characters.');

const tagsChain = () =>
  body('tags')
    .optional()
    .isArray({ max: TAGS_MAX_COUNT })
    .withMessage(`Tags must be an array of at most ${TAGS_MAX_COUNT} items.`)
    .bail()
    .custom((tags) =>
      tags.every((tag) => isStringWithin(typeof tag === 'string' ? tag.trim() : tag, 1, TAG_MAX_LENGTH)),
    )
    .withMessage(`Each tag must be a 1–${TAG_MAX_LENGTH} character string.`);

const stringArrayChain = (field, { maxItems, maxLength, label }) =>
  body(field)
    .optional()
    .isArray({ max: maxItems })
    .withMessage(`${label} must be an array of at most ${maxItems} items.`)
    .bail()
    .custom((items) =>
      items.every((item) => isStringWithin(typeof item === 'string' ? item.trim() : item, 1, maxLength)),
    )
    .withMessage(`Each ${label.toLowerCase()} entry must be a 1–${maxLength} character string.`);

const thumbnailChain = () =>
  body('thumbnail')
    .optional()
    .custom((value) => {
      if (!isPlainObject(value)) {
        throw new Error('Thumbnail must be an object with `url` and/or `publicId`.');
      }
      if (value.url !== undefined) {
        if (typeof value.url !== 'string' || !/^https:\/\/[^\s]+$/i.test(value.url)) {
          throw new Error('Thumbnail URL must be a valid HTTPS URL.');
        }
      }
      if (value.publicId !== undefined) {
        if (typeof value.publicId !== 'string' || !PUBLIC_ID_PATTERN.test(value.publicId)) {
          throw new Error('Thumbnail publicId must match the pattern "lms/...".');
        }
      }
      return true;
    });

export const mongoIdParam = (name = 'id') =>
  param(name)
    .isMongoId()
    .withMessage(`Invalid ${name} format.`);

export const createCourseValidator = [
  titleChain(),
  descriptionChain(),
  shortDescriptionChain(),
  priceChain(),
  categoryChain(),
  levelChain(),
  languageChain(),
  tagsChain(),
  stringArrayChain('requirements', {
    maxItems: REQUIREMENTS_MAX_COUNT,
    maxLength: REQUIREMENT_MAX_LENGTH,
    label: 'Requirements',
  }),
  stringArrayChain('learningOutcomes', {
    maxItems: OUTCOMES_MAX_COUNT,
    maxLength: OUTCOME_MAX_LENGTH,
    label: 'Learning outcomes',
  }),
  thumbnailChain(),
];

export const updateCourseValidator = [
  mongoIdParam('id'),
  titleChain({ optional: true }),
  descriptionChain({ optional: true }),
  shortDescriptionChain(),
  priceChain({ optional: true }),
  categoryChain({ optional: true }),
  levelChain(),
  languageChain(),
  tagsChain(),
  stringArrayChain('requirements', {
    maxItems: REQUIREMENTS_MAX_COUNT,
    maxLength: REQUIREMENT_MAX_LENGTH,
    label: 'Requirements',
  }),
  stringArrayChain('learningOutcomes', {
    maxItems: OUTCOMES_MAX_COUNT,
    maxLength: OUTCOME_MAX_LENGTH,
    label: 'Learning outcomes',
  }),
  thumbnailChain(),
];

export const courseIdParamValidator = [mongoIdParam('id')];

export default {
  createCourseValidator,
  updateCourseValidator,
  courseIdParamValidator,
  mongoIdParam,
};
