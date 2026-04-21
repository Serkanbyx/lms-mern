/**
 * `CourseForm` — the single source of truth for course authoring.
 *
 * One component is reused for both the "Create" and "Edit" pages so the
 * field set, validation rules, and persistence logic never drift between
 * the two flows. The page wrappers stay thin — they hand us a `mode`,
 * an optional pre-fetched course, and lifecycle callbacks; we own the
 * form state machine.
 *
 * Layout
 * ------
 * - Two-column desktop grid: form sections left, sticky summary card right.
 * - Sections collapse to a single column on narrower viewports so the
 *   summary doesn't crowd the inputs on tablet.
 *
 * Validation
 * ----------
 * - Live blur validation per field (`touched` flag prevents premature
 *   error noise on a fresh form).
 * - Submit-time validation always runs the full pass; errors collapse
 *   into a top `Alert` and the relevant fields show inline messages.
 * - Constraints mirror the server validators in `course.validator.js` so
 *   the client never lets through a payload the API will reject.
 *
 * Auto-save (edit mode only)
 * --------------------------
 * - Debounced 30s after the last change once the title is valid AND the
 *   form is dirty AND no manual save is in flight.
 * - Hard-skipped when the course is `published` because the server
 *   whitelist tightens — the user must opt in via "Save changes" so
 *   they're aware of which fields actually persist.
 *
 * Mass-assignment safety
 * ----------------------
 * The submit payload is hand-built field by field — `instructor`,
 * `slug`, `status`, and every denormalized counter are NEVER included
 * in the request body. The server enforces the same whitelist, but
 * shipping a clean payload keeps the network traffic obvious.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  Card,
  ChipInput,
  ConfirmModal,
  FormField,
  Icon,
  IconButton,
  Input,
  Select,
  StatusBadge,
  Textarea,
  Toggle,
  toast,
} from '../ui/index.js';
import { ImageDropzone } from './ImageDropzone.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  COURSE_CATEGORIES,
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  COURSE_STATUS,
  ROUTES,
} from '../../utils/constants.js';
import {
  archiveCourse,
  createCourse,
  deleteCourse,
  submitForReview,
  updateCourse,
} from '../../services/course.service.js';
import { cn } from '../../utils/cn.js';

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const SHORT_DESC_MAX = 200;
const FULL_DESC_MIN = 20;
const FULL_DESC_MAX = 5000;
const PRICE_MAX = 9999;
const TAGS_MAX = 10;
const TAG_MAX_LEN = 20;
const OUTCOMES_MAX = 10;
const OUTCOME_MAX_LEN = 200;
const REQUIREMENTS_MAX = 10;
const REQUIREMENT_MAX_LEN = 200;
const AUTO_SAVE_DELAY_MS = 30_000;

const CATEGORY_OPTIONS = COURSE_CATEGORIES.map((item) => ({
  value: item.value,
  label: item.label,
}));
const LEVEL_OPTIONS = COURSE_LEVELS.map((item) => ({
  value: item.value,
  label: item.label,
}));
const LANGUAGE_OPTIONS = COURSE_LANGUAGES.map((item) => ({
  value: item.value,
  label: item.label,
}));

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const emptyForm = Object.freeze({
  title: '',
  shortDescription: '',
  description: '',
  category: '',
  level: 'beginner',
  language: 'en',
  isPaid: false,
  price: 0,
  tags: [],
  learningOutcomes: [''],
  requirements: [''],
  thumbnail: { url: '', publicId: '' },
});

const courseToForm = (course) => {
  if (!course) return { ...emptyForm };
  const thumbnail =
    typeof course.thumbnail === 'string'
      ? { url: course.thumbnail, publicId: '' }
      : {
          url: course.thumbnail?.url ?? '',
          publicId: course.thumbnail?.publicId ?? '',
        };
  return {
    title: course.title ?? '',
    shortDescription: course.shortDescription ?? '',
    description: course.description ?? '',
    category: course.category ?? '',
    level: course.level ?? 'beginner',
    language: course.language ?? 'en',
    isPaid: (course.price ?? 0) > 0,
    price: course.price ?? 0,
    tags: Array.isArray(course.tags) ? course.tags : [],
    learningOutcomes:
      Array.isArray(course.learningOutcomes) && course.learningOutcomes.length > 0
        ? course.learningOutcomes
        : [''],
    requirements:
      Array.isArray(course.requirements) && course.requirements.length > 0
        ? course.requirements
        : [''],
    thumbnail,
  };
};

const trimList = (items) =>
  (items ?? [])
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

const formToPayload = (form) => {
  const tags = (form.tags ?? [])
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter((tag) => tag.length > 0);
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    category: form.category,
    level: form.level,
    language: form.language,
    price: form.isPaid ? Number(form.price) || 0 : 0,
    tags,
    learningOutcomes: trimList(form.learningOutcomes),
    requirements: trimList(form.requirements),
    thumbnail: {
      url: form.thumbnail?.url ?? '',
      publicId: form.thumbnail?.publicId ?? '',
    },
  };
};

/**
 * Pure validator. Returns an `errors` map (field → message). The server
 * enforces the same rules, but failing fast in the client gives the user
 * an instant correction loop without a network round-trip.
 */
const validateForm = (form) => {
  const errors = {};

  const title = form.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.title = `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`;
  }

  if (form.shortDescription.length > SHORT_DESC_MAX) {
    errors.shortDescription = `Short description must be at most ${SHORT_DESC_MAX} characters.`;
  }

  const description = form.description.trim();
  if (description.length < FULL_DESC_MIN || description.length > FULL_DESC_MAX) {
    errors.description = `Description must be between ${FULL_DESC_MIN} and ${FULL_DESC_MAX} characters.`;
  }

  if (!form.category) {
    errors.category = 'Pick a category so learners can find your course.';
  }

  if (!form.level) {
    errors.level = 'Pick a difficulty level.';
  }

  if (form.isPaid) {
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0 || price > PRICE_MAX) {
      errors.price = `Price must be between 0 and ${PRICE_MAX}.`;
    }
  }

  if (form.tags.length > TAGS_MAX) {
    errors.tags = `Up to ${TAGS_MAX} tags only.`;
  } else if (form.tags.some((tag) => tag.length > TAG_MAX_LEN)) {
    errors.tags = `Each tag must be at most ${TAG_MAX_LEN} characters.`;
  }

  const outcomes = trimList(form.learningOutcomes);
  if (outcomes.some((entry) => entry.length > OUTCOME_MAX_LEN)) {
    errors.learningOutcomes = `Each outcome must be at most ${OUTCOME_MAX_LEN} characters.`;
  } else if (outcomes.length > OUTCOMES_MAX) {
    errors.learningOutcomes = `Up to ${OUTCOMES_MAX} outcomes only.`;
  }

  const requirements = trimList(form.requirements);
  if (requirements.some((entry) => entry.length > REQUIREMENT_MAX_LEN)) {
    errors.requirements = `Each requirement must be at most ${REQUIREMENT_MAX_LEN} characters.`;
  } else if (requirements.length > REQUIREMENTS_MAX) {
    errors.requirements = `Up to ${REQUIREMENTS_MAX} requirements only.`;
  }

  return errors;
};

const formatRelativeTime = (date) => {
  if (!date) return null;
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const diffMs = Date.now() - value.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
};

const useNow = (intervalMs = 30_000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function FormSection({ title, description, icon, children }) {
  return (
    <section className="rounded-2xl border border-border bg-bg shadow-xs">
      <header className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-border">
        {icon && (
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Icon name={icon} size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {description && (
            <p className="text-sm text-text-muted mt-0.5">{description}</p>
          )}
        </div>
      </header>
      <div className="px-5 sm:px-6 py-5 space-y-5">{children}</div>
    </section>
  );
}

function CharCounter({ value, max }) {
  const length = value?.length ?? 0;
  const isNear = length > max * 0.9;
  const isOver = length > max;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        isOver
          ? 'text-danger'
          : isNear
            ? 'text-warning'
            : 'text-text-subtle',
      )}
      aria-live="polite"
    >
      {length} / {max}
    </span>
  );
}

function DynamicList({
  label,
  description,
  value,
  onChange,
  placeholder,
  max,
  maxLength,
  error,
  addLabel,
}) {
  const handleItemChange = (index, next) => {
    const updated = [...value];
    updated[index] = next;
    onChange(updated);
  };

  const handleRemove = (index) => {
    if (value.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(value.filter((_, idx) => idx !== index));
  };

  const handleAdd = () => {
    if (value.length >= max) return;
    onChange([...value, '']);
  };

  return (
    <FormField label={label} helper={description} error={error}>
      {() => (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                value={item}
                onChange={(event) => handleItemChange(index, event.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                aria-label={`${label} ${index + 1}`}
              />
              <IconButton
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                variant="ghost"
                onClick={() => handleRemove(index)}
              >
                <Icon name="X" size={16} />
              </IconButton>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={value.length >= max}
              leftIcon={<Icon name="Plus" size={14} />}
            >
              {addLabel}
            </Button>
            <span className="text-xs text-text-subtle tabular-nums">
              {value.filter((entry) => entry.trim().length > 0).length} / {max}
            </span>
          </div>
        </div>
      )}
    </FormField>
  );
}

function SummaryCard({
  mode,
  status,
  lastSavedAt,
  isDirty,
  hasErrors,
  isSubmitting,
  isAutoSaving,
  isLocked,
  onSave,
  onSubmitForReview,
  onArchive,
  onDelete,
}) {
  useNow(30_000);
  const savedRelative = formatRelativeTime(lastSavedAt);

  const lifecycleAvailable = mode === 'edit';
  const canSubmit =
    lifecycleAvailable &&
    (status === COURSE_STATUS.draft || status === COURSE_STATUS.rejected);
  const canArchive =
    lifecycleAvailable &&
    (status === COURSE_STATUS.draft ||
      status === COURSE_STATUS.published ||
      status === COURSE_STATUS.rejected);
  const canDelete = lifecycleAvailable;

  return (
    <Card padding="md" className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-subtle">
            Status
          </span>
          {lifecycleAvailable ? (
            <StatusBadge status={status ?? COURSE_STATUS.draft} />
          ) : (
            <Badge variant="neutral" size="sm">
              New course
            </Badge>
          )}
        </div>

        <div className="text-sm text-text-muted">
          {lifecycleAvailable ? (
            <>
              {savedRelative ? (
                <>
                  Saved <span className="text-text">{savedRelative}</span>
                </>
              ) : (
                'No changes saved yet.'
              )}
              {isAutoSaving && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-info">
                  <Icon name="Loader2" size={12} className="animate-spin" />
                  Auto-saving…
                </span>
              )}
            </>
          ) : (
            'Save your draft to claim a spot in the catalog. You can keep editing afterwards.'
          )}
        </div>

        {isLocked && (
          <Alert variant="info" title="Published course">
            Only marketing copy, taxonomy lists, and the cover image can be
            edited inline. Title, price, and difficulty are locked to protect
            enrolled students.
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Button
          onClick={onSave}
          loading={isSubmitting}
          disabled={hasErrors || (!isDirty && mode === 'edit')}
          className="w-full"
          leftIcon={<Icon name="Save" size={16} />}
        >
          {mode === 'create' ? 'Save as draft' : 'Save changes'}
        </Button>

        {canSubmit && (
          <Button
            variant="secondary"
            onClick={onSubmitForReview}
            disabled={isDirty || hasErrors}
            className="w-full"
            leftIcon={<Icon name="Send" size={16} />}
          >
            Submit for review
          </Button>
        )}

        {canArchive && (
          <Button
            variant="outline"
            onClick={onArchive}
            disabled={status !== COURSE_STATUS.published}
            className="w-full"
            leftIcon={<Icon name="Archive" size={16} />}
          >
            Archive course
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            onClick={onDelete}
            className="w-full text-danger hover:bg-danger/10"
            leftIcon={<Icon name="Trash2" size={16} />}
          >
            Delete course
          </Button>
        )}
      </div>

      {(isDirty || hasErrors) && mode === 'edit' && (
        <p className="text-xs text-text-subtle">
          {hasErrors
            ? 'Fix the highlighted fields before submitting for review.'
            : 'Save your changes before submitting for review.'}
        </p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main form                                                                 */
/* -------------------------------------------------------------------------- */

export function CourseForm({
  mode = 'create',
  course = null,
  onCreated,
  onUpdated,
  onDeleted,
}) {
  const navigate = useNavigate();

  const initial = useMemo(() => courseToForm(course), [course]);
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(
    mode === 'edit' && course ? new Date(course.updatedAt ?? course.createdAt ?? Date.now()) : null,
  );
  const [confirmKind, setConfirmKind] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const lastSavedSnapshotRef = useRef(JSON.stringify(initial));
  const skipNextAutoSaveRef = useRef(true);

  // Reset internal state when the parent swaps the underlying course
  // (e.g. the edit page finished loading after a route change).
  useEffect(() => {
    setForm(initial);
    setTouched({});
    setShowAllErrors(false);
    lastSavedSnapshotRef.current = JSON.stringify(initial);
    skipNextAutoSaveRef.current = true;
    if (mode === 'edit' && course) {
      setLastSavedAt(
        new Date(course.updatedAt ?? course.createdAt ?? Date.now()),
      );
    }
  }, [initial, mode, course]);

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const visibleErrors = useMemo(() => {
    if (showAllErrors) return errors;
    const filtered = {};
    for (const key of Object.keys(errors)) {
      if (touched[key]) filtered[key] = errors[key];
    }
    return filtered;
  }, [errors, showAllErrors, touched]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== lastSavedSnapshotRef.current,
    [form],
  );

  const status = course?.status ?? COURSE_STATUS.draft;
  const isPublished = mode === 'edit' && status === COURSE_STATUS.published;

  /* ----------------------------- field helpers ---------------------------- */

  const setField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const markTouched = useCallback((name) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  /* ---------------------------- save / submit ----------------------------- */

  const persist = useCallback(
    async ({ silent = false } = {}) => {
      const validation = validateForm(form);
      if (Object.keys(validation).length > 0) {
        if (!silent) {
          setShowAllErrors(true);
          toast.error('Please fix the highlighted fields before saving.');
        }
        return null;
      }

      const payload = formToPayload(form);

      try {
        if (mode === 'create') {
          const result = await createCourse(payload);
          const created = result?.course ?? result?.data ?? null;
          lastSavedSnapshotRef.current = JSON.stringify(form);
          setLastSavedAt(new Date());
          if (!silent) toast.success("Course created — let's add lessons.");
          onCreated?.(created);
          return created;
        }

        const courseId = course?._id ?? course?.id;
        if (!courseId) throw new Error('Course id missing.');
        const result = await updateCourse(courseId, payload);
        const updated = result?.course ?? result?.data ?? null;
        lastSavedSnapshotRef.current = JSON.stringify(form);
        setLastSavedAt(new Date());
        if (!silent) toast.success('Course saved.');
        else toast.success('Draft saved', { duration: 1500 });
        onUpdated?.(updated);
        return updated;
      } catch (err) {
        const message =
          err?.response?.data?.message ??
          err?.message ??
          'Could not save course. Please try again.';
        toast.error(message);
        return null;
      }
    },
    [course?._id, course?.id, form, mode, onCreated, onUpdated],
  );

  const handleManualSave = useCallback(async () => {
    setShowAllErrors(true);
    setIsSubmitting(true);
    try {
      await persist();
    } finally {
      setIsSubmitting(false);
    }
  }, [persist]);

  /* -------------------------------- auto-save ---------------------------- */

  // Snapshot of the user-visible form, sampled on every change. The
  // debounced copy is what triggers the auto-save effect — so a continuous
  // typing burst only writes once after the user pauses.
  const debouncedSnapshot = useDebounce(form, AUTO_SAVE_DELAY_MS);

  useEffect(() => {
    if (mode !== 'edit') return;
    if (isPublished) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    const snapshot = JSON.stringify(debouncedSnapshot);
    if (snapshot === lastSavedSnapshotRef.current) return;
    if (Object.keys(validateForm(debouncedSnapshot)).length > 0) return;

    let cancelled = false;
    setIsAutoSaving(true);
    persist({ silent: true }).finally(() => {
      if (!cancelled) setIsAutoSaving(false);
    });
    return () => {
      cancelled = true;
    };
    // `persist` is stable per dependencies above; we only want to react
    // to a settled snapshot of the form value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSnapshot, mode, isPublished]);

  /* ---------------------------- lifecycle actions ------------------------- */

  const handleSubmitForReview = useCallback(async () => {
    const courseId = course?._id ?? course?.id;
    if (!courseId) return;
    if (isDirty) {
      toast.error('Save your changes before submitting for review.');
      return;
    }
    try {
      const result = await submitForReview(courseId);
      const updated = result?.course ?? result?.data ?? null;
      onUpdated?.(updated);
      toast.success('Submitted for review.');
    } catch (err) {
      toast.error(
        err?.response?.data?.message ??
          'Could not submit course for review.',
      );
    }
  }, [course?._id, course?.id, isDirty, onUpdated]);

  const handleConfirm = useCallback(async () => {
    const courseId = course?._id ?? course?.id;
    if (!courseId || !confirmKind) return;
    setConfirmLoading(true);
    try {
      if (confirmKind === 'archive') {
        const result = await archiveCourse(courseId);
        const updated = result?.course ?? result?.data ?? null;
        onUpdated?.(updated);
        toast.success('Course archived.');
      } else if (confirmKind === 'delete') {
        await deleteCourse(courseId);
        toast.success('Course deleted.');
        onDeleted?.();
        navigate(ROUTES.instructor);
      }
      setConfirmKind(null);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ??
          `Could not ${confirmKind} course. Please try again.`,
      );
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmKind, course?._id, course?.id, navigate, onDeleted, onUpdated]);

  /* --------------------------------- render ------------------------------- */

  const errorList = Object.entries(visibleErrors);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Form column ------------------------------------------------------- */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleManualSave();
        }}
        className="space-y-6 min-w-0"
      >
        {showAllErrors && errorList.length > 0 && (
          <Alert variant="danger" title="Some fields need your attention">
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {errorList.map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Basics --------------------------------------------------------- */}
        <FormSection
          title="Basics"
          description="The headline learners see first."
          icon="Sparkles"
        >
          <FormField
            label="Course title"
            required
            error={visibleErrors.title}
            helper={
              <span className="flex items-center justify-between">
                <span>5 to 120 characters. Make it memorable.</span>
                <CharCounter value={form.title} max={TITLE_MAX} />
              </span>
            }
          >
            {(props) => (
              <Input
                {...props}
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                onBlur={() => markTouched('title')}
                placeholder="e.g. Modern React from scratch"
                maxLength={TITLE_MAX}
                disabled={isPublished}
              />
            )}
          </FormField>

          <FormField
            label="Short description"
            helper={
              <span className="flex items-center justify-between">
                <span>Used in catalog cards and previews.</span>
                <CharCounter value={form.shortDescription} max={SHORT_DESC_MAX} />
              </span>
            }
            error={visibleErrors.shortDescription}
          >
            {(props) => (
              <Input
                {...props}
                value={form.shortDescription}
                onChange={(event) =>
                  setField('shortDescription', event.target.value)
                }
                onBlur={() => markTouched('shortDescription')}
                placeholder="Hook a learner in one line."
                maxLength={SHORT_DESC_MAX}
              />
            )}
          </FormField>

          <FormField
            label="Full description"
            required
            error={visibleErrors.description}
            helper={
              <span className="flex items-center justify-between">
                <span>20 to 5000 characters. Markdown is welcome.</span>
                <CharCounter value={form.description} max={FULL_DESC_MAX} />
              </span>
            }
          >
            {(props) => (
              <Textarea
                {...props}
                autosize
                rows={5}
                maxRows={16}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                onBlur={() => markTouched('description')}
                placeholder="Walk learners through what this course covers, who it is for, and the outcomes they can expect."
                maxLength={FULL_DESC_MAX}
              />
            )}
          </FormField>
        </FormSection>

        {/* Classification ------------------------------------------------- */}
        <FormSection
          title="Classification"
          description="Helps learners discover your course."
          icon="Tags"
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField label="Category" required error={visibleErrors.category}>
              {(props) => (
                <Select
                  {...props}
                  value={form.category}
                  onChange={(event) => setField('category', event.target.value)}
                  onBlur={() => markTouched('category')}
                  options={CATEGORY_OPTIONS}
                  placeholder="Choose category"
                  disabled={isPublished}
                />
              )}
            </FormField>

            <FormField label="Level" required error={visibleErrors.level}>
              {(props) => (
                <Select
                  {...props}
                  value={form.level}
                  onChange={(event) => setField('level', event.target.value)}
                  options={LEVEL_OPTIONS}
                  disabled={isPublished}
                />
              )}
            </FormField>

            <FormField label="Language">
              {(props) => (
                <Select
                  {...props}
                  value={form.language}
                  onChange={(event) => setField('language', event.target.value)}
                  options={LANGUAGE_OPTIONS}
                  disabled={isPublished}
                />
              )}
            </FormField>
          </div>
        </FormSection>

        {/* Pricing -------------------------------------------------------- */}
        <FormSection
          title="Pricing"
          description="Free or paid — switch at any time before publishing."
          icon="DollarSign"
        >
          <Toggle
            checked={form.isPaid}
            onChange={(next) => {
              setField('isPaid', next);
              if (!next) setField('price', 0);
            }}
            label={form.isPaid ? 'Paid course' : 'Free course'}
            description={
              form.isPaid
                ? 'Learners are charged the price below at enrollment.'
                : 'Anyone can enroll without payment.'
            }
            disabled={isPublished}
          />

          {form.isPaid && (
            <FormField
              label="Price (USD)"
              required
              error={visibleErrors.price}
              helper="Between $0 and $9,999."
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  max={PRICE_MAX}
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    setField('price', event.target.value)
                  }
                  onBlur={() => markTouched('price')}
                  leadingIcon={<Icon name="DollarSign" size={14} />}
                  disabled={isPublished}
                  className="max-w-48"
                />
              )}
            </FormField>
          )}
        </FormSection>

        {/* Tags ----------------------------------------------------------- */}
        <FormSection
          title="Tags"
          description="Searchable keywords. Up to 10."
          icon="Hash"
        >
          <FormField
            label="Tags"
            hideLabel
            error={visibleErrors.tags}
            helper={`${form.tags.length} / ${TAGS_MAX} tags · Each up to ${TAG_MAX_LEN} characters.`}
          >
            {(props) => (
              <ChipInput
                {...props}
                value={form.tags}
                onChange={(next) => setField('tags', next)}
                placeholder="Type a tag and press Enter…"
                maxItems={TAGS_MAX}
              />
            )}
          </FormField>
        </FormSection>

        {/* What you'll teach --------------------------------------------- */}
        <FormSection
          title="What you'll teach"
          description="Bullet points learners will see at the top of the course page."
          icon="Target"
        >
          <DynamicList
            label="Learning outcomes"
            description="Start each line with an action verb (build, design, deploy…)"
            value={form.learningOutcomes}
            onChange={(next) => setField('learningOutcomes', next)}
            placeholder="e.g. Build a production-ready REST API with Express"
            max={OUTCOMES_MAX}
            maxLength={OUTCOME_MAX_LEN}
            error={visibleErrors.learningOutcomes}
            addLabel="Add outcome"
          />
        </FormSection>

        {/* Requirements --------------------------------------------------- */}
        <FormSection
          title="Requirements"
          description="What learners need before starting."
          icon="ClipboardList"
        >
          <DynamicList
            label="Requirements"
            description="Skills, tooling, or prior knowledge you assume."
            value={form.requirements}
            onChange={(next) => setField('requirements', next)}
            placeholder="e.g. Familiarity with JavaScript fundamentals"
            max={REQUIREMENTS_MAX}
            maxLength={REQUIREMENT_MAX_LEN}
            error={visibleErrors.requirements}
            addLabel="Add requirement"
          />
        </FormSection>

        {/* Cover image --------------------------------------------------- */}
        <FormSection
          title="Cover image"
          description="The first thing learners see on the catalog."
          icon="Image"
        >
          <ImageDropzone
            value={form.thumbnail}
            onChange={(next) => setField('thumbnail', next)}
          />
        </FormSection>

        <div className="flex items-center justify-end gap-3 lg:hidden">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={hasErrors}
            leftIcon={<Icon name="Save" size={16} />}
          >
            {mode === 'create' ? 'Save as draft' : 'Save changes'}
          </Button>
        </div>
      </form>

      {/* Sticky summary --------------------------------------------------- */}
      <aside className="lg:sticky lg:top-24 self-start">
        <SummaryCard
          mode={mode}
          status={status}
          lastSavedAt={lastSavedAt}
          isDirty={isDirty}
          hasErrors={hasErrors}
          isSubmitting={isSubmitting}
          isAutoSaving={isAutoSaving}
          isLocked={isPublished}
          onSave={handleManualSave}
          onSubmitForReview={handleSubmitForReview}
          onArchive={() => setConfirmKind('archive')}
          onDelete={() => setConfirmKind('delete')}
        />
      </aside>

      <ConfirmModal
        open={confirmKind !== null}
        loading={confirmLoading}
        onClose={() => (confirmLoading ? null : setConfirmKind(null))}
        onConfirm={handleConfirm}
        title={
          confirmKind === 'archive'
            ? `Archive "${course?.title ?? 'this course'}"?`
            : `Delete "${course?.title ?? 'this course'}"?`
        }
        description={
          confirmKind === 'archive'
            ? 'Archived courses are hidden from the public catalog and cannot accept new enrollments. Existing students keep their access.'
            : 'This permanently removes the course, all sections, lessons, and quizzes. Existing student enrollments will be detached. This action cannot be undone.'
        }
        confirmLabel={
          confirmKind === 'archive' ? 'Archive course' : 'Delete course'
        }
        danger={confirmKind === 'delete'}
      />
    </div>
  );
}

export default CourseForm;
