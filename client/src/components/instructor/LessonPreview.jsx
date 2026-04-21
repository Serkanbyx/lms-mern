/**
 * `LessonPreview` — right pane of the curriculum builder.
 *
 * Mimics what the enrolled student sees on the lesson player so the
 * instructor can sanity-check formatting without bouncing between tabs:
 *   - Video lessons render a `react-player` instance (cloudinary, YouTube,
 *     and Vimeo URLs are all handled by the same component).
 *   - Reading lessons render the raw text in a `whitespace-pre-wrap`
 *     article — exactly the same surface the player uses, so there is
 *     no preview-vs-production drift.
 *
 * The component is purely presentational. The parent decides which lesson
 * is selected and forwards "Edit / Manage quiz" intents back through the
 * `onEdit` and `onManageQuiz` callbacks so the modal lifecycle stays in
 * one place.
 *
 * `react-player` is loaded lazily because the bundle is heavy and the
 * preview is only useful once the instructor actually clicks a lesson.
 */

import { Suspense } from 'react';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Spinner,
} from '../ui/index.js';
import { lazyWithReload } from '../../utils/lazyWithReload.js';

const ReactPlayer = lazyWithReload(() => import('react-player'));

const formatRuntime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total === 0) return '—';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
};

function VideoStage({ lesson, course }) {
  if (!lesson.videoUrl) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-bg-subtle">
        <div className="flex h-full items-center justify-center p-6 text-center">
          <EmptyState
            icon="VideoOff"
            title="No video yet"
            description="Upload a video or paste a YouTube / Vimeo URL to preview it here."
            size="sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label="Loading player…" />
          </div>
        }
      >
        <ReactPlayer
          src={lesson.videoUrl}
          controls
          width="100%"
          height="100%"
          poster={course?.thumbnail?.url ?? course?.thumbnail}
          style={{ position: 'absolute', inset: 0 }}
        />
      </Suspense>
    </div>
  );
}

function TextStage({ lesson }) {
  if (!lesson.content?.trim()) {
    return (
      <div className="rounded-xl border border-border bg-bg-subtle p-8">
        <EmptyState
          icon="FileText"
          title="No content yet"
          description="Open the editor to write the lesson body."
          size="sm"
        />
      </div>
    );
  }
  return (
    <article className="rounded-xl border border-border bg-bg-subtle p-6 sm:p-10">
      <div className="mx-auto max-w-2xl whitespace-pre-wrap wrap-break-word text-base leading-relaxed text-text">
        {lesson.content}
      </div>
    </article>
  );
}

function PreviewHeader({ lesson, sectionTitle, onEdit, onManageQuiz }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {sectionTitle ?? 'Lesson'} · {lesson.type === 'video' ? 'Video lesson' : 'Reading'} · {formatRuntime(lesson.duration)}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {lesson.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {lesson.isFreePreview && (
            <Badge variant="info" size="sm">
              Free preview
            </Badge>
          )}
          {lesson.hasQuiz && (
            <Badge variant="success" size="sm">
              Has quiz
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          leftIcon={<Icon name="Pencil" size={14} />}
        >
          Edit lesson
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onManageQuiz}
          leftIcon={<Icon name="ListChecks" size={14} />}
        >
          {lesson.hasQuiz ? 'Edit quiz' : 'Add quiz'}
        </Button>
      </div>
    </header>
  );
}

export function LessonPreview({
  lesson,
  course,
  sectionTitle,
  loading = false,
  onEdit,
  onManageQuiz,
}) {
  if (loading) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-xl border border-border bg-bg">
        <Spinner label="Loading lesson…" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-xl border border-dashed border-border-strong bg-bg-subtle p-10">
        <EmptyState
          icon="MousePointerClick"
          title="Pick a lesson to preview"
          description="Click any lesson in the curriculum to see exactly what enrolled learners will experience."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PreviewHeader
        lesson={lesson}
        sectionTitle={sectionTitle}
        onEdit={() => onEdit(lesson)}
        onManageQuiz={() => onManageQuiz(lesson)}
      />
      {lesson.type === 'video' ? (
        <VideoStage lesson={lesson} course={course} />
      ) : (
        <TextStage lesson={lesson} />
      )}
    </div>
  );
}

export default LessonPreview;
