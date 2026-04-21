/**
 * Student quiz player — `/courses/:slug/quiz/:quizId`.
 *
 * A small, explicit state machine drives the page through four phases:
 *   `intro` → `taking` → `submitting` → `results`
 * Each phase owns its own UI and side-effects, which keeps the JSX
 * shallow and the keyboard / timer wiring auditable.
 *
 *   - intro       : Splash card with title, description, meta. The
 *                   answer key has not been requested yet — only the
 *                   `toStudentView()` projection of the quiz lives in
 *                   memory, so refreshing the page never leaks
 *                   correctIndex.
 *   - taking      : One question at a time, answers buffered in local
 *                   state. Optional countdown clock chips top-right;
 *                   pulses when ≤30s remain and force-submits at 0.
 *   - submitting  : Spinner overlay while POST /submit is in flight.
 *                   Per-question feedback is RESPONSE-only (server
 *                   side) so this page never knew the answer key
 *                   client-side.
 *   - results     : Score ring + per-question review accordion + retake
 *                   / next-lesson actions. Confetti fires once on a
 *                   passing run (gated by `prefers-reduced-motion`
 *                   globally via the CSS animation guard).
 *
 * Integrity:
 *   - State lives in `useState` only — refreshing the page resets the
 *     run. Quiz attempt persistence is the server's job; the player UI
 *     is intentionally session-only so a learner cannot "save mid-quiz"
 *     and look up answers.
 *   - `beforeunload` warns if the user tries to close the tab while
 *     `step === 'taking'`. We don't try to intercept React Router
 *     navigation in v1 (no `<Prompt />` in v6, blocker API is unstable).
 *   - The student detail endpoint never returns `correctIndex` /
 *     `explanation`; both fields surface only in the submit response.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { SelectableCard } from '../../components/quiz/index.js';
import {
  Accordion,
  Badge,
  Button,
  Card,
  ConfettiBurst,
  ConfirmModal,
  EmptyState,
  Icon,
  IconButton,
  KBD,
  ProgressBar,
  ProgressRing,
  Spinner,
  toast,
} from '../../components/ui/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as courseService from '../../services/course.service.js';
import * as quizService from '../../services/quiz.service.js';
import { ROUTES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';
import { fadeUp } from '../../utils/motion.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_WARNING_THRESHOLD_SECONDS = 30;

const isEditableTarget = (target) => {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const flattenLessons = (sections = []) =>
  sections.flatMap((section) => section.lessons ?? []);

const initialMachine = {
  step: 'intro',
  currentIndex: 0,
  answers: [],
  startedAt: 0,
  timeLeft: undefined,
  result: null,
  // Lightweight integrity counter. Incremented every time
  // the page goes hidden (tab switch / minimised / mobile app switch).
  // Submitted alongside the answers and persisted on `QuizAttempt`.
  tabSwitches: 0,
};

/**
 * Anti-cheat: how often we toast the user about a tab
 * switch. We don't want to spam them once per ms when they're flipping
 * back and forth, so the toast respects a 4-second cooldown.
 */
const TAB_SWITCH_TOAST_COOLDOWN_MS = 4_000;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QuizPage() {
  const { slug, quizId } = useParams();
  const navigate = useNavigate();
  const radioName = useId();

  const [data, setData] = useState({
    status: 'loading',
    quiz: null,
    error: null,
  });
  const [bestScore, setBestScore] = useState(null);
  const [nextLesson, setNextLesson] = useState(null);
  const [confettiKey, setConfettiKey] = useState(null);
  const [machine, setMachine] = useState(initialMachine);

  const submittingRef = useRef(false);
  const machineRef = useRef(machine);

  useEffect(() => {
    machineRef.current = machine;
  }, [machine]);

  useDocumentTitle(data.quiz?.title ?? 'Quiz');

  // -------------------------------------------------------------------------
  // Data fetch — quiz (student view) + best score (best-effort, non-blocking).
  // -------------------------------------------------------------------------

  const loadQuiz = useCallback(async () => {
    if (!quizId) return;
    setData({ status: 'loading', quiz: null, error: null });

    try {
      const quizResp = await quizService.getQuiz(quizId);
      const quiz = quizResp?.quiz ?? quizResp;

      try {
        const bestResp = await quizService.getBestScore(quizId);
        setBestScore(bestResp?.data ?? null);
      } catch {
        setBestScore(null);
      }

      setData({ status: 'ready', quiz, error: null });
    } catch (error) {
      setData({
        status: 'error',
        quiz: null,
        error: error?.message ?? 'Could not load this quiz.',
      });
    }
  }, [quizId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // -------------------------------------------------------------------------
  // Curriculum lookup — used only to surface a "Next lesson" CTA on the
  // results screen. Best-effort and silent on failure (the rest of the
  // page does not depend on it).
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!slug || !data.quiz?.lessonId) return;
    let cancelled = false;
    courseService
      .getCurriculum(slug)
      .then((resp) => {
        if (cancelled) return;
        const sections = resp?.data?.sections ?? resp?.sections ?? [];
        const lessons = flattenLessons(sections);
        const idx = lessons.findIndex(
          (lesson) => String(lesson._id) === String(data.quiz.lessonId),
        );
        setNextLesson(idx >= 0 ? lessons[idx + 1] ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setNextLesson(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, data.quiz?.lessonId]);

  // -------------------------------------------------------------------------
  // Submission — wrapped in a ref-guard so the timer's force-submit path
  // and the user's manual click cannot race into double-POSTing.
  // -------------------------------------------------------------------------

  const doSubmit = useCallback(
    async (answers, { forced = false } = {}) => {
      if (submittingRef.current) return;
      submittingRef.current = true;

      const startedAt = machineRef.current.startedAt || Date.now();
      const timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - startedAt) / 1000),
      );

      setMachine((prev) => ({ ...prev, step: 'submitting', timeLeft: undefined }));

      try {
        const resp = await quizService.submitQuiz(quizId, {
          answers,
          timeSpentSeconds,
          // Forward the integrity signal so the server can
          // persist it on `QuizAttempt`. The server clamps to a sane
          // range, so a forged DevTools call cannot poison aggregate
          // analytics.
          tabSwitches: machineRef.current.tabSwitches ?? 0,
        });

        const result = {
          score: resp.score,
          correctCount: resp.correctCount,
          totalQuestions: resp.totalQuestions,
          passed: resp.passed,
          timeSpentSeconds: resp.timeSpentSeconds ?? timeSpentSeconds,
          perQuestion: resp.perQuestion ?? [],
          answers,
        };

        setMachine((prev) => ({ ...prev, step: 'results', result }));

        if (forced) {
          toast.info("Time's up — your answers were submitted.");
        } else if (result.passed) {
          toast.success(`Passed with ${result.score}%`);
        } else {
          toast.info(`Scored ${result.score}% — try again to improve`);
        }

        if (result.passed) setConfettiKey(Date.now());

        try {
          const bestResp = await quizService.getBestScore(quizId);
          setBestScore(bestResp?.data ?? null);
        } catch {
          /* non-blocking */
        }
      } catch (error) {
        toast.error(error?.message ?? 'Could not submit your quiz.');
        setMachine((prev) => ({ ...prev, step: 'taking' }));
      } finally {
        submittingRef.current = false;
      }
    },
    [quizId],
  );

  // -------------------------------------------------------------------------
  // Countdown — only runs while `taking` and the quiz has a time limit.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (machine.step !== 'taking') return undefined;

    const id = setInterval(() => {
      setMachine((prev) => {
        if (prev.step !== 'taking' || prev.timeLeft === undefined) return prev;
        const next = prev.timeLeft - 1;
        if (next <= 0) {
          // Defer the network call out of the setState callback so we don't
          // mutate state inside a setter and so the submission promise can
          // see the final answer array.
          queueMicrotask(() => doSubmit(prev.answers, { forced: true }));
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: next };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [machine.step, doSubmit]);

  // -------------------------------------------------------------------------
  // beforeunload — warn if the user tries to close mid-attempt.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (machine.step !== 'taking') return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [machine.step]);

  // -------------------------------------------------------------------------
  // Tab-switch detection (lightweight quiz anti-cheat).
  //
  // Honor system, but raise the bar. When the page goes hidden during
  // an active attempt we:
  //   - bump a counter that travels with the submission payload, and
  //   - show a single, throttled toast so the learner knows the
  //     attempt is being watched (the implicit "we noticed" deterrent
  //     is doing most of the work here).
  //
  // We deliberately do NOT auto-submit on hide — accidental tab
  // switches (notification clicks, IDE hotkeys, mobile app switcher)
  // would punish honest users far more than they catch cheaters.
  // Determined cheating is impossible to prevent without proctoring;
  // see `docs/QUIZ-INTEGRITY.md` for the policy boundaries.
  // -------------------------------------------------------------------------
  const lastTabSwitchToastRef = useRef(0);
  useEffect(() => {
    if (machine.step !== 'taking') return undefined;
    if (typeof document === 'undefined') return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      setMachine((prev) =>
        prev.step === 'taking'
          ? { ...prev, tabSwitches: (prev.tabSwitches ?? 0) + 1 }
          : prev,
      );
      const now = Date.now();
      if (now - lastTabSwitchToastRef.current > TAB_SWITCH_TOAST_COOLDOWN_MS) {
        lastTabSwitchToastRef.current = now;
        toast.info(
          'Tab change detected — focus may be required to keep your attempt valid.',
        );
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [machine.step]);

  // -------------------------------------------------------------------------
  // Keyboard — 1..9 selects an option, Enter advances / submits.
  // -------------------------------------------------------------------------

  const currentQuestion =
    machine.step === 'taking' ? data.quiz?.questions[machine.currentIndex] : null;
  const totalQuestions = data.quiz?.questions?.length ?? 0;
  const isLastQuestion =
    totalQuestions > 0 && machine.currentIndex === totalQuestions - 1;

  const handleSelect = useCallback((optionIndex) => {
    setMachine((prev) => {
      if (prev.step !== 'taking') return prev;
      const answers = [...prev.answers];
      answers[prev.currentIndex] = optionIndex;
      return { ...prev, answers };
    });
  }, []);

  const handlePrev = useCallback(() => {
    setMachine((prev) =>
      prev.currentIndex > 0
        ? { ...prev, currentIndex: prev.currentIndex - 1 }
        : prev,
    );
  }, []);

  const handleNext = useCallback(() => {
    const m = machineRef.current;
    if (m.step !== 'taking') return;
    if (m.answers[m.currentIndex] === undefined || m.answers[m.currentIndex] < 0) {
      return;
    }
    if (m.currentIndex < totalQuestions - 1) {
      setMachine((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    } else {
      doSubmit(m.answers);
    }
  }, [doSubmit, totalQuestions]);

  useEffect(() => {
    if (machine.step !== 'taking') return undefined;

    const onKey = (event) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^[1-9]$/.test(event.key)) {
        const idx = Number(event.key) - 1;
        const opts = currentQuestion?.options ?? [];
        if (idx < opts.length) {
          event.preventDefault();
          handleSelect(idx);
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleNext();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [machine.step, currentQuestion, handleSelect, handleNext, handlePrev]);

  // -------------------------------------------------------------------------
  // Lifecycle: start / retake / leave.
  // -------------------------------------------------------------------------

  const handleStart = useCallback(() => {
    if (!data.quiz) return;
    setMachine({
      step: 'taking',
      currentIndex: 0,
      answers: Array(data.quiz.questions.length).fill(-1),
      startedAt: Date.now(),
      timeLeft: data.quiz.timeLimitSeconds || undefined,
      result: null,
    });
  }, [data.quiz]);

  const handleRetake = useCallback(() => {
    setConfettiKey(null);
    setMachine(initialMachine);
  }, []);

  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const goBackToLesson = useCallback(() => {
    if (!data.quiz?.lessonId || !slug) {
      navigate(ROUTES.courseLearn(slug ?? ''));
      return;
    }
    navigate(ROUTES.lesson(slug, data.quiz.lessonId));
  }, [data.quiz?.lessonId, navigate, slug]);

  const handleBackRequest = useCallback(() => {
    if (machine.step === 'taking') {
      setLeaveConfirmOpen(true);
      return;
    }
    goBackToLesson();
  }, [goBackToLesson, machine.step]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (data.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading quiz…" />
      </div>
    );
  }

  if (data.status === 'error' || !data.quiz) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon="AlertTriangle"
          title="We couldn't load this quiz"
          description={data.error ?? 'Please try again in a moment.'}
          action={
            <Button onClick={loadQuiz} leftIcon={<Icon name="RefreshCw" size={16} />}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const quiz = data.quiz;

  return (
    <div className="quiz-page flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
          <AnimatePresence mode="wait">
            {machine.step === 'intro' && (
              <motion.div key="intro" {...fadeUp}>
                <IntroCard
                  quiz={quiz}
                  bestScore={bestScore}
                  onStart={handleStart}
                  onBack={handleBackRequest}
                />
              </motion.div>
            )}

            {machine.step === 'taking' && currentQuestion && (
              <motion.div key="taking" {...fadeUp} className="flex flex-col gap-6">
                <TakingHeader
                  currentIndex={machine.currentIndex}
                  total={totalQuestions}
                  timeLeft={machine.timeLeft}
                  onLeave={handleBackRequest}
                />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={machine.currentIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <QuestionCard
                      question={currentQuestion}
                      questionNumber={machine.currentIndex + 1}
                      selectedIndex={machine.answers[machine.currentIndex]}
                      onSelect={handleSelect}
                      radioName={`${radioName}-q${machine.currentIndex}`}
                    />
                  </motion.div>
                </AnimatePresence>

                <TakingActionRow
                  isFirst={machine.currentIndex === 0}
                  isLast={isLastQuestion}
                  hasAnswer={
                    machine.answers[machine.currentIndex] !== undefined &&
                    machine.answers[machine.currentIndex] >= 0
                  }
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              </motion.div>
            )}

            {machine.step === 'submitting' && (
              <motion.div key="submitting" {...fadeUp}>
                <Card padding="lg" className="text-center">
                  <div className="flex flex-col items-center gap-4 py-10">
                    <Spinner size="lg" />
                    <h2 className="text-xl font-semibold text-text">
                      Grading your answers…
                    </h2>
                    <p className="text-sm text-text-muted">
                      Hold tight — this only takes a moment.
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}

            {machine.step === 'results' && machine.result && (
              <motion.div key="results" {...fadeUp} className="flex flex-col gap-6">
                <ResultsHero
                  result={machine.result}
                  passingScore={quiz.passingScore}
                />
                <ResultsStats
                  result={machine.result}
                  attempts={bestScore?.attempts ?? null}
                />
                <ResultsReview
                  questions={quiz.questions}
                  perQuestion={machine.result.perQuestion}
                  answers={machine.result.answers}
                />
                <ResultsActions
                  passed={machine.result.passed}
                  onRetake={handleRetake}
                  onBackToLesson={goBackToLesson}
                  nextLesson={nextLesson}
                  slug={slug}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {confettiKey && (
        <ConfettiBurst
          key={confettiKey}
          onDone={() => setConfettiKey(null)}
        />
      )}

      <ConfirmModal
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          goBackToLesson();
        }}
        title="Leave this quiz?"
        description="Your current answers will be discarded. You'll need to start over from the beginning."
        confirmLabel="Leave quiz"
        cancelLabel="Keep going"
        danger
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

function IntroCard({ quiz, bestScore, onStart, onBack }) {
  const meta = useMemo(() => {
    const items = [
      `${quiz.questions.length} question${quiz.questions.length === 1 ? '' : 's'}`,
      `Passing ${quiz.passingScore}%`,
    ];
    if (quiz.timeLimitSeconds > 0) {
      items.push(`Time limit ${formatClock(quiz.timeLimitSeconds)}`);
    } else {
      items.push('No time limit');
    }
    return items;
  }, [quiz.passingScore, quiz.questions.length, quiz.timeLimitSeconds]);

  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon name="ListChecks" size={28} />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
        {quiz.title}
      </h1>

      {quiz.description && (
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
          {quiz.description}
        </p>
      )}

      <ul className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-text-muted">
        {meta.map((item, index) => (
          <li key={item} className="inline-flex items-center gap-3">
            {index > 0 && <span aria-hidden="true">·</span>}
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {bestScore?.attempts > 0 && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-muted px-3 py-1.5 text-xs text-text-muted">
          <Icon name="Trophy" size={14} className="text-warning" />
          Best score: <strong className="text-text">{bestScore.best}%</strong>
          <span aria-hidden="true">·</span>
          {bestScore.attempts} attempt{bestScore.attempts === 1 ? '' : 's'}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ChevronLeft" size={16} />
          Back to lesson
        </Button>
        <Button
          size="lg"
          onClick={onStart}
          rightIcon={<Icon name="ArrowRight" size={16} />}
        >
          Start quiz
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Taking — header (progress + timer), question card, action row
// ---------------------------------------------------------------------------

function TakingHeader({ currentIndex, total, timeLeft, onLeave }) {
  const percent = total === 0 ? 0 : ((currentIndex + 1) / total) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconButton
          aria-label="Leave quiz"
          variant="ghost"
          onClick={onLeave}
          className="h-8 w-8"
        >
          <Icon name="X" size={16} />
        </IconButton>
        <div className="flex-1 text-xs font-medium uppercase tracking-wider text-text-muted">
          Question{' '}
          <span className="text-text tabular-nums">{currentIndex + 1}</span>
          <span className="text-text-subtle"> / {total}</span>
        </div>
        {timeLeft !== undefined && <CountdownChip secondsLeft={timeLeft} />}
      </div>
      <ProgressBar value={percent} aria-label="Quiz progress" />
    </div>
  );
}

function CountdownChip({ secondsLeft }) {
  const isWarning = secondsLeft <= TIME_WARNING_THRESHOLD_SECONDS;
  return (
    <div
      role="timer"
      aria-live={isWarning ? 'assertive' : 'off'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums',
        isWarning
          ? 'border-danger/40 bg-danger/10 text-danger animate-pulse'
          : 'border-border bg-bg-muted text-text',
      )}
    >
      <Icon name="Clock" size={14} />
      {formatClock(secondsLeft)}
    </div>
  );
}

function QuestionCard({
  question,
  questionNumber,
  selectedIndex,
  onSelect,
  radioName,
}) {
  // Lightweight anti-cheat: block copy + right-click on the
  // question card so casual "highlight + paste into ChatGPT" attempts
  // require obvious effort. Determined cheating is impossible to
  // prevent client-side; this is a deterrent layered on top of the
  // server-authoritative grading. See `docs/QUIZ-INTEGRITY.md`.
  const blockClipboard = (event) => event.preventDefault();

  return (
    <Card
      padding="lg"
      className="quiz-question"
      onCopy={blockClipboard}
      onCut={blockClipboard}
      onContextMenu={blockClipboard}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Question {questionNumber}
      </p>
      <h2 className="text-xl font-semibold leading-snug text-text sm:text-2xl">
        {question.question}
      </h2>

      <fieldset className="mt-6 flex flex-col gap-3">
        <legend className="sr-only">Choose one answer</legend>
        {question.options.map((option, index) => (
          <SelectableCard
            key={`${question._id ?? questionNumber}-${index}`}
            name={radioName}
            value={index}
            selected={selectedIndex === index}
            onSelect={onSelect}
            label={option}
          />
        ))}
      </fieldset>

      <p className="mt-4 hidden text-xs text-text-subtle sm:block">
        <KBD>1</KBD>–<KBD>{question.options.length}</KBD> to select ·{' '}
        <KBD>Enter</KBD> to advance
      </p>
    </Card>
  );
}

function TakingActionRow({ isFirst, isLast, hasAnswer, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        onClick={onPrev}
        disabled={isFirst}
        leftIcon={<Icon name="ChevronLeft" size={16} />}
      >
        Previous
      </Button>
      <Button
        onClick={onNext}
        disabled={!hasAnswer}
        rightIcon={
          <Icon name={isLast ? 'Send' : 'ChevronRight'} size={16} />
        }
      >
        {isLast ? 'Submit' : 'Next'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results — hero, stats, review accordion, action row
// ---------------------------------------------------------------------------

function ResultsHero({ result, passingScore }) {
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto mb-4 flex justify-center">
        <ProgressRing
          value={result.score}
          size={128}
          strokeWidth={10}
          showValue={false}
          label={`Score ${result.score}%`}
        />
      </div>
      <p className="text-5xl font-semibold tabular-nums text-text">
        {result.score}%
      </p>
      <h2
        className={cn(
          'mt-3 text-2xl font-semibold tracking-tight',
          result.passed ? 'text-success' : 'text-text',
        )}
      >
        {result.passed ? 'Passed!' : 'Not yet'}
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        {result.passed
          ? `You met the ${passingScore}% passing score. Nice work.`
          : `You need ${passingScore}% to pass — give it another go.`}
      </p>
    </Card>
  );
}

function ResultsStats({ result, attempts }) {
  const stats = [
    {
      icon: 'CheckCircle2',
      label: 'Correct',
      value: `${result.correctCount} / ${result.totalQuestions}`,
    },
    {
      icon: 'Clock',
      label: 'Time spent',
      value: formatClock(result.timeSpentSeconds),
    },
    {
      icon: 'Repeat',
      label: 'Attempts',
      value: attempts ?? '—',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-4"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-muted text-text-muted">
            <Icon name={stat.icon} size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-text-subtle">
              {stat.label}
            </div>
            <div className="text-base font-semibold tabular-nums text-text">
              {stat.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsReview({ questions, perQuestion, answers }) {
  const items = useMemo(
    () =>
      questions.map((question, index) => {
        const feedback = perQuestion[index] ?? {};
        const userAnswerIndex = answers[index];
        const correctIndex = feedback.correctIndex;
        const isCorrect = Boolean(feedback.correct);

        return {
          id: String(question._id ?? index),
          title: (
            <span className="flex items-center gap-2">
              <Icon
                name={isCorrect ? 'CheckCircle2' : 'XCircle'}
                size={16}
                className={cn(isCorrect ? 'text-success' : 'text-danger')}
              />
              <span className="line-clamp-1">
                Q{index + 1}. {question.question}
              </span>
            </span>
          ),
          meta: (
            <Badge variant={isCorrect ? 'success' : 'danger'}>
              {isCorrect ? 'Correct' : 'Wrong'}
            </Badge>
          ),
          content: (
            <ReviewBody
              question={question}
              userAnswerIndex={userAnswerIndex}
              correctIndex={correctIndex}
              isCorrect={isCorrect}
              explanation={feedback.explanation}
            />
          ),
        };
      }),
    [answers, perQuestion, questions],
  );

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Review your answers
      </h3>
      <Accordion type="multiple" items={items} />
    </section>
  );
}

function ReviewBody({
  question,
  userAnswerIndex,
  correctIndex,
  isCorrect,
  explanation,
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {question.options.map((option, index) => {
          const isUser = index === userAnswerIndex;
          const isAnswer = index === correctIndex;
          const tone = isAnswer
            ? 'border-success/40 bg-success/10 text-text'
            : isUser
              ? 'border-danger/40 bg-danger/10 text-text'
              : 'border-border bg-bg text-text-muted';
          return (
            <li
              key={index}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
                tone,
              )}
            >
              <Icon
                name={
                  isAnswer
                    ? 'CheckCircle2'
                    : isUser
                      ? 'XCircle'
                      : 'Circle'
                }
                size={16}
                className={cn(
                  'mt-0.5 shrink-0',
                  isAnswer
                    ? 'text-success'
                    : isUser
                      ? 'text-danger'
                      : 'text-text-subtle',
                )}
              />
              <div className="min-w-0 flex-1">
                <div>{option}</div>
                <div className="mt-0.5 text-xs text-text-subtle">
                  {isAnswer && 'Correct answer'}
                  {isUser && !isAnswer && 'Your answer'}
                  {isUser && isAnswer && ' · Your answer'}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {explanation && (
        <div className="rounded-lg border border-border bg-bg-muted/60 px-3 py-2 text-sm text-text-muted">
          <span className="font-medium text-text">Explanation: </span>
          {explanation}
        </div>
      )}

      {!isCorrect && userAnswerIndex < 0 && (
        <p className="text-xs text-text-subtle">You didn't answer this question.</p>
      )}
    </div>
  );
}

function ResultsActions({ passed, onRetake, onBackToLesson, nextLesson, slug }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
      <Button
        variant="outline"
        onClick={onRetake}
        leftIcon={<Icon name="RotateCcw" size={16} />}
      >
        Retake quiz
      </Button>
      <Button
        variant="ghost"
        onClick={onBackToLesson}
        leftIcon={<Icon name="ChevronLeft" size={16} />}
      >
        Back to lesson
      </Button>
      {passed && nextLesson && slug && (
        <Link to={ROUTES.lesson(slug, nextLesson._id)}>
          <Button rightIcon={<Icon name="ArrowRight" size={16} />}>
            Next lesson
          </Button>
        </Link>
      )}
    </div>
  );
}
