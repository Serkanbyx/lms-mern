/**
 * Student lesson player — `/courses/:slug/learn/:lessonId?`.
 *
 * Distraction-free reader/player surface composed by `LearnLayout` (dark,
 * minimal chrome). The page owns:
 *
 *   - The full curriculum tree (left rail), powered by the same
 *     enrollment-gated `getCurriculum` endpoint the marketing page uses
 *     so we never duplicate gating logic on the client.
 *   - The active lesson canvas (video or text) in the center column.
 *   - Course-level progress (`getCourseProgress`) for the percentage
 *     strip at the top, the curriculum drawer's checkmarks, and the
 *     completion confetti when the user crosses 100%.
 *
 * Resume behaviour:
 *   When the URL omits `:lessonId` we resolve it locally — preferring the
 *   `lastAccessedLesson` from the progress payload, then falling back to
 *   the first lesson — and replace the URL so refresh / share lands on
 *   the same lesson. `progress.setLastAccessed(lessonId)` is also fired
 *   on every lesson switch so the dashboard's "Continue learning" tile
 *   stays current.
 *
 * Keyboard:
 *   - `Space` → play/pause (delegated to the underlying `<video>`).
 *   - `←` / `→` → previous / next lesson.
 *   - `c` → toggle complete on the current lesson.
 *   - `?` → opens the shortcut KBD modal.
 *   Editable elements (inputs / textareas / contenteditable) are
 *   excluded so typing in the future review/notes box never hijacks the
 *   shortcut keys.
 *
 * Auto-advance:
 *   When `preferences.playback.autoplayNext === true` and the active
 *   video lesson reaches the end, an inline 5-second countdown overlays
 *   the player. The user can cancel; otherwise we navigate to the next
 *   lesson automatically. The timer is cleared on unmount, lesson
 *   switch, manual cancel, or when the user disables the preference.
 *
 * Security:
 *   `EnrolledRoute` blocks unauthenticated/unenrolled access AND the
 *   server projects `videoUrl` / `content` only when the requester is
 *   an enrolled learner (or owner/admin). The client cannot bypass
 *   enrollment by hand-crafting URLs.
 */

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { PlayerCurriculumDrawer } from '../../components/lesson/PlayerCurriculumDrawer.jsx';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  KBD,
  Modal,
  ProgressBar,
  Spinner,
  toast,
} from '../../components/ui/index.js';
import { usePreferences } from '../../context/PreferencesContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as courseService from '../../services/course.service.js';
import * as progressService from '../../services/progress.service.js';
import { ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { cn } from '../../utils/cn.js';

const ReactPlayer = lazy(() => import('react-player'));

const AUTO_ADVANCE_SECONDS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const flattenLessons = (sections = []) =>
  sections.flatMap((section) => section.lessons ?? []);

const findLessonById = (sections, lessonId) => {
  if (!lessonId) return null;
  for (const section of sections) {
    for (const lesson of section.lessons ?? []) {
      if (String(lesson._id) === String(lessonId)) return lesson;
    }
  }
  return null;
};

const isEditableTarget = (target) => {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LessonPlayerPage() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const { preferences } = usePreferences();

  const [data, setData] = useState({
    status: 'loading',
    course: null,
    sections: [],
    progress: null,
    error: null,
  });
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(null);
  const [confettiKey, setConfettiKey] = useState(null);
  const [markPending, setMarkPending] = useState(false);

  const playerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const previousPercentRef = useRef(0);

  // -------------------------------------------------------------------------
  // Data fetching: course + curriculum + progress in parallel.
  // -------------------------------------------------------------------------

  const loadAll = useCallback(async () => {
    if (!slug) return;
    setData((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const [courseResp, curriculumResp] = await Promise.all([
        courseService.getCourseBySlug(slug),
        courseService.getCurriculum(slug),
      ]);
      const course = courseResp?.course ?? courseResp?.data ?? courseResp;
      const sections =
        curriculumResp?.data?.sections ?? curriculumResp?.sections ?? [];

      let progress = null;
      try {
        const progressResp = await progressService.getCourseProgress(
          course._id,
        );
        progress = progressResp?.data ?? progressResp ?? null;
      } catch {
        progress = null;
      }

      setData({ status: 'ready', course, sections, progress, error: null });
    } catch (error) {
      setData({
        status: 'error',
        course: null,
        sections: [],
        progress: null,
        error: error?.message ?? 'Could not load this course.',
      });
    }
  }, [slug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // -------------------------------------------------------------------------
  // Derived values: lesson list, navigation pointers, completion set.
  // -------------------------------------------------------------------------

  const allLessons = useMemo(
    () => flattenLessons(data.sections),
    [data.sections],
  );

  const completedSet = useMemo(
    () => new Set((data.progress?.completedLessons ?? []).map(String)),
    [data.progress],
  );

  const resumeLessonId = useMemo(() => {
    const last = data.progress?.lastAccessedLesson;
    if (last && findLessonById(data.sections, last)) return String(last);
    return allLessons[0]?._id ? String(allLessons[0]._id) : null;
  }, [allLessons, data.progress, data.sections]);

  const currentLesson = useMemo(
    () => findLessonById(data.sections, lessonId),
    [data.sections, lessonId],
  );

  const currentIndex = useMemo(() => {
    if (!currentLesson) return -1;
    return allLessons.findIndex(
      (lesson) => String(lesson._id) === String(currentLesson._id),
    );
  }, [allLessons, currentLesson]);

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  const isCurrentCompleted = currentLesson
    ? completedSet.has(String(currentLesson._id))
    : false;

  useDocumentTitle(currentLesson?.title ?? data.course?.title ?? 'Learning');

  // -------------------------------------------------------------------------
  // URL: resume from lastAccessedLesson when `:lessonId` is omitted.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (data.status !== 'ready') return;
    if (lessonId) return;
    if (!resumeLessonId || !data.course?.slug) return;
    navigate(ROUTES.lesson(data.course.slug, resumeLessonId), {
      replace: true,
    });
  }, [data.status, data.course, lessonId, resumeLessonId, navigate]);

  // -------------------------------------------------------------------------
  // Side-effect: stamp lastAccessed on the server every lesson switch.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!currentLesson?._id) return;
    progressService.setLastAccessed(currentLesson._id).catch(() => {
      /* non-blocking — pointer staleness is harmless */
    });
  }, [currentLesson?._id]);

  // -------------------------------------------------------------------------
  // Confetti when crossing the 100% threshold for the first time.
  // -------------------------------------------------------------------------

  useEffect(() => {
    const percent = Number(data.progress?.progressPercent ?? 0);
    if (percent >= 100 && previousPercentRef.current < 100) {
      setConfettiKey(Date.now());
    }
    previousPercentRef.current = percent;
  }, [data.progress?.progressPercent]);

  // -------------------------------------------------------------------------
  // Auto-advance countdown lifecycle.
  // -------------------------------------------------------------------------

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceCountdown(null);
  }, []);

  const goToLesson = useCallback(
    (lesson) => {
      if (!lesson || !data.course?.slug) return;
      cancelAutoAdvance();
      navigate(ROUTES.lesson(data.course.slug, lesson._id));
    },
    [cancelAutoAdvance, data.course, navigate],
  );

  // Always cancel on unmount or lesson change to avoid stale countdowns.
  useEffect(() => () => cancelAutoAdvance(), [cancelAutoAdvance]);
  useEffect(() => cancelAutoAdvance, [lessonId, cancelAutoAdvance]);

  const startAutoAdvance = useCallback(() => {
    if (!nextLesson) return;
    if (autoAdvanceTimerRef.current) return;

    setAutoAdvanceCountdown(AUTO_ADVANCE_SECONDS);
    autoAdvanceTimerRef.current = setInterval(() => {
      setAutoAdvanceCountdown((value) => {
        if (value === null) return null;
        if (value <= 1) {
          clearInterval(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = null;
          // Defer navigation out of the setState callback.
          setTimeout(() => goToLesson(nextLesson), 0);
          return null;
        }
        return value - 1;
      });
    }, 1000);
  }, [goToLesson, nextLesson]);

  // -------------------------------------------------------------------------
  // Mark complete / incomplete.
  // -------------------------------------------------------------------------

  const handleToggleComplete = useCallback(async () => {
    if (!currentLesson?._id || markPending) return;
    setMarkPending(true);
    try {
      const fn = isCurrentCompleted
        ? progressService.markIncomplete
        : progressService.markComplete;
      const resp = await fn(currentLesson._id);
      const nextProgress = resp?.data ?? resp;
      setData((prev) => ({ ...prev, progress: nextProgress ?? prev.progress }));
      if (!isCurrentCompleted) {
        toast.success('Lesson marked complete');
      }
    } catch (error) {
      toast.error(error?.message ?? 'Could not update progress.');
    } finally {
      setMarkPending(false);
    }
  }, [currentLesson?._id, isCurrentCompleted, markPending]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts.
  // -------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === 'Escape' && shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (event.key === 'ArrowRight' && nextLesson) {
        event.preventDefault();
        goToLesson(nextLesson);
        return;
      }
      if (event.key === 'ArrowLeft' && prevLesson) {
        event.preventDefault();
        goToLesson(prevLesson);
        return;
      }
      if (event.key.toLowerCase() === 'c' && currentLesson) {
        event.preventDefault();
        handleToggleComplete();
        return;
      }
      if (event.key === ' ' && currentLesson?.type === 'video') {
        // Forward space to the underlying <video>; only intervene if the
        // player isn't already focused so we don't double-toggle.
        const videoEl = playerRef.current?.querySelector?.('video');
        if (videoEl && document.activeElement !== videoEl) {
          event.preventDefault();
          if (videoEl.paused) videoEl.play();
          else videoEl.pause();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentLesson,
    goToLesson,
    handleToggleComplete,
    nextLesson,
    prevLesson,
    shortcutsOpen,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (data.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading lesson…" />
      </div>
    );
  }

  if (data.status === 'error' || !data.course) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon="AlertTriangle"
          title="We couldn't load this lesson"
          description={data.error ?? 'Please try again in a moment.'}
          action={
            <Button onClick={loadAll}>
              <Icon name="RefreshCw" size={16} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (allLessons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon="BookOpen"
          title="This course has no lessons yet"
          description="The instructor hasn't published any lessons for this course."
          action={
            <Link to={ROUTES.courseDetail(slug)}>
              <Button variant="outline">Back to course</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Resume redirect is in flight — render nothing to avoid a UI flash.
  if (!lessonId) return null;

  // The URL pointed at a lesson id that doesn't exist in this curriculum
  // (deleted, or belongs to a different course). Send the user back to
  // the course detail page so they can pick a real lesson.
  if (!currentLesson) {
    return <Navigate to={ROUTES.courseDetail(slug)} replace />;
  }

  const progressPercent = Math.round(
    Number(data.progress?.progressPercent ?? 0),
  );

  return (
    <div className="flex h-full flex-col">
      <HeaderPortal
        course={data.course}
        progressPercent={progressPercent}
        completedCount={completedSet.size}
        totalLessons={data.progress?.totalLessons ?? allLessons.length}
      />

      <div className="flex flex-1 min-h-0">
        <PlayerCurriculumDrawer
          sections={data.sections}
          currentLessonId={currentLesson._id}
          completedLessonIds={[...completedSet]}
          collapsed={drawerCollapsed}
          onToggleCollapsed={setDrawerCollapsed}
          onSelectLesson={goToLesson}
        />

        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
            {currentLesson.type === 'video' ? (
              <VideoCanvas
                lesson={currentLesson}
                course={data.course}
                playerRef={playerRef}
                defaultSpeed={preferences.playback?.defaultSpeed ?? 1}
                onEnded={() => {
                  if (preferences.playback?.autoplayNext && nextLesson) {
                    startAutoAdvance();
                  }
                }}
                autoAdvanceCountdown={autoAdvanceCountdown}
                onCancelAutoAdvance={cancelAutoAdvance}
              />
            ) : (
              <TextCanvas lesson={currentLesson} />
            )}

            <LessonHeader lesson={currentLesson} />

            <LessonActionRow
              lesson={currentLesson}
              isCompleted={isCurrentCompleted}
              isPending={markPending}
              onToggleComplete={handleToggleComplete}
              onPrev={prevLesson ? () => goToLesson(prevLesson) : null}
              onNext={nextLesson ? () => goToLesson(nextLesson) : null}
              prevLesson={prevLesson}
              nextLesson={nextLesson}
              courseSlug={data.course.slug}
              onShowShortcuts={() => setShortcutsOpen(true)}
            />
          </div>
        </div>
      </div>

      {confettiKey && (
        <ConfettiBurst key={confettiKey} onDone={() => setConfettiKey(null)} />
      )}

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header portal — injects course title + progress into the LearnLayout slot.
// ---------------------------------------------------------------------------

function HeaderPortal({ course, progressPercent, completedCount, totalLessons }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setTarget(document.getElementById('lesson-title-slot'));
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="flex w-full items-center gap-4 whitespace-normal overflow-visible text-left">
      <Link
        to={ROUTES.courseDetail(course.slug)}
        className="min-w-0 truncate text-sm font-medium text-text hover:underline"
      >
        {course.title}
      </Link>
      <div className="hidden flex-1 items-center gap-3 sm:flex">
        <ProgressBar
          value={progressPercent}
          size="sm"
          className="flex-1"
          aria-label="Course progress"
        />
        <span className="shrink-0 tabular-nums text-xs text-text-muted">
          {progressPercent}% · {completedCount}/{totalLessons}
        </span>
      </div>
    </div>,
    target,
  );
}

// ---------------------------------------------------------------------------
// Video canvas — lazy ReactPlayer + auto-advance overlay.
// ---------------------------------------------------------------------------

function VideoCanvas({
  lesson,
  course,
  playerRef,
  defaultSpeed,
  onEnded,
  autoAdvanceCountdown,
  onCancelAutoAdvance,
}) {
  if (!lesson.videoUrl) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-bg-subtle">
        <div className="flex h-full items-center justify-center p-8 text-center">
          <EmptyState
            icon="VideoOff"
            title="Video unavailable"
            description="The instructor hasn't uploaded this lesson's video yet."
            size="sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg"
    >
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
          poster={course.thumbnail}
          playbackRate={defaultSpeed}
          onEnded={onEnded}
          style={{ position: 'absolute', inset: 0 }}
        />
      </Suspense>

      {autoAdvanceCountdown !== null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border-strong bg-bg/90 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <Icon name="SkipForward" size={14} className="text-primary" />
            <span className="text-text">
              Next lesson in{' '}
              <strong className="tabular-nums">{autoAdvanceCountdown}s</strong>
            </span>
            <button
              type="button"
              onClick={onCancelAutoAdvance}
              className="text-xs font-medium text-text-muted hover:text-text underline-offset-4 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text canvas — safe text rendering (never `dangerouslySetInnerHTML`).
// ---------------------------------------------------------------------------

function TextCanvas({ lesson }) {
  if (!lesson.content) {
    return (
      <div className="rounded-xl border border-border bg-bg-subtle p-8">
        <EmptyState
          icon="FileText"
          title="No content yet"
          description="The instructor hasn't written this lesson yet."
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

// ---------------------------------------------------------------------------
// Lesson header (title + meta) and action row (mark complete / quiz / nav).
// ---------------------------------------------------------------------------

function LessonHeader({ lesson }) {
  return (
    <header>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {lesson.type === 'video' ? 'Video lesson' : 'Reading'} ·{' '}
        {formatDuration(lesson.duration)}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
        {lesson.title}
      </h1>
    </header>
  );
}

function LessonActionRow({
  lesson,
  isCompleted,
  isPending,
  onToggleComplete,
  onPrev,
  onNext,
  prevLesson,
  nextLesson,
  courseSlug,
  onShowShortcuts,
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onToggleComplete}
          loading={isPending}
          variant={isCompleted ? 'secondary' : 'primary'}
          leftIcon={
            <Icon name={isCompleted ? 'CheckCircle2' : 'Circle'} size={16} />
          }
          className={cn(isCompleted && 'text-success')}
        >
          {isCompleted ? 'Completed' : 'Mark as complete'}
        </Button>

        {lesson.hasQuiz && lesson.quizId && (
          <Link to={ROUTES.quiz(courseSlug, lesson.quizId)}>
            <Button variant="outline" leftIcon={<Icon name="ListChecks" size={16} />}>
              Take quiz
            </Button>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          <IconButton
            aria-label="Show keyboard shortcuts"
            onClick={onShowShortcuts}
            variant="ghost"
            className="h-9 w-9"
          >
            <KBD>?</KBD>
          </IconButton>
        </div>
      </div>

      <nav
        aria-label="Lesson navigation"
        className="grid gap-3 sm:grid-cols-2"
      >
        <NavCard
          direction="prev"
          lesson={prevLesson}
          onClick={onPrev}
        />
        <NavCard
          direction="next"
          lesson={nextLesson}
          onClick={onNext}
        />
      </nav>
    </div>
  );
}

function NavCard({ direction, lesson, onClick }) {
  const isPrev = direction === 'prev';
  const label = isPrev ? 'Previous lesson' : 'Next lesson';

  if (!lesson) {
    return (
      <div
        aria-disabled="true"
        className={cn(
          'rounded-xl border border-dashed border-border p-4 text-sm text-text-subtle',
          isPrev ? 'text-left' : 'text-right',
        )}
      >
        {isPrev ? "You're at the start" : "You've reached the end"}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl border border-border bg-bg-subtle p-4 text-sm transition-colors hover:border-primary hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        isPrev ? 'text-left' : 'text-right',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted',
          !isPrev && 'justify-end',
        )}
      >
        {isPrev && <Icon name="ChevronLeft" size={12} />}
        {label}
        {!isPrev && <Icon name="ChevronRight" size={12} />}
      </span>
      <span className="line-clamp-1 font-medium text-text">{lesson.title}</span>
      <span className="text-xs text-text-subtle">
        {formatDuration(lesson.duration)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts modal.
// ---------------------------------------------------------------------------

function ShortcutsModal({ open, onClose }) {
  const items = [
    { keys: ['Space'], label: 'Play / pause video' },
    { keys: ['→'], label: 'Next lesson' },
    { keys: ['←'], label: 'Previous lesson' },
    { keys: ['C'], label: 'Toggle complete' },
    { keys: ['?'], label: 'Show this dialog' },
    { keys: ['Esc'], label: 'Close dialogs' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Stay in the flow without reaching for the mouse."
      size="sm"
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <span className="text-sm text-text">{item.label}</span>
            <span className="flex items-center gap-1">
              {item.keys.map((key) => (
                <KBD key={key}>{key}</KBD>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// One-shot CSS confetti. Pure CSS keyframes (declared in `index.css`),
// generates ~28 colored chips that fall from above the viewport.
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-danger)',
];

function ConfettiBurst({ onDone }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        x: `${Math.round((Math.random() - 0.5) * 200)}px`,
        rot: `${Math.round(360 + Math.random() * 720)}deg`,
        delay: `${Math.random() * 0.4}s`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  useEffect(() => {
    const id = setTimeout(() => onDone?.(), 3000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-120 overflow-hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block animate-confetti rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.5,
            background: piece.color,
            animationDelay: piece.delay,
            '--confetti-x': piece.x,
            '--confetti-rot': piece.rot,
          }}
        />
      ))}
    </div>
  );
}
