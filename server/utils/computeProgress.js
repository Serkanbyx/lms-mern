/**
 * Pure progress calculator shared by enrollment hooks, controllers, and
 * (future) UI dashboards.
 *
 * Centralizing the formula here means every consumer reaches the same
 * conclusion about "what does X / Y completed lessons mean as a percent
 * and is the course finished?". Drift between client and server progress
 * bars is one of the classic LMS bugs — a single source of truth keeps
 * the percentage we display, the percentage we store on
 * `Enrollment.progressPercent`, and the rule that triggers
 * `completedAt` perfectly aligned.
 *
 * Behavioural guarantees:
 *  - Always returns a finite, integer percent in [0, 100].
 *  - Guards against divide-by-zero when a course has no lessons yet.
 *  - Rejects bogus inputs (negatives, NaN, non-numbers) by clamping to 0
 *    rather than throwing — callers (mongoose hooks, controllers) can
 *    rely on a deterministic shape without a try/catch wrapper.
 *  - `isComplete` is strictly `completed >= total && total > 0`, so an
 *    empty course never reports 100% completion (which would otherwise
 *    issue certificates for nothing).
 */

const toSafeCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export const computeProgress = (completedCount, totalLessons) => {
  const completed = toSafeCount(completedCount);
  const total = toSafeCount(totalLessons);

  if (total === 0) {
    return { percent: 0, isComplete: false };
  }

  const ratio = Math.min(completed, total) / total;
  const percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
  const isComplete = completed >= total;

  return { percent, isComplete };
};

export default computeProgress;
