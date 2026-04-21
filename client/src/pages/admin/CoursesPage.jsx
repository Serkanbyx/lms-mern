/**
 * Admin course directory — `/admin/courses`
 *
 * Layout:
 *   1. Toolbar     → search by title (debounced) + sort + status chip filters
 *                    (All / Pending / Published / Rejected / Draft / Archived
 *                    with counts).
 *   2. Table       → thumbnail + title · instructor · status · students ·
 *                    updated · row actions (View · Approve · Reject · Force
 *                    archive · Force delete).
 *   3. Pagination  → footer with windowed page numbers.
 *
 * Row actions:
 *   - **Approve**          → single click + toast (only on `pending`).
 *   - **Reject**           → opens a modal with a `Textarea` (10–500 chars,
 *                             char counter) so the instructor gets actionable
 *                             feedback (only on `pending`).
 *   - **Force archive**    → admin override of the instructor archive flow;
 *                             non-destructive, still keeps enrollments alive.
 *   - **Force delete**     → cascade-warning modal with checklist + an
 *                             explicit "I understand" toggle so a misclick
 *                             can't wipe a course's lessons, quizzes,
 *                             attempts, and enrollments.
 *
 * Counts strategy:
 *   - The pending/draft/etc counts in the chip row need to reflect the
 *     entire catalog, not just the current page. We fetch them once via a
 *     parallel `getStats()` call so the chips show the same numbers as the
 *     dashboard tiles.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Button,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  Toggle,
  toast,
} from '../../components/ui/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  approveCourse,
  archiveCourseAdmin,
  forceDeleteCourse,
  getStats,
  listCoursesAdmin,
  rejectCourse,
} from '../../services/admin.service.js';
import { COURSE_STATUS, ROUTES } from '../../utils/constants.js';
import { formatDate } from '../../utils/formatDate.js';
import { cn } from '../../utils/cn.js';

const PAGE_LIMIT = 20;
const REJECTION_MIN = 10;
const REJECTION_MAX = 500;

const STATUS_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: COURSE_STATUS.pending, label: 'Pending' },
  { id: COURSE_STATUS.published, label: 'Published' },
  { id: COURSE_STATUS.rejected, label: 'Rejected' },
  { id: COURSE_STATUS.draft, label: 'Draft' },
  { id: COURSE_STATUS.archived, label: 'Archived' },
]);

const SORT_OPTIONS = Object.freeze([
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title (A → Z)' },
  { value: 'enrollments', label: 'Most enrollments' },
  { value: 'price', label: 'Price (low → high)' },
]);

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function CourseThumbnail({ course }) {
  const url =
    typeof course?.thumbnail === 'string'
      ? course.thumbnail
      : course?.thumbnail?.url;
  return (
    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-bg-muted ring-1 ring-border">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary/70">
          <Icon name="BookOpen" size={18} />
        </div>
      )}
    </div>
  );
}

function StatusFilterChips({ value, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((filter) => {
        const active = value === filter.id;
        const count = counts[filter.id];
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
              'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-bg text-text-muted hover:border-border-strong hover:text-text',
            )}
          >
            <span>{filter.label}</span>
            {typeof count === 'number' && (
              <span
                className={cn(
                  'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-primary/15 text-primary' : 'bg-bg-muted text-text-subtle',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CoursesTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-12 w-20 rounded-md" />
          <Skeleton variant="text" className="flex-1" />
          <Skeleton variant="text" className="w-24" />
          <Skeleton variant="text" className="w-20" />
          <Skeleton variant="text" className="w-12" />
          <Skeleton variant="text" className="w-16" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function CoursesTable({
  courses,
  pendingId,
  onApprove,
  onReject,
  onArchive,
  onDelete,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
              Course
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
              Instructor
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle">
              Students
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap">
              Updated
            </th>
            <th className="px-4 py-3 pr-5 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {courses.map((course) => {
            const id = course._id;
            const isPending = course.status === COURSE_STATUS.pending;
            const isApproving = pendingId === id;

            const items = [
              {
                id: 'view',
                label: 'View detail',
                icon: 'ExternalLink',
                onSelect: () => {
                  if (course.slug) {
                    window.location.assign(ROUTES.courseDetail(course.slug));
                  }
                },
              },
              {
                id: 'approve',
                label: 'Approve',
                icon: 'CheckCircle2',
                disabled: !isPending,
                onSelect: () => onApprove(course),
              },
              {
                id: 'reject',
                label: 'Reject…',
                icon: 'XCircle',
                disabled: !isPending,
                onSelect: () => onReject(course),
              },
              {
                id: 'archive',
                label: 'Force archive',
                icon: 'Archive',
                disabled: course.status === COURSE_STATUS.archived,
                onSelect: () => onArchive(course),
              },
              { id: 'sep', separator: true },
              {
                id: 'delete',
                label: 'Force delete…',
                icon: 'Trash2',
                danger: true,
                onSelect: () => onDelete(course),
              },
            ];

            return (
              <tr
                key={id}
                className={cn(
                  'transition-colors hover:bg-bg-subtle',
                  isApproving && 'opacity-60',
                )}
              >
                <td className="px-4 py-3 pl-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <CourseThumbnail course={course} />
                    <div className="min-w-0">
                      {course.slug ? (
                        <Link
                          to={ROUTES.courseDetail(course.slug)}
                          className="block truncate font-medium text-text hover:text-primary max-w-[32ch]"
                        >
                          {course.title ?? 'Untitled course'}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium text-text max-w-[32ch]">
                          {course.title ?? 'Untitled course'}
                        </span>
                      )}
                      <p className="text-xs text-text-muted truncate max-w-[32ch]">
                        {course.category ?? '—'}
                        {course.level ? ` · ${course.level}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {course.instructor ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        size="sm"
                        src={course.instructor.avatar}
                        name={course.instructor.name}
                      />
                      <span className="truncate text-text-muted max-w-[18ch]">
                        {course.instructor.name ?? '—'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={course.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-muted">
                  {compact.format(course.enrollmentCount ?? 0)}
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
                      items={items}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modals                                                                    */
/* -------------------------------------------------------------------------- */

function RejectModal({ open, course, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REJECTION_MIN;
  const valid = trimmed.length >= REJECTION_MIN && trimmed.length <= REJECTION_MAX;

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={course ? `Reject "${course.title}"?` : 'Reject submission?'}
      description="Share what needs to change so the instructor can address the feedback before resubmitting."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(trimmed)}
            loading={loading}
            disabled={!valid}
          >
            Reject submission
          </Button>
        </>
      }
    >
      <Textarea
        autosize
        rows={4}
        maxRows={10}
        maxLength={REJECTION_MAX}
        showCounter
        placeholder={`At least ${REJECTION_MIN} characters of actionable feedback…`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={tooShort}
      />
      {tooShort && (
        <p className="mt-2 text-xs text-danger">
          A rejection reason needs at least {REJECTION_MIN} characters.
        </p>
      )}
    </Modal>
  );
}

function ForceDeleteModal({ open, course, onClose, onConfirm, loading }) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={course ? `Force delete "${course.title}"?` : 'Force delete course?'}
      description="This cascade is irreversible. Make sure you've reviewed what will be wiped."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            disabled={!confirmed}
          >
            Force delete
          </Button>
        </>
      }
    >
      <ul className="space-y-2 text-sm text-text">
        {[
          'All sections and lessons',
          'All quizzes attached to this course',
          'Every quiz attempt students have submitted',
          'Every enrollment, including paid ones',
          'The course document itself',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon name="Trash2" size={14} className="mt-1 text-danger" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        Consider <strong>force archive</strong> instead — students keep
        access and the course just leaves the catalog.
      </div>
      <div className="mt-4">
        <Toggle
          checked={confirmed}
          onChange={setConfirmed}
          label="I understand this cannot be undone"
        />
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function CoursesPage() {
  useDocumentTitle('Courses · Admin');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [courses, setCourses] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  // Catalog-wide counts for the chip row (independent of the current page).
  const [counts, setCounts] = useState({});

  const [rejectState, setRejectState] = useState({
    open: false,
    course: null,
    loading: false,
  });
  const [deleteState, setDeleteState] = useState({
    open: false,
    course: null,
    loading: false,
  });
  const [archiveState, setArchiveState] = useState({
    open: false,
    course: null,
    loading: false,
  });

  const fetchCourses = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await listCoursesAdmin({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort,
        page,
        limit: PAGE_LIMIT,
      });
      const payload = result?.data ?? {};
      setCourses(payload.items ?? []);
      setPageInfo({
        page: payload.page ?? 1,
        limit: payload.limit ?? PAGE_LIMIT,
        total: payload.total ?? 0,
        totalPages: payload.totalPages ?? 1,
      });
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load courses.',
      );
    }
  }, [debouncedSearch, statusFilter, sort, page]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sort]);

  // Catalog-wide chip counts (refreshed on mount + after any approval /
  // reject / archive / delete since those flip status buckets).
  const refreshCounts = useCallback(async () => {
    try {
      const result = await getStats();
      const breakdown = result?.data?.courses ?? {};
      setCounts({
        all: breakdown.total ?? 0,
        [COURSE_STATUS.pending]: breakdown.pending ?? 0,
        [COURSE_STATUS.published]: breakdown.published ?? 0,
        [COURSE_STATUS.rejected]: breakdown.rejected ?? 0,
        [COURSE_STATUS.draft]: breakdown.draft ?? 0,
        [COURSE_STATUS.archived]: breakdown.archived ?? 0,
      });
    } catch {
      // Counts are decorative — silently ignore failures so a flaky stats
      // call doesn't block the directory.
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  /* --------------------------- patch helpers ------------------------------ */

  const patchCourse = useCallback((id, patch) => {
    setCourses((prev) =>
      prev.map((c) => (c._id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const removeCourse = useCallback((id) => {
    setCourses((prev) => prev.filter((c) => c._id !== id));
    setPageInfo((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
  }, []);

  /* ------------------------------ actions --------------------------------- */

  const handleApprove = useCallback(
    async (course) => {
      if (!course?._id || pendingId) return;
      setPendingId(course._id);
      try {
        await approveCourse(course._id);
        patchCourse(course._id, { status: COURSE_STATUS.published });
        toast.success(`Approved "${course.title}".`);
        refreshCounts();
      } catch (err) {
        toast.error(
          err?.response?.data?.message ?? 'Could not approve course.',
        );
      } finally {
        setPendingId(null);
      }
    },
    [patchCourse, pendingId, refreshCounts],
  );

  const handleReject = useCallback(
    async (reason) => {
      const course = rejectState.course;
      if (!course) return;
      setRejectState((prev) => ({ ...prev, loading: true }));
      try {
        await rejectCourse(course._id, reason);
        patchCourse(course._id, {
          status: COURSE_STATUS.rejected,
          rejectionReason: reason,
        });
        toast.success(`Rejected "${course.title}".`);
        refreshCounts();
        setRejectState({ open: false, course: null, loading: false });
      } catch (err) {
        toast.error(
          err?.response?.data?.message ?? 'Could not reject course.',
        );
        setRejectState((prev) => ({ ...prev, loading: false }));
      }
    },
    [patchCourse, refreshCounts, rejectState.course],
  );

  const handleArchive = useCallback(async () => {
    const course = archiveState.course;
    if (!course) return;
    setArchiveState((prev) => ({ ...prev, loading: true }));
    try {
      await archiveCourseAdmin(course._id);
      patchCourse(course._id, { status: COURSE_STATUS.archived });
      toast.success(`Archived "${course.title}".`);
      refreshCounts();
      setArchiveState({ open: false, course: null, loading: false });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not archive course.',
      );
      setArchiveState((prev) => ({ ...prev, loading: false }));
    }
  }, [archiveState.course, patchCourse, refreshCounts]);

  const handleDelete = useCallback(async () => {
    const course = deleteState.course;
    if (!course) return;
    setDeleteState((prev) => ({ ...prev, loading: true }));
    try {
      await forceDeleteCourse(course._id);
      removeCourse(course._id);
      toast.success(`Deleted "${course.title}".`);
      refreshCounts();
      setDeleteState({ open: false, course: null, loading: false });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not delete course.',
      );
      setDeleteState((prev) => ({ ...prev, loading: false }));
    }
  }, [deleteState.course, refreshCounts, removeCourse]);

  /* --------------------------------- render -------------------------------- */

  const isInitialLoading = status === 'loading' && courses.length === 0;
  const totalLabel = useMemo(() => {
    if (status === 'loading') return 'Loading catalog…';
    return `${pageInfo.total} ${pageInfo.total === 1 ? 'course' : 'courses'} total`;
  }, [pageInfo.total, status]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            Courses
          </h1>
          <p className="mt-1 text-sm text-text-muted">{totalLabel}</p>
        </div>
        <Link to={ROUTES.adminPending}>
          <Button
            variant="outline"
            leftIcon={<Icon name="ClipboardCheck" size={16} />}
          >
            Open review queue
          </Button>
        </Link>
      </header>

      {/* Toolbar ------------------------------------------------------------ */}
      <div className="rounded-2xl border border-border bg-bg-subtle p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Icon name="Search" size={16} />}
              trailingIcon={
                search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="text-text-subtle hover:text-text"
                  >
                    <Icon name="X" size={14} />
                  </button>
                ) : null
              }
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort courses"
            className="w-48"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <StatusFilterChips
          value={statusFilter}
          counts={counts}
          onChange={setStatusFilter}
        />
      </div>

      {/* Table -------------------------------------------------------------- */}
      {status === 'error' ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">We couldn&apos;t load the catalog.</p>
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
      ) : isInitialLoading ? (
        <CoursesTableSkeleton />
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg shadow-xs">
          <EmptyState
            icon="SearchX"
            title="No courses match these filters"
            description="Try clearing the search or switching the status filter."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <CoursesTable
          courses={courses}
          pendingId={pendingId}
          onApprove={handleApprove}
          onReject={(course) =>
            setRejectState({ open: true, course, loading: false })
          }
          onArchive={(course) =>
            setArchiveState({ open: true, course, loading: false })
          }
          onDelete={(course) =>
            setDeleteState({ open: true, course, loading: false })
          }
        />
      )}

      {pageInfo.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Page {pageInfo.page} of {pageInfo.totalPages}
          </p>
          <Pagination
            page={pageInfo.page}
            pageCount={pageInfo.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <RejectModal
        open={rejectState.open}
        course={rejectState.course}
        loading={rejectState.loading}
        onClose={() =>
          rejectState.loading
            ? null
            : setRejectState({ open: false, course: null, loading: false })
        }
        onConfirm={handleReject}
      />

      <ForceDeleteModal
        open={deleteState.open}
        course={deleteState.course}
        loading={deleteState.loading}
        onClose={() =>
          deleteState.loading
            ? null
            : setDeleteState({ open: false, course: null, loading: false })
        }
        onConfirm={handleDelete}
      />

      <Modal
        open={archiveState.open}
        onClose={
          archiveState.loading
            ? () => {}
            : () =>
                setArchiveState({ open: false, course: null, loading: false })
        }
        title={
          archiveState.course
            ? `Archive "${archiveState.course.title}"?`
            : 'Archive course?'
        }
        description="Archived courses leave the public catalog. Students keep access to lessons they were enrolled in."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                setArchiveState({ open: false, course: null, loading: false })
              }
              disabled={archiveState.loading}
            >
              Cancel
            </Button>
            <Button onClick={handleArchive} loading={archiveState.loading}>
              Archive course
            </Button>
          </>
        }
      />
    </div>
  );
}
