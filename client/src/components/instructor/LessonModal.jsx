/**
 * `LessonModal` — stepped form for creating or editing a lesson.
 *
 * Two screens, switched in-place:
 *   1. **Basics** — title, type (video / text), free-preview toggle.
 *   2. **Content** — branches on `type`:
 *        - `video`: provider segmented control. Cloudinary streams a
 *          dropzone-driven upload (progress + duration auto-fill);
 *          YouTube / Vimeo accept an HTTPS URL plus a manual duration
 *          (we cannot probe their APIs from the browser without an
 *          API key, so the instructor types the runtime by hand).
 *        - `text`: autosize textarea with character counter and an
 *          optional live preview pane (no markdown parser — we render
 *          plain text exactly the same way the student page does).
 *
 * Validation mirrors `Lesson.model.js` + `lesson.validator.js`:
 *   - title: 3–120 chars
 *   - video: HTTPS URL required
 *   - text: trimmed `content` non-empty, ≤ 50 000 chars
 *   - duration: non-negative number (seconds)
 *
 * The component never persists by itself — `onSubmit(payload)` is the
 * single integration point. The parent decides whether to call
 * `createLesson(sectionId, payload)` or `updateLesson(id, payload)`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  Textarea,
  Toggle,
  toast,
} from '../ui/index.js';
import { VideoDropzone } from './VideoDropzone.jsx';
import { cn } from '../../utils/cn.js';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const CONTENT_MAX = 50_000;
const HTTPS_URL_REGEX = /^https:\/\/[^\s]+$/i;
const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i;
const VIMEO_ID_REGEX = /vimeo\.com\/(?:video\/)?(\d+)/i;

const PROVIDER_OPTIONS = Object.freeze([
  { value: 'cloudinary', label: 'Upload', icon: 'Upload' },
  { value: 'youtube', label: 'YouTube', icon: 'Youtube' },
  { value: 'vimeo', label: 'Vimeo', icon: 'Video' },
]);

const TYPE_OPTIONS = Object.freeze([
  { value: 'video', label: 'Video', description: 'Streamed lesson with a player.', icon: 'Play' },
  { value: 'text', label: 'Reading', description: 'Inline rich text content.', icon: 'FileText' },
]);

const STEPS = Object.freeze([
  { id: 'basics', label: 'Basics' },
  { id: 'content', label: 'Content' },
]);

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const emptyForm = Object.freeze({
  title: '',
  type: 'video',
  isFreePreview: false,
  videoProvider: 'cloudinary',
  videoUrl: '',
  videoPublicId: '',
  content: '',
  duration: 0,
});

const lessonToForm = (lesson) => {
  if (!lesson) return { ...emptyForm };
  return {
    title: lesson.title ?? '',
    type: lesson.type ?? 'video',
    isFreePreview: Boolean(lesson.isFreePreview),
    videoProvider: lesson.videoProvider ?? 'cloudinary',
    videoUrl: lesson.videoUrl ?? '',
    videoPublicId: lesson.videoPublicId ?? '',
    content: lesson.content ?? '',
    duration: Number(lesson.duration ?? 0),
  };
};

const formToPayload = (form) => {
  const base = {
    title: form.title.trim(),
    type: form.type,
    isFreePreview: Boolean(form.isFreePreview),
    duration: Math.max(0, Number(form.duration) || 0),
  };

  if (form.type === 'video') {
    return {
      ...base,
      videoProvider: form.videoProvider,
      videoUrl: form.videoUrl.trim(),
      videoPublicId:
        form.videoProvider === 'cloudinary' ? form.videoPublicId : '',
      content: '',
    };
  }

  return {
    ...base,
    content: form.content,
    videoUrl: '',
    videoPublicId: '',
    videoProvider: 'cloudinary',
  };
};

const validateBasics = (form) => {
  const errors = {};
  const title = form.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.title = `Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`;
  }
  if (!['video', 'text'].includes(form.type)) {
    errors.type = 'Pick a lesson type.';
  }
  return errors;
};

const validateContent = (form) => {
  const errors = {};
  if (form.type === 'video') {
    const url = form.videoUrl.trim();
    if (!url) {
      errors.videoUrl = 'Video URL is required.';
    } else if (!HTTPS_URL_REGEX.test(url)) {
      errors.videoUrl = 'Video URL must be a valid HTTPS link.';
    }
    if (!Number.isFinite(Number(form.duration)) || Number(form.duration) < 0) {
      errors.duration = 'Duration must be a positive number of seconds.';
    } else if (form.videoProvider !== 'cloudinary' && Number(form.duration) <= 0) {
      errors.duration = 'Type the lesson runtime in seconds.';
    }
  } else {
    const content = (form.content ?? '').trim();
    if (!content) {
      errors.content = 'Reading lessons need at least a few words of content.';
    } else if (content.length > CONTENT_MAX) {
      errors.content = `Content must be at most ${CONTENT_MAX} characters.`;
    }
  }
  return errors;
};

const extractYouTubeId = (url) => {
  if (!url) return '';
  const match = String(url).match(YOUTUBE_ID_REGEX);
  return match?.[1] ?? '';
};

const extractVimeoId = (url) => {
  if (!url) return '';
  const match = String(url).match(VIMEO_ID_REGEX);
  return match?.[1] ?? '';
};

const formatSeconds = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function StepHeader({ stepIndex }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isCurrent = index === stepIndex;
        const isDone = index < stepIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                isCurrent
                  ? 'bg-primary text-primary-fg'
                  : isDone
                    ? 'bg-success text-white'
                    : 'bg-bg-muted text-text-muted',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isDone ? <Icon name="Check" size={12} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                'text-xs font-medium',
                isCurrent ? 'text-text' : 'text-text-muted',
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypePicker({ value, onChange, disabled }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-inset ring-primary/30'
                : 'border-border hover:border-primary/40',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                selected
                  ? 'bg-primary text-primary-fg'
                  : 'bg-bg-muted text-text-muted',
              )}
              aria-hidden="true"
            >
              <Icon name={option.icon} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text">
                {option.label}
              </span>
              <span className="block text-xs text-text-muted">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProviderSegmented({ value, onChange, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Video provider"
      className="inline-flex rounded-lg border border-border bg-bg-subtle p-1"
    >
      {PROVIDER_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'bg-bg text-text shadow-xs'
                : 'text-text-muted hover:text-text',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <Icon name={option.icon} size={13} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ExternalVideoPreview({ provider, url }) {
  if (!url) return null;
  if (provider === 'youtube') {
    const id = extractYouTubeId(url);
    if (!id) {
      return (
        <p className="text-xs text-warning">
          Couldn&apos;t detect a YouTube video id from that URL.
        </p>
      );
    }
    return (
      <div className="overflow-hidden rounded-md border border-border">
        <img
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          alt="YouTube thumbnail preview"
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      </div>
    );
  }
  if (provider === 'vimeo') {
    const id = extractVimeoId(url);
    if (!id) {
      return (
        <p className="text-xs text-warning">
          Couldn&apos;t detect a Vimeo video id from that URL.
        </p>
      );
    }
    return (
      <div className="flex aspect-video items-center justify-center rounded-md border border-border bg-bg-subtle">
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <Icon name="Video" size={14} />
          Vimeo · #{id}
        </span>
      </div>
    );
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Main modal                                                                */
/* -------------------------------------------------------------------------- */

export function LessonModal({
  open,
  mode = 'create',
  lesson = null,
  onClose,
  onSubmit,
}) {
  const initial = useMemo(() => lessonToForm(lesson), [lesson]);
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setStep(0);
    setShowAllErrors(false);
    setSubmitting(false);
    setShowPreview(false);
    const id = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, initial]);

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const basicsErrors = useMemo(() => validateBasics(form), [form]);
  const contentErrors = useMemo(() => validateContent(form), [form]);
  const allErrors = { ...basicsErrors, ...contentErrors };
  const visibleErrors = showAllErrors
    ? allErrors
    : step === 0
      ? basicsErrors
      : contentErrors;

  const goNext = () => {
    setShowAllErrors(true);
    if (Object.keys(basicsErrors).length > 0) return;
    setShowAllErrors(false);
    setStep(1);
  };

  const handleSubmit = async () => {
    setShowAllErrors(true);
    if (Object.keys(allErrors).length > 0) {
      toast.error('Fix the highlighted fields before saving.');
      if (Object.keys(basicsErrors).length > 0) setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.(formToPayload(form));
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Could not save lesson. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVideoUploaded = ({ url, publicId, duration }) => {
    setForm((prev) => ({
      ...prev,
      videoUrl: url,
      videoPublicId: publicId,
      duration: duration > 0 ? duration : prev.duration,
    }));
  };

  const titleLabel =
    mode === 'create' ? 'Add a lesson' : `Edit · ${lesson?.title ?? 'lesson'}`;

  /* ------------------------- step renderers ------------------------- */

  const renderBasics = () => (
    <div className="space-y-5">
      <FormField
        label="Lesson title"
        required
        error={visibleErrors.title}
        helper={`${TITLE_MIN}–${TITLE_MAX} characters.`}
      >
        {(props) => (
          <Input
            {...props}
            ref={titleRef}
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="e.g. Setting up your dev environment"
            maxLength={TITLE_MAX}
          />
        )}
      </FormField>

      <FormField label="Lesson type" required error={visibleErrors.type}>
        {() => (
          <TypePicker
            value={form.type}
            onChange={(next) => setField('type', next)}
          />
        )}
      </FormField>

      <Toggle
        checked={form.isFreePreview}
        onChange={(next) => setField('isFreePreview', next)}
        label="Free preview"
        description="Lets non-enrolled visitors play this lesson on the marketing page."
      />
    </div>
  );

  const renderVideoStep = () => (
    <div className="space-y-5">
      <FormField label="Source" helper="Where this video lives.">
        {() => (
          <ProviderSegmented
            value={form.videoProvider}
            onChange={(next) =>
              setForm((prev) => ({
                ...prev,
                videoProvider: next,
                videoUrl: next === prev.videoProvider ? prev.videoUrl : '',
                videoPublicId:
                  next === 'cloudinary' ? prev.videoPublicId : '',
              }))
            }
          />
        )}
      </FormField>

      {form.videoProvider === 'cloudinary' ? (
        <div className="space-y-2">
          <VideoDropzone
            value={{
              url: form.videoUrl,
              publicId: form.videoPublicId,
              duration: form.duration,
            }}
            onChange={handleVideoUploaded}
          />
          {visibleErrors.videoUrl && (
            <p className="text-xs text-danger" role="alert">
              {visibleErrors.videoUrl}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <FormField
            label={`${form.videoProvider === 'youtube' ? 'YouTube' : 'Vimeo'} URL`}
            required
            error={visibleErrors.videoUrl}
            helper="Must be an HTTPS link."
          >
            {(props) => (
              <Input
                {...props}
                value={form.videoUrl}
                onChange={(event) => setField('videoUrl', event.target.value)}
                placeholder={
                  form.videoProvider === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : 'https://vimeo.com/...'
                }
                inputMode="url"
                leadingIcon={<Icon name="Link2" size={14} />}
              />
            )}
          </FormField>
          <ExternalVideoPreview
            provider={form.videoProvider}
            url={form.videoUrl}
          />
        </div>
      )}

      <FormField
        label="Duration (seconds)"
        required={form.videoProvider !== 'cloudinary'}
        error={visibleErrors.duration}
        helper={
          form.videoProvider === 'cloudinary'
            ? 'Filled automatically after upload — adjust only if Cloudinary mis-detected.'
            : 'Hint: YouTube duration shows next to the video title.'
        }
      >
        {(props) => (
          <div className="flex items-end gap-3">
            <Input
              {...props}
              type="number"
              min={0}
              step={1}
              value={form.duration}
              onChange={(event) => setField('duration', event.target.value)}
              className="max-w-40"
              leadingIcon={<Icon name="Clock" size={14} />}
            />
            <span className="text-xs text-text-muted tabular-nums">
              ≈ {formatSeconds(form.duration)}
            </span>
          </div>
        )}
      </FormField>
    </div>
  );

  const renderTextStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          Plain text only — line breaks are preserved as the student sees them.
          Markdown is welcome but rendered as-is.
        </p>
        <Toggle
          checked={showPreview}
          onChange={setShowPreview}
          size="sm"
          label="Preview"
        />
      </div>

      {showPreview ? (
        <article className="min-h-40 rounded-lg border border-border bg-bg-subtle p-4 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-text">
          {form.content.trim() || (
            <span className="text-text-subtle">Nothing to preview yet.</span>
          )}
        </article>
      ) : (
        <FormField
          label="Lesson content"
          hideLabel
          error={visibleErrors.content}
          helper={
            <span className="flex items-center justify-between">
              <span>Up to {CONTENT_MAX.toLocaleString()} characters.</span>
              <span
                className={cn(
                  'tabular-nums',
                  form.content.length > CONTENT_MAX
                    ? 'text-danger'
                    : form.content.length > CONTENT_MAX * 0.9
                      ? 'text-warning'
                      : 'text-text-subtle',
                )}
              >
                {form.content.length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}
              </span>
            </span>
          }
        >
          {(props) => (
            <Textarea
              {...props}
              autosize
              rows={8}
              maxRows={20}
              value={form.content}
              onChange={(event) => setField('content', event.target.value)}
              placeholder="Write the lesson body here…"
              maxLength={CONTENT_MAX}
            />
          )}
        </FormField>
      )}

      <FormField
        label="Estimated reading time (seconds)"
        helper="Used by the catalog and progress tracker."
        error={visibleErrors.duration}
      >
        {(props) => (
          <div className="flex items-end gap-3">
            <Input
              {...props}
              type="number"
              min={0}
              step={1}
              value={form.duration}
              onChange={(event) => setField('duration', event.target.value)}
              className="max-w-40"
              leadingIcon={<Icon name="Clock" size={14} />}
            />
            <span className="text-xs text-text-muted tabular-nums">
              ≈ {formatSeconds(form.duration)}
            </span>
          </div>
        )}
      </FormField>
    </div>
  );

  /* --------------------------- render --------------------------- */

  return (
    <Modal
      open={open}
      onClose={submitting ? () => null : onClose}
      title={titleLabel}
      description={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step].label}`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {form.isFreePreview && (
              <Badge variant="info" size="sm">
                Free preview
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                onClick={() => setStep(0)}
                disabled={submitting}
                leftIcon={<Icon name="ArrowLeft" size={14} />}
              >
                Back
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            {step === 0 ? (
              <Button
                onClick={goNext}
                rightIcon={<Icon name="ArrowRight" size={14} />}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={submitting}
                leftIcon={<Icon name="Save" size={14} />}
              >
                {mode === 'create' ? 'Create lesson' : 'Save lesson'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <StepHeader stepIndex={step} />

        {showAllErrors && Object.keys(allErrors).length > 0 && (
          <Alert variant="danger" title="Some fields need your attention">
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {Object.entries(allErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {step === 0
          ? renderBasics()
          : form.type === 'video'
            ? renderVideoStep()
            : renderTextStep()}
      </div>
    </Modal>
  );
}

export default LessonModal;
