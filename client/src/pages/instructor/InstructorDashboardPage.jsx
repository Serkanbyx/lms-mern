/**
 * Instructor dashboard — `/instructor`
 *
 * The author's home base. Composed of three vertical zones:
 *
 *   1. Header strip      → page title + sticky "+ New Course" CTA so the
 *                          most common action is always one click away.
 *   2. Stats grid        → four `Stat` tiles summarising the catalog at
 *                          a glance (counts, students, revenue, rating).
 *   3. My Courses table  → status-filterable list with row actions and
 *                          inline `Banner` for rejected submissions.
 *
 * Data strategy
 * -------------
 * - One round-trip to `/api/courses/mine?limit=100` powers everything on
 *   the page. The endpoint already returns the full course doc (including
 *   `enrollmentCount`, `totalLessons`, `averageRating`, `rejectionReason`)
 *   so each row + stat is render-ready without follow-up calls.
 * - Status filter chips are computed client-side off the same array so
 *   switching tabs is instant — no extra network hop, no re-fetch flicker.
 * - Mutations (submit / archive / delete) hit their dedicated endpoints
 *   and either patch the row in place (status flip) or splice it out
 *   (delete) so the table stays consistent without a full refetch.
 *
 * Empty / loading
 * ---------------
 * - Hard empty (no courses at all): hero `EmptyState` with a primary CTA
 *   to `/instructor/courses/new` so a brand-new instructor has a single,
 *   obvious next move.
 * - Filtered-empty (e.g. "Rejected" chip with zero hits): inline empty
 *   panel inside the table so the chrome + chips stay anchored.
 * - Loading: skeleton stats + skeleton table rows so the layout never
 *   shifts when data resolves (CLS discipline).
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  ConfirmModal,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  Skeleton,
  Stat,
  StatusBadge,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  archiveCourse,
  deleteCourse,
  getMyCourses,
  submitForReview,
} from '../../services/course.service.js';
import { ROUTES } from '../../utils/constants.js';
import { COURSE_STATUS } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';

const FETCH_LIMIT = 100;

const STATUS_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: COURSE_STATUS.draft, label: 'Draft' },
  { id: COURSE_STATUS.pending, label: 'Pending' },
  { id: COURSE_STATUS.published, label: 'Published' },
  { id: COURSE_STATUS.rejected, label: 'Rejected' },
  { id: COURSE_STATUS.archived, label: 'Archived' },
]);

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
};

const firstNameOf = (fullName) => {
  if (!fullName) return 'there';
  return String(fullName).trim().split(/\s+/)[0] || 'there';
};

const isSubmittable = (status) =>
  status === COURSE_STATUS.draft || status === COURSE_STATUS.rejected;

const isArchivable = (status) =>
  status === COURSE_STATUS.draft ||
  status === COURSE_STATUS.published ||
  status === COURSE_STATUS.rejected;

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function CourseThumbnail({ course }) {
  const url =
    typeof course?.thumbnail === 'string'
      ? course.thumbnail
      : course?.thumbnail?.url;
  return (
    <div
      className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-bg-muted
        ring-1 ring-border"
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-linear-to-br
            from-primary/30 via-info/15 to-bg-muted text-primary/70"
        >
          <Icon name="GraduationCap" size={20} />
        </div>
      )}
    </div>
  );
}

function StatusFilterChips({ value, counts, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Filter courses by status"
      className="flex flex-wrap items-center gap-2"
    >
      {STATUS_FILTERS.map((filter) => {
        const active = value === filter.id;
        const count = counts[filter.id] ?? 0;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
              'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-primary',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-bg text-text-muted hover:border-border-strong hover:text-text',
            )}
          >
            <span>{filter.label}</span>
            <span
              className={cn(
                'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs',
                'tabular-nums',
                active ? 'bg-primary/15 text-primary' : 'bg-bg-muted text-text-subtle',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CoursesTable({
  courses,
  onSubmit,
  onArchive,
  onDelete,
  pendingId,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg-subtle">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Course
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Lessons
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Students
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap"
            >
              Updated
            </th>
            <th scope="col" className="px-4 py-3 pr-5 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {courses.map((course) => {
            const id = course._id ?? course.id;
            const isRejected = course.status === COURSE_STATUS.rejected;
            const isPending = pendingId === id;
            return (
              <Fragment key={id}>
                <tr
                  className={cn(
                    'transition-colors hover:bg-bg-subtle',
                    isPending && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <CourseThumbnail course={course} />
                      <div className="min-w-0">
                        <Link
                          to={ROUTES.instructorCourseEdit(id)}
                          className="block truncate font-medium text-text hover:text-primary max-w-[28ch]"
                        >
                          {course.title ?? 'Untitled course'}
                        </Link>
                        <p className="text-xs text-text-muted truncate max-w-[28ch]">
                          {course.category ?? '—'}
                          {course.level ? ` · ${course.level}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                    {course.totalLessons ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                    {compactFormatter.format(course.enrollmentCount ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    {formatDate(course.updatedAt ?? course.createdAt)}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <div className="flex items-center justify-end">
                      <Dropdown
                        align="end"
                        trigger={
                          <IconButton
                            variant="ghost"
                            aria-label={`Actions for ${course.title ?? 'course'}`}
                          >
                            <Icon name="MoreHorizontal" size={16} />
                          </IconButton>
                        }
                        items={[
                          {
                            id: 'edit',
                            label: 'Edit details',
                            icon: 'Pencil',
                            onSelect: () => {
                              window.location.assign(
                                ROUTES.instructorCourseEdit(id),
                              );
                            },
                          },
                          {
                            id: 'curriculum',
                            label: 'Curriculum',
                            icon: 'ListTree',
                            onSelect: () => {
                              window.location.assign(
                                ROUTES.instructorCurriculum(id),
                              );
                            },
                          },
                          {
                            id: 'submit',
                            label: 'Submit for review',
                            icon: 'Send',
                            disabled: !isSubmittable(course.status),
                            onSelect: () => onSubmit(course),
                          },
                          {
                            id: 'archive',
                            label: 'Archive',
                            icon: 'Archive',
                            disabled: !isArchivable(course.status),
                            onSelect: () => onArchive(course),
                          },
                          { id: 'sep', separator: true },
                          {
                            id: 'delete',
                            label: 'Delete',
                            icon: 'Trash2',
                            danger: true,
                            onSelect: () => onDelete(course),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
                {isRejected && (
                  <tr className="bg-danger/5">
                    <td colSpan={6} className="px-4 pb-4 pl-5 pr-5">
                      <Banner
                        variant="danger"
                        action={
                          <Link to={ROUTES.instructorCourseEdit(id)}>
                            <Button
                              size="sm"
                              variant="outline"
                              rightIcon={<Icon name="ArrowRight" size={14} />}
                            >
                              Edit & resubmit
                            </Button>
                          </Link>
                        }
                        className="rounded-lg border"
                      >
                        <span className="font-medium">
                          Submission rejected.
                        </span>{' '}
                        <span className="text-text-muted">
                          {course.rejectionReason ||
                            'No reason was provided. Address the feedback and resubmit when ready.'}
                        </span>
                      </Banner>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoursesTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton variant="text" className="h-5 w-40" />
        <Skeleton className="h-8 w-60 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 py-2">
            <Skeleton className="h-12 w-20 rounded-md" />
            <Skeleton variant="text" className="flex-1" />
            <Skeleton variant="text" className="w-20" />
            <Skeleton variant="text" className="w-12" />
            <Skeleton variant="text" className="w-12" />
            <Skeleton variant="text" className="w-20" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-border bg-bg-subtle p-5 shadow-xs"
        >
          <Skeleton variant="text" className="h-3 w-24" />
          <Skeleton variant="text" className="h-8 w-20" />
          <Skeleton variant="text" className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function InstructorDashboardPage() {
  useDocumentTitle('Instructor Dashboard');

  const { user } = useAuth();
  const firstName = firstNameOf(user?.name);

  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingId, setPendingId] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false,
    kind: null,
    course: null,
    loading: false,
  });

  const fetchCourses = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const payload = await getMyCourses({ limit: FETCH_LIMIT });
      const items = payload?.data?.items ?? payload?.items ?? [];
      setCourses(items);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load your courses.',
      );
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  /* ----------------------------- derived sets ----------------------------- */

  const counts = useMemo(() => {
    const result = {
      all: courses.length,
      [COURSE_STATUS.draft]: 0,
      [COURSE_STATUS.pending]: 0,
      [COURSE_STATUS.published]: 0,
      [COURSE_STATUS.rejected]: 0,
      [COURSE_STATUS.archived]: 0,
    };
    for (const course of courses) {
      if (course.status in result) {
        result[course.status] += 1;
      }
    }
    return result;
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const base =
      statusFilter === 'all'
        ? courses
        : courses.filter((course) => course.status === statusFilter);
    return [...base].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
  }, [courses, statusFilter]);

  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const totalStudents = courses.reduce(
      (sum, course) => sum + (course.enrollmentCount ?? 0),
      0,
    );
    const totalRevenue = courses.reduce(
      (sum, course) =>
        sum + (course.price ?? 0) * (course.enrollmentCount ?? 0),
      0,
    );
    const ratedCourses = courses.filter(
      (course) => (course.averageRating ?? 0) > 0,
    );
    const avgRating =
      ratedCourses.length === 0
        ? 0
        : ratedCourses.reduce(
            (sum, course) => sum + (course.averageRating ?? 0),
            0,
          ) / ratedCourses.length;
    const publishedCount = counts[COURSE_STATUS.published] ?? 0;
    const publishRate =
      totalCourses === 0 ? 0 : Math.round((publishedCount / totalCourses) * 100);
    return {
      totalCourses,
      totalStudents,
      totalRevenue,
      avgRating,
      publishedCount,
      publishRate,
    };
  }, [courses, counts]);

  /* --------------------------------- actions ------------------------------ */

  const updateRow = useCallback((id, patch) => {
    setCourses((prev) =>
      prev.map((course) =>
        (course._id ?? course.id) === id ? { ...course, ...patch } : course,
      ),
    );
  }, []);

  const removeRow = useCallback((id) => {
    setCourses((prev) =>
      prev.filter((course) => (course._id ?? course.id) !== id),
    );
  }, []);

  const handleSubmit = useCallback(
    async (course) => {
      const id = course._id ?? course.id;
      if (!id) return;
      setPendingId(id);
      try {
        const result = await submitForReview(id);
        const next = result?.data ?? { status: COURSE_STATUS.pending };
        updateRow(id, next);
        toast.success(`"${course.title}" submitted for review.`);
      } catch (err) {
        toast.error(
          err?.response?.data?.message ??
            'Could not submit course. Please try again.',
        );
      } finally {
        setPendingId(null);
      }
    },
    [updateRow],
  );

  const openConfirm = useCallback((kind, course) => {
    setConfirmState({ open: true, kind, course, loading: false });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => (prev.loading ? prev : { ...prev, open: false }));
  }, []);

  const handleConfirm = useCallback(async () => {
    const { kind, course } = confirmState;
    const id = course?._id ?? course?.id;
    if (!id || !kind) return;

    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      if (kind === 'archive') {
        const result = await archiveCourse(id);
        const next = result?.data ?? { status: COURSE_STATUS.archived };
        updateRow(id, next);
        toast.success(`"${course.title}" archived.`);
      } else if (kind === 'delete') {
        await deleteCourse(id);
        removeRow(id);
        toast.success(`"${course.title}" deleted.`);
      }
      setConfirmState({ open: false, kind: null, course: null, loading: false });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ??
          `Could not ${kind} course. Please try again.`,
      );
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  }, [confirmState, removeRow, updateRow]);

  /* --------------------------------- render ------------------------------- */

  const isInitialLoading = status === 'loading';
  const hasNoCourses = status === 'ready' && courses.length === 0;
  const hasError = status === 'error';

  const confirmCopy = useMemo(() => {
    if (!confirmState.course) return { title: '', description: '' };
    const title = confirmState.course.title ?? 'this course';
    if (confirmState.kind === 'archive') {
      return {
        title: `Archive "${title}"?`,
        description:
          'Archived courses are hidden from the public catalog and cannot accept new enrollments. You can restore them later from the archived filter.',
        confirmLabel: 'Archive course',
        danger: false,
      };
    }
    return {
      title: `Delete "${title}"?`,
      description:
        'This permanently removes the course, all sections, lessons, and quizzes. Existing student enrollments will be detached. This action cannot be undone.',
      confirmLabel: 'Delete course',
      danger: true,
    };
  }, [confirmState]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-10">
      <Seo title="Instructor Dashboard" noIndex />

      {/* Header strip ------------------------------------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar size="lg" src={user?.avatar} name={user?.name} />
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
              Hello, {firstName}
            </h1>
            <p className="mt-1 max-w-xl text-text-muted">
              Manage your catalog, track student growth, and ship your next
              course.
            </p>
          </div>
        </div>
        <Link to={ROUTES.instructorCourseCreate}>
          <Button size="lg" leftIcon={<Icon name="Plus" size={16} />}>
            New Course
          </Button>
        </Link>
      </header>

      {hasError && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">We couldn&apos;t load your courses.</p>
              <p className="mt-1 text-text-muted">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCourses}
              leftIcon={<Icon name="RefreshCcw" size={14} />}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Stats grid --------------------------------------------------------- */}
      {isInitialLoading ? (
        <StatsGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total courses"
            value={stats.totalCourses}
            icon={<Icon name="BookOpen" size={16} />}
            hint={
              stats.publishedCount > 0
                ? `${stats.publishedCount} published`
                : 'Nothing published yet'
            }
          />
          <Stat
            label="Total students"
            value={compactFormatter.format(stats.totalStudents)}
            icon={<Icon name="Users" size={16} />}
            hint={
              stats.totalCourses === 0
                ? 'Publish a course to enroll students'
                : 'Across all courses'
            }
          />
          <Stat
            label="Total revenue"
            value={currencyFormatter.format(stats.totalRevenue)}
            icon={<Icon name="DollarSign" size={16} />}
            hint="Lifetime gross from paid enrollments"
          />
          <Stat
            label="Avg rating"
            value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            icon={<Icon name="Star" size={16} />}
            hint={
              stats.avgRating > 0
                ? `${stats.publishRate}% of catalog published`
                : 'No ratings yet'
            }
          />
        </div>
      )}

      {/* My Courses --------------------------------------------------------- */}
      {hasNoCourses ? (
        <section className="rounded-3xl border border-dashed border-border bg-bg-subtle">
          <EmptyState
            size="lg"
            icon="GraduationCap"
            title="Create your first course to start teaching"
            description="Outline your curriculum, upload lessons, and publish to the Lumen catalog when you're ready."
            action={
              <Link to={ROUTES.instructorCourseCreate}>
                <Button leftIcon={<Icon name="Plus" size={16} />}>
                  Create course
                </Button>
              </Link>
            }
          />
        </section>
      ) : (
        <section
          aria-labelledby="my-courses-heading"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="my-courses-heading"
                className="text-xl font-semibold text-text"
              >
                My courses
              </h2>
              <p className="text-sm text-text-muted">
                {filteredCourses.length} of {courses.length} course
                {courses.length === 1 ? '' : 's'} shown
              </p>
            </div>
            <StatusFilterChips
              value={statusFilter}
              counts={counts}
              onChange={setStatusFilter}
            />
          </div>

          {isInitialLoading ? (
            <CoursesTableSkeleton />
          ) : (
            <div className="rounded-2xl border border-border bg-bg shadow-xs">
              {filteredCourses.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon="SearchX"
                  title="No courses match this filter"
                  description="Try a different status filter or create a new course."
                  action={
                    <Link to={ROUTES.instructorCourseCreate}>
                      <Button
                        size="sm"
                        leftIcon={<Icon name="Plus" size={14} />}
                      >
                        New course
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <CoursesTable
                  courses={filteredCourses}
                  onSubmit={handleSubmit}
                  onArchive={(course) => openConfirm('archive', course)}
                  onDelete={(course) => openConfirm('delete', course)}
                  pendingId={pendingId}
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* Tip footer — quick badge legend so the chips above are decoded ----- */}
      {!hasNoCourses && !isInitialLoading && (
        <footer className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
          <span>Status legend:</span>
          {STATUS_FILTERS.filter((filter) => filter.id !== 'all').map(
            (filter) => (
              <Badge key={filter.id} variant="neutral" size="sm">
                {filter.label}
              </Badge>
            ),
          )}
        </footer>
      )}

      <ConfirmModal
        open={confirmState.open}
        loading={confirmState.loading}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        danger={confirmCopy.danger}
      />
    </div>
  );
}
