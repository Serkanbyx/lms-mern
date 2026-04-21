/**
 * Admin moderation queue — `/admin/pending`
 *
 * A focused, FIFO review surface that mirrors the way real moderation teams
 * actually work: one course per wide card, the most important metadata
 * up-front (thumbnail, title, instructor, lesson count + duration,
 * submission date, description preview), and the two actions a reviewer
 * needs (Approve / Reject) inline on each card.
 *
 * Behaviour:
 *  - **Approve**  → single click. The card animates out via state removal,
 *                   a toast confirms, and the queue advances. We deliberately
 *                   avoid a confirm modal here — approval is non-destructive
 *                   and reviewers should hit a steady cadence.
 *  - **Reject**   → opens a modal with the same `Textarea` (10–500 chars,
 *                   counter, validation) used on the broader courses page so
 *                   the instructor receives consistent feedback formatting.
 *
 * Data:
 *  - One round-trip to `admin.getPendingCourses({ limit: 50 })`. The backend
 *    sorts oldest-first so the queue itself is the FIFO order — no sorting
 *    on the client. Pagination kicks in if more than the page limit are
 *    waiting; for v1 we cap at 50 since a sane backlog never exceeds it,
 *    and a pagination toolbar appears underneath if the cap is exceeded.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  Modal,
  Pagination,
  Skeleton,
  Textarea,
  toast,
} from '../../components/ui/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  approveCourse,
  getPendingCourses,
  rejectCourse,
} from '../../services/admin.service.js';
import { ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { formatRelativeTime } from '../../utils/formatDate.js';
import { cn } from '../../utils/cn.js';

const PAGE_LIMIT = 20;
const REJECTION_MIN = 10;
const REJECTION_MAX = 500;

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function PendingCard({ course, busy, onApprove, onReject }) {
  const url =
    typeof course?.thumbnail === 'string'
      ? course.thumbnail
      : course?.thumbnail?.url;
  const lessonCount = course.totalLessons ?? 0;
  const durationLabel = formatDuration(course.totalDuration ?? 0);

  return (
    <article
      className={cn(
        'rounded-2xl border border-border bg-bg shadow-xs transition-opacity',
        busy && 'opacity-60 pointer-events-none',
      )}
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[16rem_1fr_auto]">
        {/* Thumbnail ----------------------------------------------------- */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-bg-muted ring-1 ring-border lg:w-64">
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
              <Icon name="BookOpen" size={28} />
            </div>
          )}
        </div>

        {/* Body --------------------------------------------------------- */}
        <div className="min-w-0 flex flex-col gap-2">
          <div>
            {course.slug ? (
              <Link
                to={ROUTES.courseDetail(course.slug)}
                className="text-lg font-semibold text-text hover:text-primary line-clamp-2"
              >
                {course.title ?? 'Untitled course'}
              </Link>
            ) : (
              <h3 className="text-lg font-semibold text-text line-clamp-2">
                {course.title ?? 'Untitled course'}
              </h3>
            )}
            <p className="text-xs text-text-subtle mt-0.5">
              Submitted {formatRelativeTime(course.updatedAt ?? course.createdAt)}
            </p>
          </div>

          {/* Instructor row */}
          {course.instructor && (
            <div className="flex items-center gap-2">
              <Avatar
                size="sm"
                src={course.instructor.avatar}
                name={course.instructor.name}
              />
              <div className="min-w-0">
                <p className="text-sm text-text truncate">
                  {course.instructor.name ?? 'Unknown instructor'}
                </p>
                {course.instructor.email && (
                  <p className="text-xs text-text-muted truncate">
                    {course.instructor.email}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description preview */}
          {course.shortDescription && (
            <p className="text-sm text-text-muted line-clamp-3">
              {course.shortDescription}
            </p>
          )}

          {/* Meta chips */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="neutral" leftIcon={<Icon name="ListChecks" size={12} />}>
              {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
            </Badge>
            <Badge variant="neutral" leftIcon={<Icon name="Clock" size={12} />}>
              {durationLabel}
            </Badge>
            {course.category && (
              <Badge variant="neutral" leftIcon={<Icon name="Tag" size={12} />}>
                {course.category}
              </Badge>
            )}
            {course.level && (
              <Badge variant="neutral" leftIcon={<Icon name="BarChart2" size={12} />}>
                {course.level}
              </Badge>
            )}
            {course.price > 0 ? (
              <Badge variant="primary" leftIcon={<Icon name="DollarSign" size={12} />}>
                {`$${Number(course.price).toFixed(0)}`}
              </Badge>
            ) : (
              <Badge variant="success">Free</Badge>
            )}
          </div>
        </div>

        {/* Actions ------------------------------------------------------ */}
        <div className="flex flex-row lg:flex-col gap-2 lg:justify-center">
          <Button
            onClick={() => onApprove(course)}
            disabled={busy}
            leftIcon={<Icon name="CheckCircle2" size={16} />}
            className="flex-1 lg:flex-none"
          >
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => onReject(course)}
            disabled={busy}
            leftIcon={<Icon name="XCircle" size={16} />}
            className="flex-1 lg:flex-none"
          >
            Reject…
          </Button>
          {course.slug && (
            <Link
              to={ROUTES.courseDetail(course.slug)}
              className="text-center text-xs text-text-muted hover:text-primary py-2"
            >
              View as student →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function PendingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-5 grid gap-5 lg:grid-cols-[16rem_1fr_auto]">
      <Skeleton className="aspect-video w-full lg:w-64 rounded-xl" />
      <div className="space-y-3">
        <Skeleton variant="text" className="h-5 w-3/5" />
        <Skeleton variant="text" className="h-3 w-1/3" />
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="text" className="h-3 w-4/5" />
      </div>
      <div className="flex flex-row lg:flex-col gap-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

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
      description="The instructor sees this exact text in their dashboard. Be specific so they can address it before resubmitting."
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

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function PendingReviewPage() {
  useDocumentTitle('Pending review · Admin');

  const [courses, setCourses] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [rejectState, setRejectState] = useState({
    open: false,
    course: null,
    loading: false,
  });

  const fetchPending = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getPendingCourses({ page, limit: PAGE_LIMIT });
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
          'Could not load the review queue.',
      );
    }
  }, [page]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const removeCourse = useCallback((id) => {
    setCourses((prev) => prev.filter((c) => c._id !== id));
    setPageInfo((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
  }, []);

  const handleApprove = useCallback(
    async (course) => {
      if (!course?._id || busyId) return;
      setBusyId(course._id);
      try {
        await approveCourse(course._id);
        toast.success(`Approved "${course.title}".`);
        removeCourse(course._id);
      } catch (err) {
        toast.error(
          err?.response?.data?.message ?? 'Could not approve course.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, removeCourse],
  );

  const handleReject = useCallback(
    async (reason) => {
      const course = rejectState.course;
      if (!course) return;
      setRejectState((prev) => ({ ...prev, loading: true }));
      try {
        await rejectCourse(course._id, reason);
        toast.success(`Rejected "${course.title}".`);
        removeCourse(course._id);
        setRejectState({ open: false, course: null, loading: false });
      } catch (err) {
        toast.error(
          err?.response?.data?.message ?? 'Could not reject course.',
        );
        setRejectState((prev) => ({ ...prev, loading: false }));
      }
    },
    [rejectState.course, removeCourse],
  );

  /* -------------------------------- render -------------------------------- */

  const isInitialLoading = status === 'loading' && courses.length === 0;
  const totalPending = pageInfo.total;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            Pending review
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {status === 'loading'
              ? 'Loading queue…'
              : totalPending === 0
                ? 'Inbox zero — beautiful.'
                : `${totalPending} ${totalPending === 1 ? 'course' : 'courses'} awaiting your decision`}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={fetchPending}
          leftIcon={<Icon name="RefreshCcw" size={16} />}
          disabled={status === 'loading'}
        >
          Refresh
        </Button>
      </header>

      {status === 'error' ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">We couldn&apos;t load the queue.</p>
              <p className="mt-1 text-text-muted">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPending}
              leftIcon={<Icon name="RefreshCcw" size={14} />}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : isInitialLoading ? (
        <div className="space-y-4">
          <PendingCardSkeleton />
          <PendingCardSkeleton />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-bg-subtle">
          <EmptyState
            size="lg"
            icon="CheckCircle2"
            title="All clear — no courses awaiting review."
            description="When instructors submit new submissions they'll line up here in the order they were received."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <PendingCard
              key={course._id}
              course={course}
              busy={busyId === course._id}
              onApprove={handleApprove}
              onReject={(c) =>
                setRejectState({ open: true, course: c, loading: false })
              }
            />
          ))}
        </div>
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
    </div>
  );
}
