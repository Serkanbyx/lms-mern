/**
 * Instructor — `/instructor/lessons/:id/quiz`
 *
 * The single authoring surface for the (one-and-only) quiz attached
 * to a lesson. The URL param is the LESSON id; the quiz id is
 * discovered on mount via `quizService.getQuizByLesson`, which
 * cleanly handles both "lesson has no quiz yet" (returns
 * `quiz: null` → draft seeded with sensible defaults) and "lesson
 * already has a quiz" (returns the full document → draft hydrated
 * from it).
 *
 * Editing model
 * -------------
 * Local state is a deep, fully-controlled copy of the quiz so every
 * keystroke stays client-side until the explicit "Save quiz" press.
 * That avoids the per-field PATCH chatter the curriculum builder
 * needed (sections / lessons are independent rows; a quiz is one
 * atomic document, so the backend already treats `questions` as a
 * full replacement on update).
 *
 * Each question carries a stable client-only `uid` so React's keyed
 * reconciler stays correct under reorder / duplicate / insert
 * operations — server `_id` is only present after the first save and
 * is preserved purely as round-trip metadata (it is dropped from the
 * outgoing payload because the model treats `questions` as a
 * positional array, not a keyed map).
 *
 * Validation
 * ----------
 * Mirrors the server-side rules in `server/validators/quiz.validator
 * .js` so the "Save quiz" button can stay disabled until the draft
 * is shippable. Per-question issues are surfaced inline; the sticky
 * footer summarises the count + validity at a glance.
 *
 * Reorder UX
 * ----------
 * Same playbook as `CurriculumTree`: HTML5 drag for pointer users +
 * up/down `IconButton`s + `Alt+ArrowUp/Down` keyboard fallback when
 * a card is focused. No external dnd library — questions are a flat
 * list and the math is a single splice.
 *
 * Preview mode
 * ------------
 * The "Preview" toggle swaps the editor for a read-only render that
 * mirrors `QuizPage`'s student view (intro card + per-question card
 * with options as `SelectableCard`). `correctIndex` and
 * `explanation` are deliberately hidden in preview so the
 * instructor sees exactly what learners see — no answer key spoiler
 * during a sanity check.
 *
 * Delete
 * ------
 * Goes through `ConfirmModal` with a copy that is explicit about the
 * irreversible nature: student attempts persist (history) but the
 * quiz disappears from the lesson. Cascade is handled server-side
 * by the Quiz schema's post-delete hook (`Lesson.hasQuiz` flips
 * back to `false`).
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

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmModal,
  Dropdown,
  FormField,
  Icon,
  IconButton,
  Input,
  Skeleton,
  Slider,
  Spinner,
  Textarea,
  Toggle,
  toast,
} from '../../components/ui/index.js';
import { SelectableCard } from '../../components/quiz/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  createQuiz,
  deleteQuiz,
  getQuizByLesson,
  updateQuiz,
} from '../../services/quiz.service.js';
import { ROUTES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';
import { fadeUp } from '../../utils/motion.js';

/* -------------------------------------------------------------------------- */
/*  Schema-mirrored constants                                                 */
/* -------------------------------------------------------------------------- */

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;
const QUESTION_MIN = 5;
const QUESTION_MAX = 500;
const OPTION_MAX = 200;
const EXPLANATION_MAX = 500;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 6;
const QUESTIONS_MAX = 50;
const PASSING_SCORE_MIN = 0;
const PASSING_SCORE_MAX = 100;
const TIME_LIMIT_MIN_MINUTES = 1;
const TIME_LIMIT_MAX_MINUTES = 120;
const PASSING_SCORE_DEFAULT = 70;
const TIME_LIMIT_DEFAULT_MINUTES = 10;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const newUid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
};

const blankQuestion = () => ({
  uid: newUid(),
  _id: undefined,
  question: '',
  options: ['', ''],
  correctIndex: 0,
  explanation: '',
});

const hydrateDraft = (quiz) => {
  if (!quiz) {
    return {
      title: '',
      description: '',
      passingScore: PASSING_SCORE_DEFAULT,
      timeLimitEnabled: false,
      timeLimitMinutes: TIME_LIMIT_DEFAULT_MINUTES,
      questions: [blankQuestion()],
    };
  }

  const seconds = Number(quiz.timeLimitSeconds) || 0;
  const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : TIME_LIMIT_DEFAULT_MINUTES;

  return {
    title: quiz.title ?? '',
    description: quiz.description ?? '',
    passingScore: Number.isFinite(quiz.passingScore)
      ? quiz.passingScore
      : PASSING_SCORE_DEFAULT,
    timeLimitEnabled: seconds > 0,
    timeLimitMinutes: minutes,
    questions: (quiz.questions ?? []).map((q) => ({
      uid: newUid(),
      _id: q._id,
      question: q.question ?? '',
      options: Array.isArray(q.options) && q.options.length >= OPTIONS_MIN
        ? q.options.slice(0, OPTIONS_MAX)
        : ['', ''],
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
      explanation: q.explanation ?? '',
    })),
  };
};

const buildPayload = (draft) => ({
  title: draft.title.trim(),
  description: draft.description.trim(),
  passingScore: Number(draft.passingScore),
  timeLimitSeconds: draft.timeLimitEnabled
    ? Math.max(TIME_LIMIT_MIN_MINUTES, Number(draft.timeLimitMinutes) || 0) * 60
    : 0,
  questions: draft.questions.map((q) => ({
    question: q.question.trim(),
    options: q.options.map((opt) => opt.trim()),
    correctIndex: q.correctIndex,
    explanation: q.explanation?.trim() ?? '',
  })),
});

const validateDraft = (draft) => {
  const meta = {};
  const titleLen = draft.title.trim().length;
  if (titleLen < TITLE_MIN) meta.title = `Title must be at least ${TITLE_MIN} characters.`;
  else if (titleLen > TITLE_MAX) meta.title = `Title must be at most ${TITLE_MAX} characters.`;

  if (draft.description.trim().length > DESCRIPTION_MAX) {
    meta.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
  }

  const score = Number(draft.passingScore);
  if (!Number.isInteger(score) || score < PASSING_SCORE_MIN || score > PASSING_SCORE_MAX) {
    meta.passingScore = `Passing score must be between ${PASSING_SCORE_MIN} and ${PASSING_SCORE_MAX}.`;
  }

  if (draft.timeLimitEnabled) {
    const minutes = Number(draft.timeLimitMinutes);
    if (
      !Number.isInteger(minutes) ||
      minutes < TIME_LIMIT_MIN_MINUTES ||
      minutes > TIME_LIMIT_MAX_MINUTES
    ) {
      meta.timeLimit = `Time limit must be between ${TIME_LIMIT_MIN_MINUTES} and ${TIME_LIMIT_MAX_MINUTES} minutes.`;
    }
  }

  const questionErrors = draft.questions.map((q) => {
    const errors = {};
    const trimmed = q.question.trim();
    if (trimmed.length < QUESTION_MIN) {
      errors.question = `At least ${QUESTION_MIN} characters.`;
    } else if (trimmed.length > QUESTION_MAX) {
      errors.question = `At most ${QUESTION_MAX} characters.`;
    }

    if (q.options.length < OPTIONS_MIN) {
      errors.options = `Add at least ${OPTIONS_MIN} options.`;
    } else if (q.options.length > OPTIONS_MAX) {
      errors.options = `Up to ${OPTIONS_MAX} options allowed.`;
    } else {
      const optionIssues = q.options
        .map((opt, idx) => {
          if (opt.trim().length === 0) return `Option ${idx + 1} is empty.`;
          if (opt.length > OPTION_MAX) return `Option ${idx + 1} is too long.`;
          return null;
        })
        .filter(Boolean);
      if (optionIssues.length > 0) errors.options = optionIssues.join(' ');
    }

    if (
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length
    ) {
      errors.correct = 'Pick a correct answer.';
    }

    if ((q.explanation?.length ?? 0) > EXPLANATION_MAX) {
      errors.explanation = `Explanation must be at most ${EXPLANATION_MAX} characters.`;
    }

    return errors;
  });

  const hasQuestionErrors = questionErrors.some(
    (errs) => Object.keys(errs).length > 0,
  );
  const enoughQuestions = draft.questions.length >= 1;

  return {
    meta,
    questions: questionErrors,
    isValid:
      Object.keys(meta).length === 0 && !hasQuestionErrors && enoughQuestions,
  };
};

const moveItem = (items, from, to) => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
};

const formatDuration = (minutes) => {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
};

/* -------------------------------------------------------------------------- */
/*  Drag controller — flat list                                               */
/* -------------------------------------------------------------------------- */

const useDragReorder = ({ onReorder }) => {
  const draggingId = useRef(null);
  const [overId, setOverId] = useState(null);

  const handlersFor = (id) => ({
    draggable: true,
    onDragStart: (event) => {
      draggingId.current = id;
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', String(id));
      } catch {
        // Safari / Firefox quirk — the in-memory ref is the source of truth.
      }
    },
    onDragEnter: (event) => {
      event.preventDefault();
      if (draggingId.current && draggingId.current !== id) setOverId(id);
    },
    onDragOver: (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: () => {
      setOverId((prev) => (prev === id ? null : prev));
    },
    onDrop: (event) => {
      event.preventDefault();
      const sourceId = draggingId.current;
      draggingId.current = null;
      setOverId(null);
      if (!sourceId || sourceId === id) return;
      onReorder(sourceId, id);
    },
    onDragEnd: () => {
      draggingId.current = null;
      setOverId(null);
    },
  });

  return { handlersFor, isOver: (id) => overId === id };
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function QuizBuilderPage() {
  const { id: lessonId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | not-found | error
  const [loadError, setLoadError] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [draft, setDraft] = useState(() => hydrateDraft(null));
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useDocumentTitle(
    lesson?.title ? `Quiz · ${lesson.title}` : 'Quiz builder',
  );

  /* --------------------------- bootstrap -------------------------------- */

  const bootstrap = useCallback(async () => {
    if (!lessonId) return;
    setStatus('loading');
    setLoadError(null);
    try {
      const payload = await getQuizByLesson(lessonId);
      setLesson(payload?.lesson ?? null);
      const existing = payload?.quiz ?? null;
      setQuizId(existing?._id ?? null);
      setDraft(hydrateDraft(existing));
      setStatus('ready');
    } catch (err) {
      const code = err?.response?.status;
      if (code === 404) {
        setStatus('not-found');
        return;
      }
      setStatus('error');
      setLoadError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load this quiz.',
      );
    }
  }, [lessonId]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* --------------------------- validation ------------------------------- */

  const validation = useMemo(() => validateDraft(draft), [draft]);

  /* --------------------------- meta editors ----------------------------- */

  const updateMeta = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  /* --------------------------- question editors ------------------------- */

  const updateQuestion = (uid, patch) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.uid === uid ? { ...q, ...patch } : q,
      ),
    }));

  const updateOption = (uid, index, value) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.uid !== uid) return q;
        const options = [...q.options];
        options[index] = value;
        return { ...q, options };
      }),
    }));

  const addOption = (uid) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.uid !== uid) return q;
        if (q.options.length >= OPTIONS_MAX) return q;
        return { ...q, options: [...q.options, ''] };
      }),
    }));

  const removeOption = (uid, index) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.uid !== uid) return q;
        if (q.options.length <= OPTIONS_MIN) return q;
        const options = q.options.filter((_, i) => i !== index);
        let { correctIndex } = q;
        if (index === correctIndex) correctIndex = 0;
        else if (index < correctIndex) correctIndex -= 1;
        return { ...q, options, correctIndex };
      }),
    }));

  const setCorrect = (uid, index) => updateQuestion(uid, { correctIndex: index });

  const addQuestion = () =>
    setDraft((prev) => {
      if (prev.questions.length >= QUESTIONS_MAX) {
        toast.info(`Quizzes are limited to ${QUESTIONS_MAX} questions.`);
        return prev;
      }
      return { ...prev, questions: [...prev.questions, blankQuestion()] };
    });

  const duplicateQuestion = (uid) =>
    setDraft((prev) => {
      if (prev.questions.length >= QUESTIONS_MAX) {
        toast.info(`Quizzes are limited to ${QUESTIONS_MAX} questions.`);
        return prev;
      }
      const idx = prev.questions.findIndex((q) => q.uid === uid);
      if (idx === -1) return prev;
      const original = prev.questions[idx];
      const clone = {
        ...original,
        uid: newUid(),
        _id: undefined,
        options: [...original.options],
      };
      const next = [...prev.questions];
      next.splice(idx + 1, 0, clone);
      return { ...prev, questions: next };
    });

  const removeQuestion = (uid) =>
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.uid !== uid),
    }));

  const moveQuestion = (uid, direction) =>
    setDraft((prev) => {
      const idx = prev.questions.findIndex((q) => q.uid === uid);
      if (idx === -1) return prev;
      const next = moveItem(prev.questions, idx, idx + direction);
      if (next === prev.questions) return prev;
      return { ...prev, questions: next };
    });

  const reorderByDrop = useCallback((sourceUid, overUid) => {
    setDraft((prev) => {
      const sourceIdx = prev.questions.findIndex((q) => q.uid === sourceUid);
      const overIdx = prev.questions.findIndex((q) => q.uid === overUid);
      if (sourceIdx === -1 || overIdx === -1) return prev;
      const next = [...prev.questions];
      const [removed] = next.splice(sourceIdx, 1);
      next.splice(overIdx, 0, removed);
      return { ...prev, questions: next };
    });
  }, []);

  const dragController = useDragReorder({ onReorder: reorderByDrop });

  /* --------------------------- save / delete ---------------------------- */

  const handleSave = async () => {
    if (!validation.isValid) {
      setShowErrors(true);
      toast.error('Fix the highlighted issues before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(draft);
      if (quizId) {
        const result = await updateQuiz(quizId, payload);
        const fresh = result?.quiz ?? null;
        if (fresh) {
          setDraft(hydrateDraft(fresh));
          setQuizId(fresh._id);
        }
        toast.success('Quiz saved.');
      } else {
        const result = await createQuiz(lessonId, payload);
        const fresh = result?.quiz ?? null;
        if (fresh) {
          setDraft(hydrateDraft(fresh));
          setQuizId(fresh._id);
        }
        toast.success('Quiz created.');
      }
      setShowErrors(false);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ??
          err?.message ??
          'Could not save the quiz.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!quizId) return;
    setDeleting(true);
    try {
      await deleteQuiz(quizId);
      toast.success('Quiz deleted.');
      const target = lesson?.courseId
        ? ROUTES.instructorCurriculum(lesson.courseId)
        : ROUTES.instructor;
      navigate(target);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not delete the quiz.',
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  /* --------------------------- back link -------------------------------- */

  const backToCurriculum = lesson?.courseId
    ? ROUTES.instructorCurriculum(lesson.courseId)
    : ROUTES.instructor;

  /* --------------------------- render states ---------------------------- */

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 lg:py-12 space-y-6">
        <Skeleton variant="text" className="h-4 w-40" />
        <Skeleton variant="text" className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center space-y-4">
        <Icon name="SearchX" size={40} className="mx-auto text-text-muted" />
        <h1 className="text-2xl font-semibold text-text">Lesson not found</h1>
        <p className="text-text-muted">
          The lesson either doesn&apos;t exist or it isn&apos;t in your catalog.
        </p>
        <Link to={ROUTES.instructor}>
          <Button leftIcon={<Icon name="ArrowLeft" size={14} />}>
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-4">
        <Alert variant="danger" title="We couldn't load the quiz">
          {loadError}
        </Alert>
        <div className="flex items-center gap-3">
          <Button
            onClick={bootstrap}
            leftIcon={<Icon name="RefreshCcw" size={14} />}
          >
            Retry
          </Button>
          <Link to={ROUTES.instructor}>
            <Button variant="ghost">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------- ready render ----------------------------- */

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 lg:py-10 pb-32">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            to={backToCurriculum}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <Icon name="ArrowLeft" size={14} />
            Back to curriculum
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
              {quizId ? 'Edit quiz' : 'New quiz'}
            </h1>
            <Badge variant={quizId ? 'success' : 'neutral'}>
              {quizId ? 'Saved' : 'Draft'}
            </Badge>
          </div>
          {lesson?.title && (
            <p className="text-sm text-text-muted">
              Attached to lesson{' '}
              <span className="text-text font-medium">{lesson.title}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Toggle
            checked={previewMode}
            onChange={setPreviewMode}
            label="Preview"
          />
          {quizId && (
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              leftIcon={<Icon name="Trash2" size={14} />}
            >
              Delete
            </Button>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {previewMode ? (
          <motion.div key="preview" {...fadeUp}>
            <QuizPreview draft={draft} validation={validation} />
          </motion.div>
        ) : (
          <motion.div key="edit" {...fadeUp} className="space-y-6">
            <MetaCard
              draft={draft}
              errors={showErrors ? validation.meta : {}}
              onChange={updateMeta}
            />

            <QuestionList
              questions={draft.questions}
              questionErrors={validation.questions}
              showErrors={showErrors}
              dragController={dragController}
              onUpdateQuestion={updateQuestion}
              onUpdateOption={updateOption}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onSetCorrect={setCorrect}
              onMoveQuestion={moveQuestion}
              onDuplicateQuestion={duplicateQuestion}
              onRemoveQuestion={removeQuestion}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SaveBar
        questionCount={draft.questions.length}
        validity={validation}
        saving={saving}
        previewMode={previewMode}
        onAddQuestion={addQuestion}
        onSave={handleSave}
      />

      <ConfirmModal
        open={confirmDelete}
        loading={deleting}
        onClose={() => (deleting ? null : setConfirmDelete(false))}
        onConfirm={handleDelete}
        title="Delete this quiz?"
        description="The quiz will vanish from the lesson and learners will no longer see it. Existing student attempts stay in their history. This cannot be undone."
        confirmLabel="Delete quiz"
        danger
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Meta card                                                                 */
/* -------------------------------------------------------------------------- */

function MetaCard({ draft, errors, onChange }) {
  return (
    <Card padding="lg" className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text">Quiz details</h2>
        <p className="mt-0.5 text-sm text-text-muted">
          What learners see before they start.
        </p>
      </div>

      <FormField
        label="Title"
        required
        helper={`${TITLE_MIN}–${TITLE_MAX} characters.`}
        error={errors.title}
      >
        {(props) => (
          <Input
            {...props}
            value={draft.title}
            placeholder="e.g. Module 1 — JavaScript fundamentals"
            maxLength={TITLE_MAX}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        )}
      </FormField>

      <FormField
        label="Description"
        helper="Optional — explain what this quiz covers."
        error={errors.description}
      >
        {(props) => (
          <Textarea
            {...props}
            value={draft.description}
            rows={3}
            autosize
            maxLength={DESCRIPTION_MAX}
            showCounter
            placeholder="A short summary, learning objectives, or expectations."
            onChange={(event) => onChange({ description: event.target.value })}
          />
        )}
      </FormField>

      <FormField
        label="Passing score"
        helper="Minimum percentage learners must reach to pass."
        error={errors.passingScore}
      >
        {() => (
          <div className="flex items-center gap-4">
            <Slider
              min={PASSING_SCORE_MIN}
              max={PASSING_SCORE_MAX}
              step={5}
              value={draft.passingScore}
              onChange={(value) => onChange({ passingScore: value })}
              showValue={false}
              aria-label="Passing score"
            />
            <span
              className="inline-flex h-9 min-w-17 items-center justify-center rounded-md bg-primary/10 px-3 text-sm font-semibold tabular-nums text-primary"
              aria-live="polite"
            >
              {draft.passingScore}%
            </span>
          </div>
        )}
      </FormField>

      <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Toggle
              checked={draft.timeLimitEnabled}
              onChange={(value) => onChange({ timeLimitEnabled: value })}
              label="Set a time limit"
              description={
                draft.timeLimitEnabled
                  ? `Auto-submits after ${formatDuration(draft.timeLimitMinutes)}.`
                  : 'Learners can take as long as they need.'
              }
            />
          </div>
          {draft.timeLimitEnabled && (
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={TIME_LIMIT_MIN_MINUTES}
                max={TIME_LIMIT_MAX_MINUTES}
                step={1}
                value={draft.timeLimitMinutes}
                onChange={(event) => {
                  const raw = event.target.value;
                  const next = raw === '' ? '' : Math.max(0, Number(raw) || 0);
                  onChange({ timeLimitMinutes: next });
                }}
                className="w-24"
                aria-label="Time limit in minutes"
              />
              <span className="text-sm text-text-muted">min</span>
            </div>
          )}
        </div>
        {errors.timeLimit && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {errors.timeLimit}
          </p>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Question list + card                                                      */
/* -------------------------------------------------------------------------- */

function QuestionList({
  questions,
  questionErrors,
  showErrors,
  dragController,
  onUpdateQuestion,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onSetCorrect,
  onMoveQuestion,
  onDuplicateQuestion,
  onRemoveQuestion,
}) {
  if (questions.length === 0) {
    return (
      <Card
        padding="lg"
        className="flex flex-col items-center gap-3 text-center"
      >
        <Icon
          name="ListChecks"
          size={28}
          className="text-text-muted"
        />
        <p className="text-base font-semibold text-text">No questions yet</p>
        <p className="max-w-md text-sm text-text-muted">
          Quizzes need at least one question. Add the first one to get started.
        </p>
      </Card>
    );
  }

  return (
    <ol className="space-y-4">
      {questions.map((question, index) => (
        <QuestionCard
          key={question.uid}
          number={index + 1}
          isFirst={index === 0}
          isLast={index === questions.length - 1}
          question={question}
          errors={showErrors ? questionErrors[index] ?? {} : {}}
          dragHandlers={dragController.handlersFor(question.uid)}
          isDragOver={dragController.isOver(question.uid)}
          onUpdate={(patch) => onUpdateQuestion(question.uid, patch)}
          onUpdateOption={(idx, value) =>
            onUpdateOption(question.uid, idx, value)
          }
          onAddOption={() => onAddOption(question.uid)}
          onRemoveOption={(idx) => onRemoveOption(question.uid, idx)}
          onSetCorrect={(idx) => onSetCorrect(question.uid, idx)}
          onMove={(direction) => onMoveQuestion(question.uid, direction)}
          onDuplicate={() => onDuplicateQuestion(question.uid)}
          onRemove={() => onRemoveQuestion(question.uid)}
        />
      ))}
    </ol>
  );
}

function QuestionCard({
  number,
  isFirst,
  isLast,
  question,
  errors,
  dragHandlers,
  isDragOver,
  onUpdate,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
  onSetCorrect,
  onMove,
  onDuplicate,
  onRemove,
}) {
  const radioName = useId();
  const optionsAtMax = question.options.length >= OPTIONS_MAX;
  const optionsAtMin = question.options.length <= OPTIONS_MIN;

  const handleCardKeyDown = (event) => {
    if (!event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(1);
    }
  };

  return (
    <li
      {...dragHandlers}
      onKeyDown={handleCardKeyDown}
      tabIndex={-1}
      className={cn(
        'rounded-xl border bg-bg-subtle shadow-xs transition-colors',
        isDragOver
          ? 'border-primary/60 ring-2 ring-primary/20'
          : 'border-border',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span
          className="cursor-grab text-text-subtle hover:text-text-muted active:cursor-grabbing"
          aria-hidden="true"
          title="Drag to reorder question"
        >
          <Icon name="GripVertical" size={16} />
        </span>

        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {number}
        </span>

        <span className="ml-1 text-sm font-medium text-text">
          Question {number}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            aria-label="Move question up"
            variant="ghost"
            size="sm"
            onClick={() => onMove(-1)}
            disabled={isFirst}
          >
            <Icon name="ChevronUp" size={14} />
          </IconButton>
          <IconButton
            aria-label="Move question down"
            variant="ghost"
            size="sm"
            onClick={() => onMove(1)}
            disabled={isLast}
          >
            <Icon name="ChevronDown" size={14} />
          </IconButton>
          <Dropdown
            trigger={
              <IconButton
                aria-label="Question actions"
                variant="ghost"
                size="sm"
              >
                <Icon name="MoreVertical" size={14} />
              </IconButton>
            }
            align="end"
            items={[
              {
                id: 'duplicate',
                label: 'Duplicate question',
                icon: 'Copy',
                onSelect: onDuplicate,
              },
              { id: 'sep', separator: true },
              {
                id: 'delete',
                label: 'Delete question',
                icon: 'Trash2',
                danger: true,
                onSelect: onRemove,
              },
            ]}
          />
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <FormField
          label="Question"
          hideLabel
          required
          helper={`${QUESTION_MIN}–${QUESTION_MAX} characters.`}
          error={errors.question}
        >
          {(props) => (
            <Textarea
              {...props}
              value={question.question}
              rows={2}
              autosize
              maxLength={QUESTION_MAX}
              placeholder="What do you want to ask?"
              onChange={(event) => onUpdate({ question: event.target.value })}
            />
          )}
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text">
            Answer options
          </legend>
          <p className="text-xs text-text-muted">
            Select the radio next to the correct answer. {OPTIONS_MIN}–
            {OPTIONS_MAX} options.
          </p>
          <ul className="space-y-2">
            {question.options.map((option, index) => {
              const isCorrect = question.correctIndex === index;
              return (
                <li
                  key={`${question.uid}-${index}`}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isCorrect
                      ? 'border-success/50 bg-success/5'
                      : 'border-border-strong bg-bg',
                  )}
                >
                  <label
                    className="inline-flex items-center"
                    title="Mark as correct answer"
                  >
                    <input
                      type="radio"
                      name={radioName}
                      checked={isCorrect}
                      onChange={() => onSetCorrect(index)}
                      className="sr-only peer"
                      aria-label={`Mark option ${index + 1} as correct`}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                        isCorrect
                          ? 'border-success bg-success text-white'
                          : 'border-border-strong bg-bg text-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
                      )}
                    >
                      <Icon name="Check" size={12} strokeWidth={3} />
                    </span>
                  </label>

                  <Input
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    maxLength={OPTION_MAX}
                    onChange={(event) =>
                      onUpdateOption(index, event.target.value)
                    }
                    className="flex-1 border-transparent bg-transparent focus-within:border-primary"
                    aria-label={`Option ${index + 1}`}
                  />

                  <IconButton
                    aria-label={`Remove option ${index + 1}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveOption(index)}
                    disabled={optionsAtMin}
                  >
                    <Icon name="X" size={14} />
                  </IconButton>
                </li>
              );
            })}
          </ul>

          {!optionsAtMax && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddOption}
              leftIcon={<Icon name="Plus" size={14} />}
              className="text-xs"
            >
              Add option
            </Button>
          )}

          {(errors.options || errors.correct) && (
            <p className="text-xs text-danger" role="alert">
              {[errors.options, errors.correct].filter(Boolean).join(' ')}
            </p>
          )}
        </fieldset>

        <FormField
          label="Explanation (optional)"
          helper="Shown after the learner submits. Useful for teaching the why."
          error={errors.explanation}
        >
          {(props) => (
            <Textarea
              {...props}
              value={question.explanation}
              rows={2}
              autosize
              maxLength={EXPLANATION_MAX}
              showCounter
              placeholder="Explain why the correct answer is right."
              onChange={(event) =>
                onUpdate({ explanation: event.target.value })
              }
            />
          )}
        </FormField>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sticky save bar                                                           */
/* -------------------------------------------------------------------------- */

function SaveBar({
  questionCount,
  validity,
  saving,
  previewMode,
  onAddQuestion,
  onSave,
}) {
  const issueCount =
    Object.keys(validity.meta).length +
    validity.questions.reduce(
      (sum, errs) => sum + Object.keys(errs).length,
      0,
    );
  const tone = validity.isValid ? 'success' : 'warning';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur supports-backdrop-filter:bg-bg/80">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Button
          variant="secondary"
          onClick={onAddQuestion}
          disabled={previewMode}
          leftIcon={<Icon name="Plus" size={14} />}
        >
          Add question
        </Button>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-text-muted sm:inline-flex items-center gap-2">
            <Badge variant="neutral">
              {questionCount}{' '}
              {questionCount === 1 ? 'question' : 'questions'}
            </Badge>
            <Badge variant={tone}>
              {validity.isValid
                ? 'Ready to save'
                : `${issueCount} issue${issueCount === 1 ? '' : 's'} to fix`}
            </Badge>
          </span>

          <Button
            onClick={onSave}
            loading={saving}
            disabled={!validity.isValid || previewMode}
            leftIcon={<Icon name="Save" size={14} />}
          >
            Save quiz
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Preview mode — read-only student view                                     */
/* -------------------------------------------------------------------------- */

function QuizPreview({ draft, validation }) {
  const radioBaseId = useId();
  const totalQuestions = draft.questions.length;
  const meta = [
    `${totalQuestions} question${totalQuestions === 1 ? '' : 's'}`,
    `Passing ${draft.passingScore}%`,
    draft.timeLimitEnabled
      ? `Time limit ${formatDuration(draft.timeLimitMinutes)}`
      : 'No time limit',
  ];

  return (
    <div className="space-y-6">
      <Alert variant="info" title="Preview mode">
        This is exactly what learners will see — the answer key is hidden,
        just like the live quiz. Toggle preview off to keep editing.
      </Alert>

      <Card padding="lg" className="text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon name="ListChecks" size={24} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          {draft.title.trim() || 'Untitled quiz'}
        </h2>
        {draft.description.trim() && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
            {draft.description}
          </p>
        )}
        <ul className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-text-muted">
          {meta.map((item, index) => (
            <li key={item} className="inline-flex items-center gap-3">
              {index > 0 && <span aria-hidden="true">·</span>}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      {!validation.isValid && (
        <Alert variant="warning" title="Draft has unresolved issues">
          Some fields still need attention before learners can take this quiz.
        </Alert>
      )}

      {draft.questions.map((question, index) => (
        <Card key={question.uid} padding="lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Question {index + 1} of {totalQuestions}
          </p>
          <h3 className="text-xl font-semibold leading-snug text-text">
            {question.question.trim() || (
              <span className="text-text-muted">Untitled question</span>
            )}
          </h3>

          <fieldset className="mt-5 flex flex-col gap-3">
            <legend className="sr-only">Choose one answer</legend>
            {question.options.map((option, optionIndex) => (
              <SelectableCard
                key={`${question.uid}-preview-${optionIndex}`}
                name={`${radioBaseId}-${question.uid}`}
                value={optionIndex}
                selected={false}
                onSelect={() => {
                  /* preview only — selection is intentionally inert */
                }}
                label={option.trim() || `Option ${optionIndex + 1}`}
              />
            ))}
          </fieldset>
        </Card>
      ))}

      {draft.questions.length === 0 && (
        <Card padding="lg" className="text-center">
          <Spinner size="sm" className="mx-auto mb-2" />
          <p className="text-sm text-text-muted">
            Add at least one question to preview the quiz.
          </p>
        </Card>
      )}
    </div>
  );
}
