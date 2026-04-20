/**
 * Validation chains for the instructor-facing quiz endpoints
 * (`/api/lessons/:lessonId/quiz`, `/api/quizzes/:id`,
 * `/api/quizzes/:id/instructor`).
 *
 * The validator mirrors the model's field-level constraints (question
 * count, option count, passing-score range, time-limit ceiling, per-
 * question `correctIndex` bounds) so malformed bodies are rejected at
 * the edge before a Mongoose round-trip is needed. The model retains
 * the same checks as a defense-in-depth layer for any future direct
 * write paths.
 *
 * Notes:
 *  - `lessonId` and `courseId` are NEVER accepted from the request
 *    body — the controller derives them from the URL param + a Lesson
 *    lookup. Mass assignment is blocked downstream by `pickFields`.
 *  - The `questions` array is treated as a full replacement on update
 *    (not a per-item patch), so the same `questionsChain` covers both
 *    create and update flows.
 *  - On update, the `questions` chain stays optional but, when present,
 *    must contain a fully valid set — partial / sparse arrays are not
 *    supported by the model.
 */

import { body } from 'express-validator';

import {
  QUIZ_OPTIONS_MAX_COUNT,
  QUIZ_OPTIONS_MIN_COUNT,
  QUIZ_PASSING_SCORE_MAX,
  QUIZ_PASSING_SCORE_MIN,
  QUIZ_QUESTIONS_MAX_COUNT,
  QUIZ_QUESTIONS_MIN_COUNT,
  QUIZ_TIME_LIMIT_MAX_SECONDS,
} from '../models/Quiz.model.js';
import { mongoIdParam } from './course.validator.js';

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;
const QUESTION_MIN_LENGTH = 5;
const QUESTION_MAX_LENGTH = 500;
const OPTION_MIN_LENGTH = 1;
const OPTION_MAX_LENGTH = 200;
const EXPLANATION_MAX_LENGTH = 500;

const titleChain = ({ optional = false } = {}) => {
  const chain = body('title');
  if (optional) chain.optional();
  return chain
    .isString()
    .withMessage('Title must be a string.')
    .bail()
    .trim()
    .isLength({ min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH })
    .withMessage(`Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`);
};

const descriptionChain = () =>
  body('description')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Description must be a string.')
    .bail()
    .trim()
    .isLength({ max: DESCRIPTION_MAX_LENGTH })
    .withMessage(`Description must be at most ${DESCRIPTION_MAX_LENGTH} characters.`);

const passingScoreChain = ({ optional = false } = {}) => {
  const chain = body('passingScore');
  if (optional) chain.optional();
  return chain
    .isInt({ min: QUIZ_PASSING_SCORE_MIN, max: QUIZ_PASSING_SCORE_MAX })
    .withMessage(
      `Passing score must be an integer between ${QUIZ_PASSING_SCORE_MIN} and ${QUIZ_PASSING_SCORE_MAX}.`,
    )
    .bail()
    .toInt();
};

const timeLimitChain = () =>
  body('timeLimitSeconds')
    .optional()
    .isInt({ min: 0, max: QUIZ_TIME_LIMIT_MAX_SECONDS })
    .withMessage(
      `Time limit must be an integer between 0 and ${QUIZ_TIME_LIMIT_MAX_SECONDS} seconds (0 disables the timer).`,
    )
    .bail()
    .toInt();

/**
 * Validates the full `questions` array in one chain. Each item must
 * carry a non-empty `question`, 2–6 non-empty `options`, and a
 * `correctIndex` integer that resolves to a real position inside that
 * item's `options` array. Cross-field rules like the index bound can't
 * be expressed with stand-alone wildcard validators — that's why this
 * is a single custom validator instead of a chain of `body('questions.*.x')`.
 */
const questionsChain = ({ optional = false } = {}) => {
  const chain = body('questions');
  if (optional) chain.optional();
  return chain
    .isArray({ min: QUIZ_QUESTIONS_MIN_COUNT, max: QUIZ_QUESTIONS_MAX_COUNT })
    .withMessage(
      `A quiz needs ${QUIZ_QUESTIONS_MIN_COUNT}-${QUIZ_QUESTIONS_MAX_COUNT} questions.`,
    )
    .bail()
    .custom((questions) => {
      questions.forEach((q, i) => {
        if (!q || typeof q !== 'object' || Array.isArray(q)) {
          throw new Error(`Question #${i + 1} must be an object.`);
        }

        if (
          typeof q.question !== 'string' ||
          q.question.trim().length < QUESTION_MIN_LENGTH ||
          q.question.trim().length > QUESTION_MAX_LENGTH
        ) {
          throw new Error(
            `Question #${i + 1} text must be between ${QUESTION_MIN_LENGTH} and ${QUESTION_MAX_LENGTH} characters.`,
          );
        }

        if (
          !Array.isArray(q.options) ||
          q.options.length < QUIZ_OPTIONS_MIN_COUNT ||
          q.options.length > QUIZ_OPTIONS_MAX_COUNT
        ) {
          throw new Error(
            `Question #${i + 1} needs ${QUIZ_OPTIONS_MIN_COUNT}-${QUIZ_OPTIONS_MAX_COUNT} options.`,
          );
        }

        const allOptionsValid = q.options.every(
          (opt) =>
            typeof opt === 'string' &&
            opt.trim().length >= OPTION_MIN_LENGTH &&
            opt.trim().length <= OPTION_MAX_LENGTH,
        );
        if (!allOptionsValid) {
          throw new Error(
            `Question #${i + 1} options must be non-empty strings up to ${OPTION_MAX_LENGTH} characters.`,
          );
        }

        if (
          !Number.isInteger(q.correctIndex) ||
          q.correctIndex < 0 ||
          q.correctIndex >= q.options.length
        ) {
          throw new Error(
            `Question #${i + 1} correctIndex must be an integer between 0 and ${q.options.length - 1}.`,
          );
        }

        if (q.explanation !== undefined && q.explanation !== null) {
          if (
            typeof q.explanation !== 'string' ||
            q.explanation.length > EXPLANATION_MAX_LENGTH
          ) {
            throw new Error(
              `Question #${i + 1} explanation must be a string up to ${EXPLANATION_MAX_LENGTH} characters.`,
            );
          }
        }
      });
      return true;
    });
};

export const createQuizValidator = [
  mongoIdParam('lessonId'),
  titleChain(),
  descriptionChain(),
  passingScoreChain({ optional: true }),
  timeLimitChain(),
  questionsChain(),
];

export const updateQuizValidator = [
  mongoIdParam('id'),
  titleChain({ optional: true }),
  descriptionChain(),
  passingScoreChain({ optional: true }),
  timeLimitChain(),
  questionsChain({ optional: true }),
];

export const quizIdParamValidator = [mongoIdParam('id')];

export default {
  createQuizValidator,
  updateQuizValidator,
  quizIdParamValidator,
};
