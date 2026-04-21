/**
 * Quiz service — wraps the student + instructor quiz routes.
 *
 * Two routers share the `/api/quizzes` prefix on the backend:
 *   - Student:    GET /:id, POST /:id/submit, GET /:id/attempts/mine,
 *                 GET /:id/best/mine.
 *   - Instructor: PATCH /:id, DELETE /:id, GET /:id/instructor.
 *
 * Quiz CREATION sits on the lesson router (one quiz per lesson):
 *   POST /api/lessons/:lessonId/quiz
 */

import api from '../api/axios.js';
import { PAGINATION_DEFAULTS } from '../utils/constants.js';

export const getQuiz = async (id) => {
  const { data } = await api.get(`/quizzes/${id}`);
  return data;
};

/**
 * Submit a quiz attempt.
 *
 * Accepts either:
 *   - the legacy positional `answers` array (kept for backward compat), or
 *   - a full payload `{ answers, timeSpentSeconds }` so the player page
 *     can report wall-clock time. The server clamps `timeSpentSeconds`
 *     to the quiz's own `timeLimitSeconds + 5s` grace window, so a bogus
 *     value cannot under-report a slow run.
 *
 * Server response shape:
 *   { success, attemptId, score, correctCount, totalQuestions,
 *     passed, timeSpentSeconds, perQuestion }
 */
export const submitQuiz = async (id, payload) => {
  const body = Array.isArray(payload)
    ? { answers: payload }
    : {
        answers: payload?.answers ?? [],
        ...(Number.isInteger(payload?.timeSpentSeconds) && {
          timeSpentSeconds: payload.timeSpentSeconds,
        }),
      };
  const { data } = await api.post(`/quizzes/${id}/submit`, body);
  return data;
};

export const getMyAttempts = async (
  id,
  { page = PAGINATION_DEFAULTS.page, limit = PAGINATION_DEFAULTS.limit } = {},
) => {
  const { data } = await api.get(`/quizzes/${id}/attempts/mine`, {
    params: { page, limit },
  });
  return data;
};

export const getBestScore = async (id) => {
  const { data } = await api.get(`/quizzes/${id}/best/mine`);
  return data;
};

export const getQuizForInstructor = async (id) => {
  const { data } = await api.get(`/quizzes/${id}/instructor`);
  return data;
};

export const createQuiz = async (lessonId, payload) => {
  const { data } = await api.post(`/lessons/${lessonId}/quiz`, payload);
  return data;
};

export const updateQuiz = async (id, updates) => {
  const { data } = await api.patch(`/quizzes/${id}`, updates);
  return data;
};

export const deleteQuiz = async (id) => {
  const { data } = await api.delete(`/quizzes/${id}`);
  return data;
};

export default {
  getQuiz,
  submitQuiz,
  getMyAttempts,
  getBestScore,
  getQuizForInstructor,
  createQuiz,
  updateQuiz,
  deleteQuiz,
};
