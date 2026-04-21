# Quiz Integrity — Policy & Boundaries

> Companion to STEP 49 of `STEPS.md`. This document is the honest answer
> to "how do you stop people cheating on the quizzes?". The summary is:
> we don't, fully — and we don't pretend to.

---

## Threat model

A learner taking a quiz on a non-proctored, non-locked-down browser can:

- Open another tab and search the question text.
- Snap a screenshot and ask an LLM for the answer.
- Open DevTools and tamper with React state, the response payload, or
  the request body.
- Coordinate with another person via voice / chat.
- Take the quiz from a clean browser, fail it, and re-attempt with
  the answer key in hand.

**The only mitigation that defeats all of these is in-person or
service-grade proctoring** (Proctorio, Honorlock, ETS). We do not ship
that in v1, and we do not pretend our deterrents replace it.

---

## What we DO defend against

### Server-authoritative grading
- The `QuizAttempt` model **re-grades every submission server-side**
  in a `pre('validate')` hook by reloading the canonical Quiz from
  the database. Whatever the client puts in `score`, `correctCount`,
  `totalQuestions`, or `passed` is silently overwritten — there is no
  "trust the client" path.
- The student detail endpoint serves `quiz.toStudentView()` which
  strips `correctIndex` and `explanation`. Per-question feedback is
  emitted **only** in the response of `POST /quizzes/:id/submit`,
  after the answers are persisted.

### Mass-assignment / payload tampering
- `userId`, `courseId`, and `attemptedAt` are server-derived; the
  request body cannot influence them.
- `timeSpentSeconds` is clamped to `[0, timeLimit + 5s]` so a forged
  "I solved it in 0 seconds" cannot inflate leaderboards.
- `tabSwitches` is clamped to `[0, 9999]`.

### Rate-limited attempts
- The student-quiz router applies the global rate limiter; pathological
  retry storms are dropped before they hit the controller.

### Lightweight UI deterrents
| Deterrent                     | Wired in                          | Defeats by      |
| ----------------------------- | --------------------------------- | --------------- |
| Tab-switch counter            | `pages/student/QuizPage.jsx`      | DevTools        |
| Copy / right-click block      | `QuestionCard` in `QuizPage.jsx`  | DevTools        |
| `user-select: none` on `.quiz-question` | `client/src/index.css` | DevTools  |
| `@media print { display: none }` on `.quiz-page` | `client/src/index.css` | DevTools |
| `beforeunload` warning        | `pages/student/QuizPage.jsx`      | "Leave anyway"  |

These are **deterrents, not gates**. They make casual cheating require
deliberate, visible effort. They never block a determined attempt.

---

## What we DO NOT defend against

- Screen capture / OCR.
- A second device on the desk reading the questions to a friend.
- Browser extensions that auto-fill quizzes.
- Any client-side state inspection (DevTools is always available).
- Re-attempts after a failed run — multiple attempts are intentionally
  allowed (the dashboard surfaces the **best** score) so iterative
  practice is the design, not a bug.

---

## `tabSwitches` — what it is and isn't

The counter is a **signal**, not a verdict.

- It increments every time `document.visibilityState` becomes `hidden`
  during the `taking` phase — which happens for legitimate reasons
  too: an OS notification, a Slack DM, an incoming call, the iOS app
  switcher, a Bluetooth pairing dialog.
- We **never** auto-fail an attempt based on `tabSwitches`. It is
  surfaced on the persisted `QuizAttempt` so an instructor can
  correlate suspicious score swings with unusually high counts during
  manual review.
- The toast that fires on tab-switch is intentional — the perception
  of being watched is doing most of the deterrent work.

---

## Future hardening (not in v1)

When the platform graduates from "honor-system practice quizzes" to
"high-stakes assessments" the realistic upgrade path is:

1. **Per-attempt question shuffling** — randomise question + option
   order so screenshot trading is useless.
2. **Question bank rotation** — pick N from M so two learners rarely
   see the same paper.
3. **Server-driven timing** — the timer becomes authoritative on the
   server (one shot, locked at start time) instead of client-managed.
4. **Webcam proctoring integration** (Proctorio / Honorlock) for the
   handful of courses that need a real exam tier.

None of these are scheduled today. When they ship, this document is
where the policy boundaries get re-drawn.
