/**
 * Instructor — `/instructor/courses/:id/curriculum`
 *
 * Two-column desktop authoring surface:
 *   - Left  (sticky) → `CurriculumTree`. Sections + lessons with
 *     drag-and-drop and arrow-key reordering, plus row-level actions
 *     (rename, delete, manage quiz).
 *   - Right (preview) → `LessonPreview`. Mirrors the student lesson
 *     player so the instructor can sanity-check their work without
 *     leaving the builder.
 *
 * Data flow
 * ---------
 * The page is the single owner of the section/lesson tree:
 *   1. On mount we fetch the course (via the owner-scoped
 *      `/courses/mine` endpoint, same trick as `CourseEditPage`) and
 *      then the curriculum (`/courses/:slug/curriculum`).
 *   2. Mutations (create / rename / delete / reorder) optimistically
 *      update local state and persist through the section / lesson
 *      services. A failure surfaces a toast and rolls back to the last
 *      server snapshot.
 *   3. Reorder writes are debounced 800 ms after the last drag / arrow
 *      press so a quick run of moves only fires one network call.
 *
 * Lesson edit modal
 * -----------------
 * The curriculum endpoint hides authoring-only fields (`videoPublicId`).
 * Before opening `LessonModal` in edit mode, the page fetches the full
 * lesson document via `getLesson(id)` so the dropzone has the publicId
 * needed to clean up the prior Cloudinary asset on replace.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import {
  Alert,
  Button,
  ConfirmModal,
  Icon,
  Skeleton,
  StatusBadge,
  toast,
} from '../../components/ui/index.js';
import {
  CurriculumTree,
  LessonModal,
  LessonPreview,
  SectionModal,
} from '../../components/instructor/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  getCurriculum,
  getMyCourses,
} from '../../services/course.service.js';
import {
  createLesson,
  createSection,
  deleteLesson,
  deleteSection,
  getLesson,
  reorderLessons,
  reorderSections,
  updateLesson,
  updateSection,
} from '../../services/lesson.service.js';
import { ROUTES } from '../../utils/constants.js';

const FETCH_LIMIT = 100;
const REORDER_DEBOUNCE_MS = 800;

const formatRuntime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total === 0) return '0m';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

/* -------------------------------------------------------------------------- */
/*  Reorder debouncer                                                         */
/* -------------------------------------------------------------------------- */

const useReorderQueue = ({ rollback }) => {
  // Each scope (sections root + each section's lesson list) gets its own
  // pending timer so a section move does not cancel a lesson move.
  const timers = useRef(new Map());

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const schedule = useCallback(
    (key, run) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(async () => {
        timers.current.delete(key);
        try {
          await run();
        } catch (err) {
          const message =
            err?.response?.data?.message ??
            err?.message ??
            'Could not save the new order.';
          toast.error(message);
          rollback?.();
        }
      }, REORDER_DEBOUNCE_MS);
      timers.current.set(key, timer);
    },
    [rollback],
  );

  return schedule;
};

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function CurriculumBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const [activeLessonId, setActiveLessonId] = useState(null);
  const [lessonDetail, setLessonDetail] = useState(null);
  const [lessonDetailLoading, setLessonDetailLoading] = useState(false);

  // Modal coordination — `null` means closed.
  const [sectionModal, setSectionModal] = useState(null); // { mode, section? }
  const [lessonModal, setLessonModal] = useState(null); // { mode, sectionId, lesson? }
  const [confirmAction, setConfirmAction] = useState(null); // { kind, target }
  const [confirmLoading, setConfirmLoading] = useState(false);

  const lastServerSnapshot = useRef([]);

  useDocumentTitle(
    course?.title ? `Curriculum · ${course.title}` : 'Curriculum builder',
  );

  /* --------------------------- fetch + bootstrap -------------------------- */

  const loadCurriculum = useCallback(async (slug, lessonIdToKeep) => {
    const payload = await getCurriculum(slug);
    const fresh = payload?.data?.sections ?? [];
    setSections(fresh);
    lastServerSnapshot.current = fresh;
    if (lessonIdToKeep) {
      const stillExists = fresh.some((section) =>
        (section.lessons ?? []).some(
          (lesson) => String(lesson._id) === String(lessonIdToKeep),
        ),
      );
      if (!stillExists) setActiveLessonId(null);
    }
    return fresh;
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const list = await getMyCourses({ limit: FETCH_LIMIT });
      const items = list?.data?.items ?? list?.items ?? [];
      const found = items.find((entry) => (entry._id ?? entry.id) === id);
      if (!found) {
        setStatus('not-found');
        return;
      }
      setCourse(found);
      await loadCurriculum(found.slug);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load the curriculum.',
      );
    }
  }, [id, loadCurriculum]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* --------------------------- selection / preview ----------------------- */

  // Auto-select the first lesson once the curriculum lands so the preview
  // pane is never empty for a course that already has content.
  useEffect(() => {
    if (activeLessonId) return;
    if (sections.length === 0) return;
    const firstLesson = sections.find(
      (section) => (section.lessons ?? []).length > 0,
    )?.lessons?.[0];
    if (firstLesson) setActiveLessonId(firstLesson._id);
  }, [sections, activeLessonId]);

  // Pull the full lesson document (incl. `videoPublicId`) when the
  // selection changes so the preview + edit modal share the same source.
  useEffect(() => {
    if (!activeLessonId) {
      setLessonDetail(null);
      return;
    }
    let cancelled = false;
    setLessonDetailLoading(true);
    getLesson(activeLessonId)
      .then((payload) => {
        if (cancelled) return;
        setLessonDetail(payload?.lesson ?? payload?.data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setLessonDetail(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLessonDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLessonId]);

  const activeSection = useMemo(
    () =>
      sections.find((section) =>
        (section.lessons ?? []).some(
          (lesson) => String(lesson._id) === String(activeLessonId),
        ),
      ) ?? null,
    [sections, activeLessonId],
  );

  /* --------------------------- reorder helpers --------------------------- */

  const rollback = useCallback(() => {
    setSections(lastServerSnapshot.current);
  }, []);
  const scheduleReorder = useReorderQueue({ rollback });

  const handleReorderSections = useCallback(
    (orderedIds) => {
      // Optimistic local update first so the tree feels instant.
      setSections((prev) => {
        const indexById = new Map(prev.map((section) => [section._id, section]));
        const next = orderedIds
          .map((sectionId, index) => {
            const section = indexById.get(sectionId);
            if (!section) return null;
            return { ...section, order: index };
          })
          .filter(Boolean);
        return next;
      });
      scheduleReorder('sections', async () => {
        if (!course?._id) return;
        await reorderSections(course._id, orderedIds);
      });
    },
    [course?._id, scheduleReorder],
  );

  const handleReorderLessons = useCallback(
    (sectionId, orderedIds) => {
      setSections((prev) =>
        prev.map((section) => {
          if (section._id !== sectionId) return section;
          const indexByLessonId = new Map(
            (section.lessons ?? []).map((lesson) => [lesson._id, lesson]),
          );
          const reordered = orderedIds
            .map((lessonId, index) => {
              const lesson = indexByLessonId.get(lessonId);
              if (!lesson) return null;
              return { ...lesson, order: index };
            })
            .filter(Boolean);
          return { ...section, lessons: reordered };
        }),
      );
      scheduleReorder(`lessons:${sectionId}`, async () => {
        await reorderLessons(sectionId, orderedIds);
      });
    },
    [scheduleReorder],
  );

  /* --------------------------- section CRUD ------------------------------ */

  const handleSectionSubmit = async (title) => {
    if (!course?._id) return;
    if (sectionModal?.mode === 'edit' && sectionModal.section) {
      const result = await updateSection(sectionModal.section._id, { title });
      const updated = result?.section ?? null;
      setSections((prev) =>
        prev.map((section) =>
          section._id === sectionModal.section._id
            ? { ...section, title: updated?.title ?? title }
            : section,
        ),
      );
      toast.success('Section renamed.');
    } else {
      const result = await createSection(course._id, { title });
      const created = result?.section ?? null;
      if (created) {
        setSections((prev) => [...prev, { ...created, lessons: [] }]);
        toast.success('Section added.');
      }
    }
    await loadCurriculum(course.slug, activeLessonId);
    setSectionModal(null);
  };

  const handleDeleteSection = async (section) => {
    setConfirmLoading(true);
    try {
      await deleteSection(section._id);
      toast.success('Section deleted.');
      const removedActiveLesson = (section.lessons ?? []).some(
        (lesson) => String(lesson._id) === String(activeLessonId),
      );
      if (removedActiveLesson) setActiveLessonId(null);
      await loadCurriculum(course.slug, activeLessonId);
      setConfirmAction(null);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not delete section.',
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  /* --------------------------- lesson CRUD ------------------------------- */

  const openCreateLesson = (section) => {
    setLessonModal({ mode: 'create', sectionId: section._id, lesson: null });
  };

  const openEditLesson = async (lesson) => {
    // Hydrate full lesson detail so the dropzone has `videoPublicId`.
    try {
      const payload = await getLesson(lesson._id);
      const full = payload?.lesson ?? payload?.data ?? lesson;
      setLessonModal({
        mode: 'edit',
        sectionId: lesson.sectionId,
        lesson: full,
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not load lesson details.',
      );
    }
  };

  const handleLessonSubmit = async (payload) => {
    if (!lessonModal) return;
    if (lessonModal.mode === 'edit' && lessonModal.lesson) {
      await updateLesson(lessonModal.lesson._id, payload);
      toast.success('Lesson saved.');
    } else {
      const created = await createLesson(lessonModal.sectionId, payload);
      const lesson = created?.lesson ?? null;
      if (lesson?._id) setActiveLessonId(lesson._id);
      toast.success('Lesson added.');
    }
    await loadCurriculum(course.slug, activeLessonId);
    if (activeLessonId) {
      try {
        const fresh = await getLesson(activeLessonId);
        setLessonDetail(fresh?.lesson ?? fresh?.data ?? null);
      } catch {
        // Non-fatal — preview will refresh on next selection.
      }
    }
    setLessonModal(null);
  };

  const handleDeleteLesson = async (lesson) => {
    setConfirmLoading(true);
    try {
      await deleteLesson(lesson._id);
      toast.success('Lesson deleted.');
      if (String(activeLessonId) === String(lesson._id)) {
        setActiveLessonId(null);
      }
      await loadCurriculum(course.slug, null);
      setConfirmAction(null);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not delete lesson.',
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  /* --------------------------- confirm dispatcher ------------------------ */

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.kind === 'delete-section') {
      await handleDeleteSection(confirmAction.target);
    } else if (confirmAction.kind === 'delete-lesson') {
      await handleDeleteLesson(confirmAction.target);
    }
  };

  /* --------------------------- derived stats ----------------------------- */

  const stats = useMemo(() => {
    const totalSections = sections.length;
    const totalLessons = sections.reduce(
      (sum, section) => sum + (section.lessons?.length ?? 0),
      0,
    );
    const totalSeconds = sections.reduce(
      (sum, section) =>
        sum +
        (section.lessons ?? []).reduce(
          (lessonSum, lesson) => lessonSum + (Number(lesson.duration) || 0),
          0,
        ),
      0,
    );
    return { totalSections, totalLessons, totalSeconds };
  }, [sections]);

  /* --------------------------- render states ----------------------------- */

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-6">
        <Skeleton variant="text" className="h-4 w-40" />
        <Skeleton variant="text" className="h-9 w-3/4 max-w-xl" />
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center space-y-4">
        <Icon name="SearchX" size={40} className="mx-auto text-text-muted" />
        <h1 className="text-2xl font-semibold text-text">Course not found</h1>
        <p className="text-text-muted">
          This course either doesn&apos;t exist or it isn&apos;t in your catalog.
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
        <Alert variant="danger" title="We couldn't load the curriculum">
          {error}
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-10">
      <Seo
        title={
          course?.title ? `Curriculum · ${course.title}` : 'Curriculum builder'
        }
        noIndex
      />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            to={ROUTES.instructorCourseEdit(id)}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <Icon name="ArrowLeft" size={14} />
            Back to course settings
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text truncate">
              {course?.title ?? 'Curriculum'}
            </h1>
            {course?.status && <StatusBadge status={course.status} />}
          </div>
          <p className="text-sm text-text-muted">
            {stats.totalSections}{' '}
            {stats.totalSections === 1 ? 'section' : 'sections'} ·{' '}
            {stats.totalLessons}{' '}
            {stats.totalLessons === 1 ? 'lesson' : 'lessons'} ·{' '}
            {formatRuntime(stats.totalSeconds)} of content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to={ROUTES.instructorCourseEdit(id)}>
            <Button
              variant="ghost"
              leftIcon={<Icon name="Settings" size={14} />}
            >
              Course details
            </Button>
          </Link>
          {course?.slug && (
            <Link to={ROUTES.courseDetail(course.slug)} target="_blank">
              <Button
                variant="secondary"
                rightIcon={<Icon name="ExternalLink" size={14} />}
              >
                Preview public page
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Sticky tree ---------------------------------------------------- */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="rounded-xl border border-border bg-bg p-3 shadow-xs lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            <CurriculumTree
              sections={sections}
              activeLessonId={activeLessonId}
              onSelectLesson={(lesson) => setActiveLessonId(lesson._id)}
              onAddSection={() => setSectionModal({ mode: 'create' })}
              onEditSection={(section) =>
                setSectionModal({ mode: 'edit', section })
              }
              onDeleteSection={(section) =>
                setConfirmAction({ kind: 'delete-section', target: section })
              }
              onAddLesson={openCreateLesson}
              onEditLesson={openEditLesson}
              onDeleteLesson={(lesson) =>
                setConfirmAction({ kind: 'delete-lesson', target: lesson })
              }
              onManageQuiz={(lesson) =>
                navigate(ROUTES.instructorQuizBuilder(lesson._id))
              }
              onReorderSections={handleReorderSections}
              onReorderLessons={handleReorderLessons}
            />
          </div>
        </aside>

        {/* Right preview ------------------------------------------------ */}
        <main className="min-w-0">
          <LessonPreview
            lesson={lessonDetail}
            course={course}
            sectionTitle={activeSection?.title}
            loading={lessonDetailLoading && !lessonDetail}
            onEdit={(lesson) => openEditLesson(lesson)}
            onManageQuiz={(lesson) =>
              navigate(ROUTES.instructorQuizBuilder(lesson._id))
            }
          />
        </main>
      </div>

      {/* Section modal ---------------------------------------------------- */}
      <SectionModal
        open={sectionModal !== null}
        mode={sectionModal?.mode ?? 'create'}
        initialTitle={sectionModal?.section?.title ?? ''}
        onClose={() => setSectionModal(null)}
        onSubmit={handleSectionSubmit}
      />

      {/* Lesson modal ----------------------------------------------------- */}
      <LessonModal
        open={lessonModal !== null}
        mode={lessonModal?.mode ?? 'create'}
        lesson={lessonModal?.lesson ?? null}
        onClose={() => setLessonModal(null)}
        onSubmit={handleLessonSubmit}
      />

      {/* Destructive confirm --------------------------------------------- */}
      <ConfirmModal
        open={confirmAction !== null}
        loading={confirmLoading}
        onClose={() => (confirmLoading ? null : setConfirmAction(null))}
        onConfirm={handleConfirm}
        title={
          confirmAction?.kind === 'delete-section'
            ? `Delete "${confirmAction.target?.title ?? 'this section'}"?`
            : `Delete "${confirmAction?.target?.title ?? 'this lesson'}"?`
        }
        description={
          confirmAction?.kind === 'delete-section'
            ? 'Every lesson and quiz inside this section will be permanently removed. This cannot be undone.'
            : 'The lesson and any attached quiz will be permanently removed. This cannot be undone.'
        }
        confirmLabel={
          confirmAction?.kind === 'delete-section'
            ? 'Delete section'
            : 'Delete lesson'
        }
        danger
      />
    </div>
  );
}
