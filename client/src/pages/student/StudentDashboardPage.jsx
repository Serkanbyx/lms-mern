/**
 * Student dashboard — `/dashboard`
 *
 * The learner's home base. Composed of four content sections that map
 * 1:1 onto the learning journey:
 *
 *   1. Welcome strip      → orient the user + surface 3 quick stats.
 *   2. Continue learning  → the "what should I do next?" affordance, a
 *                           horizontally scrollable rail of in-progress
 *                           enrollments sorted by most-recent activity.
 *   3. Recommended        → trending courses (`sort=popular`) the
 *                           learner is NOT already enrolled in. Pure
 *                           discovery — no analytics-driven personalisation
 *                           in v1.
 *   4. Completed          → finished courses with the certificate
 *                           download CTA. Hidden when no completions
 *                           exist so the page stays compact for new users.
 *   5. All enrollments    → searchable / sortable table that doubles as
 *                           the long-tail navigation (manage / unenroll
 *                           via the row action menu).
 *
 * Data strategy
 * -------------
 * - One round-trip to `/api/enrollments/mine?status=all&limit=50` covers
 *   sections 2, 4 and 5. Server already populates `courseId` (with the
 *   instructor sub-doc), so each row is render-ready.
 * - A second, parallel call to `/api/courses?sort=popular&limit=8`
 *   feeds the "Recommended" rail. We filter out anything the user is
 *   already enrolled in client-side (the catalog endpoint has no
 *   "exclude these ids" filter, and shipping one would balloon the
 *   public API surface for a single page).
 * - The certificate download is a 2-step flow: hit the server to
 *   issue / re-issue the certificate metadata, then render the PDF
 *   client-side via `generateCertificatePdf` (see STEP 30 rationale).
 *   `toast.promise` shows progress + success/error in a single line.
 *
 * Empty / loading
 * ---------------
 * - Hard empty (no enrollments at all): full-card EmptyState with a
 *   primary CTA back to `/courses` so the learner has an obvious
 *   next move on a brand-new account.
 * - Loading: skeleton rail + skeleton table so the layout never shifts
 *   when data arrives (CLS discipline, see STEP 23).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CourseCard, CourseCardSkeleton } from '../../components/course/index.js';
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  Input,
  ProgressBar,
  Skeleton,
  Stat,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listCourses } from '../../services/course.service.js';
import {
  getMyEnrollments,
  unenroll as unenrollCourse,
} from '../../services/enrollment.service.js';
import { requestCertificate } from '../../services/progress.service.js';
import { ROUTES } from '../../utils/constants.js';
import { generateCertificatePdf } from '../../utils/certificate.js';
import { cn } from '../../utils/cn.js';

const ENROLLMENT_FETCH_LIMIT = 50;
const RECOMMENDED_FETCH_LIMIT = 8;
const RECOMMENDED_DISPLAY_LIMIT = 4;
const SEARCH_DEBOUNCE_MS = 250;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
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

/**
 * Resolve the "Resume" / "View course" target for an enrollment.
 *
 * Prefer the explicit `lastAccessedLesson` pointer — that is the canonical
 * "Continue from where you left off" anchor. Fall back to the slug-only
 * learn URL when the user just enrolled and has not opened a lesson yet.
 */
const resumeHrefFor = (enrollment) => {
  const slug = enrollment?.courseId?.slug;
  if (!slug) return ROUTES.dashboard;
  const lessonId = enrollment.lastAccessedLesson;
  return lessonId
    ? ROUTES.lesson(slug, lessonId)
    : ROUTES.courseLearn(slug);
};

const isCompleted = (enrollment) => Boolean(enrollment?.completedAt);

/** Course-status copy for the table — kept distinct from STATUS_BADGE. */
const PROGRESS_BADGE = (enrollment) => {
  if (isCompleted(enrollment)) {
    return { variant: 'success', icon: 'CheckCircle2', label: 'Completed' };
  }
  if ((enrollment?.progressPercent ?? 0) > 0) {
    return { variant: 'info', icon: 'PlayCircle', label: 'In progress' };
  }
  return { variant: 'neutral', icon: 'Circle', label: 'Not started' };
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function ContinueLearningCard({ enrollment }) {
  const course = enrollment.courseId ?? {};
  const instructorName = course.instructor?.name ?? 'Lumen Instructor';
  const thumbnailUrl =
    typeof course.thumbnail === 'string' ? course.thumbnail : course.thumbnail?.url;
  const percent = Math.round(enrollment.progressPercent ?? 0);
  const completedCount = enrollment.completedLessons?.length ?? 0;
  const totalLessons = course.totalLessons ?? 0;

  return (
    <article
      className="group flex h-full w-72 shrink-0 snap-start flex-col overflow-hidden rounded-2xl
        border border-border bg-bg shadow-xs transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong sm:w-80"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out
              group-hover:scale-[1.04]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br
              from-primary/30 via-info/15 to-bg-muted text-primary/70"
          >
            <Icon name="GraduationCap" size={36} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2">
          <ProgressBar value={percent} size="sm" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold leading-snug text-text line-clamp-2">
            {course.title ?? 'Untitled course'}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Avatar
              size="xs"
              src={course.instructor?.avatar}
              name={instructorName}
              alt={instructorName}
            />
            <span className="truncate">{instructorName}</span>
          </div>
        </div>

        <p className="text-xs text-text-muted tabular-nums">
          {completedCount} / {totalLessons} lessons · {percent}% complete
        </p>

        <Link to={resumeHrefFor(enrollment)} className="mt-auto block">
          <Button
            size="md"
            className="w-full"
            rightIcon={<Icon name="ArrowRight" size={16} />}
          >
            Resume
          </Button>
        </Link>
      </div>
    </article>
  );
}

function ContinueLearningRailSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="w-72 shrink-0 overflow-hidden rounded-2xl border border-border bg-bg
            shadow-xs sm:w-80"
        >
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton variant="text" className="w-4/5" />
            <Skeleton variant="text" className="w-2/5" />
            <Skeleton variant="text" className="w-3/5" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletedCourseCard({ enrollment, onDownload, downloading }) {
  const course = enrollment.courseId ?? {};
  const thumbnailUrl =
    typeof course.thumbnail === 'string' ? course.thumbnail : course.thumbnail?.url;

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border
        bg-bg shadow-xs"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br
              from-success/25 via-primary/15 to-bg-muted text-success/80"
          >
            <Icon name="GraduationCap" size={36} />
          </div>
        )}
        <Badge
          variant="success"
          className="absolute left-3 top-3 backdrop-blur-sm"
          leftIcon={<Icon name="CheckCircle2" size={12} />}
        >
          Completed
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold leading-snug text-text line-clamp-2">
          {course.title ?? 'Untitled course'}
        </h3>
        <p className="text-xs text-text-muted">
          Completed on {formatDate(enrollment.completedAt)}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            loading={downloading}
            leftIcon={<Icon name="Download" size={14} />}
            onClick={() => onDownload(enrollment)}
          >
            Download certificate
          </Button>
          <Link to={ROUTES.courseDetail(course.slug)} className="block">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              rightIcon={<Icon name="ArrowRight" size={14} />}
            >
              View course
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Enrollments table                                                         */
/* -------------------------------------------------------------------------- */

const TABLE_COLUMNS = Object.freeze([
  { id: 'title', label: 'Course', sortable: true },
  { id: 'instructor', label: 'Instructor', sortable: true },
  { id: 'enrolledAt', label: 'Enrolled', sortable: true },
  { id: 'progress', label: 'Progress', sortable: true },
  { id: 'status', label: 'Status', sortable: false },
  { id: 'actions', label: '', sortable: false },
]);

const compareValues = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
};

const sortKeyOf = (enrollment, columnId) => {
  const course = enrollment.courseId ?? {};
  switch (columnId) {
    case 'title':
      return course.title ?? '';
    case 'instructor':
      return course.instructor?.name ?? '';
    case 'enrolledAt':
      return enrollment.enrolledAt ? new Date(enrollment.enrolledAt).getTime() : 0;
    case 'progress':
      return enrollment.progressPercent ?? 0;
    default:
      return 0;
  }
};

function SortHeaderButton({ column, sort, onChange }) {
  if (!column.sortable) {
    return (
      <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
        {column.label}
      </span>
    );
  }

  const active = sort.column === column.id;
  const direction = active ? sort.direction : null;

  return (
    <button
      type="button"
      onClick={() => onChange(column.id)}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
        'transition-colors hover:text-text focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-primary',
        active ? 'text-text' : 'text-text-subtle',
      )}
    >
      <span>{column.label}</span>
      <Icon
        name={
          direction === 'asc'
            ? 'ArrowUp'
            : direction === 'desc'
              ? 'ArrowDown'
              : 'ArrowUpDown'
        }
        size={12}
        className={active ? 'text-text' : 'text-text-subtle'}
      />
    </button>
  );
}

function EnrollmentsTable({
  enrollments,
  searchValue,
  searchFilter,
  onSearchChange,
  sort,
  onSortChange,
  onUnenroll,
  onDownloadCertificate,
  downloadingId,
}) {
  const filtered = useMemo(() => {
    const trimmed = searchFilter.trim().toLowerCase();
    if (!trimmed) return enrollments;
    return enrollments.filter((enrollment) => {
      const course = enrollment.courseId ?? {};
      const haystack = [course.title, course.instructor?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [enrollments, searchFilter]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const cmp = compareValues(
        sortKeyOf(a, sort.column),
        sortKeyOf(b, sort.column),
      );
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return next;
  }, [filtered, sort]);

  return (
    <section
      aria-labelledby="enrollments-table-heading"
      className="rounded-2xl border border-border bg-bg shadow-xs"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2
            id="enrollments-table-heading"
            className="text-base font-semibold text-text"
          >
            All enrollments
          </h2>
          <p className="text-xs text-text-muted">
            {enrollments.length} course{enrollments.length === 1 ? '' : 's'} in your library
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            size="sm"
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search enrollments…"
            leadingIcon={<Icon name="Search" size={14} />}
            aria-label="Search enrollments"
          />
        </div>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          size="sm"
          icon="SearchX"
          title="No matches"
          description="Try a different search term to find a course in your library."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-bg-subtle">
              <tr>
                {TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className="px-4 py-3 text-left first:pl-5 last:pr-5"
                  >
                    <SortHeaderButton
                      column={column}
                      sort={sort}
                      onChange={onSortChange}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((enrollment) => {
                const course = enrollment.courseId ?? {};
                const badge = PROGRESS_BADGE(enrollment);
                const percent = Math.round(enrollment.progressPercent ?? 0);
                const completed = isCompleted(enrollment);
                const instructorName = course.instructor?.name ?? '—';

                return (
                  <tr
                    key={enrollment._id ?? enrollment.id}
                    className="transition-colors hover:bg-bg-subtle"
                  >
                    <td className="px-4 py-3 pl-5">
                      <Link
                        to={ROUTES.courseDetail(course.slug)}
                        className="block font-medium text-text hover:text-primary line-clamp-2 max-w-[28ch]"
                      >
                        {course.title ?? 'Untitled course'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Avatar
                          size="xs"
                          src={course.instructor?.avatar}
                          name={instructorName}
                          alt={instructorName}
                        />
                        <span className="truncate max-w-[18ch]">
                          {instructorName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                      {formatDate(enrollment.enrolledAt)}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <ProgressBar value={percent} size="sm" />
                        </div>
                        <span className="text-xs tabular-nums text-text-muted">
                          {percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={badge.variant}
                        leftIcon={<Icon name={badge.icon} size={12} />}
                      >
                        {badge.label}
                      </Badge>
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
                              id: 'continue',
                              label: completed ? 'Review course' : 'Continue learning',
                              icon: completed ? 'RefreshCcw' : 'Play',
                              onSelect: () => {
                                window.location.assign(resumeHrefFor(enrollment));
                              },
                            },
                            {
                              id: 'view',
                              label: 'View course page',
                              icon: 'ExternalLink',
                              onSelect: () => {
                                window.location.assign(
                                  ROUTES.courseDetail(course.slug),
                                );
                              },
                            },
                            ...(completed
                              ? [
                                  {
                                    id: 'certificate',
                                    label: 'Download certificate',
                                    icon: 'Download',
                                    disabled:
                                      downloadingId ===
                                      (enrollment._id ?? enrollment.id),
                                    onSelect: () =>
                                      onDownloadCertificate(enrollment),
                                  },
                                ]
                              : []),
                            { id: 'sep', separator: true },
                            {
                              id: 'unenroll',
                              label: 'Unenroll',
                              icon: 'Trash2',
                              danger: true,
                              onSelect: () => onUnenroll(enrollment),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EnrollmentsTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton variant="text" className="h-5 w-40" />
        <Skeleton className="h-8 w-60 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-12 items-center gap-3 py-3">
            <Skeleton variant="text" className="col-span-4" />
            <Skeleton variant="text" className="col-span-2" />
            <Skeleton variant="text" className="col-span-2" />
            <Skeleton className="col-span-3 h-2 rounded-full" />
            <Skeleton variant="text" className="col-span-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function StudentDashboardPage() {
  useDocumentTitle('My Learning');

  const { user } = useAuth();
  const firstName = firstNameOf(user?.name);

  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentsStatus, setEnrollmentsStatus] = useState('loading');
  const [enrollmentsError, setEnrollmentsError] = useState(null);

  const [recommended, setRecommended] = useState([]);
  const [recommendedStatus, setRecommendedStatus] = useState('loading');

  const [tableSearch, setTableSearch] = useState('');
  const debouncedSearch = useDebounce(tableSearch, SEARCH_DEBOUNCE_MS);
  const [tableSort, setTableSort] = useState({
    column: 'enrolledAt',
    direction: 'desc',
  });

  const [downloadingCertId, setDownloadingCertId] = useState(null);

  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsStatus('loading');
    setEnrollmentsError(null);
    try {
      const payload = await getMyEnrollments({
        status: 'all',
        page: 1,
        limit: ENROLLMENT_FETCH_LIMIT,
      });
      const items = payload?.data?.items ?? payload?.items ?? [];
      setEnrollments(items);
      setEnrollmentsStatus('ready');
    } catch (error) {
      setEnrollmentsStatus('error');
      setEnrollmentsError(
        error?.response?.data?.message ??
          error?.message ??
          'Could not load your enrollments.',
      );
    }
  }, []);

  const fetchRecommended = useCallback(async () => {
    setRecommendedStatus('loading');
    try {
      const payload = await listCourses({
        sort: 'popular',
        page: 1,
        limit: RECOMMENDED_FETCH_LIMIT,
      });
      const items = payload?.data?.items ?? payload?.items ?? [];
      setRecommended(items);
      setRecommendedStatus('ready');
    } catch {
      // Recommended is supplementary content — failing silently is OK; the
      // section just hides itself rather than breaking the whole dashboard.
      setRecommended([]);
      setRecommendedStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
    fetchRecommended();
  }, [fetchEnrollments, fetchRecommended]);

  /* ----------------------------- derived sets ----------------------------- */

  const inProgress = useMemo(
    () =>
      enrollments
        .filter((entry) => !isCompleted(entry))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt ?? a.enrolledAt ?? 0).getTime();
          const bTime = new Date(b.updatedAt ?? b.enrolledAt ?? 0).getTime();
          return bTime - aTime;
        }),
    [enrollments],
  );

  const completed = useMemo(
    () => enrollments.filter(isCompleted),
    [enrollments],
  );

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((entry) => String(entry.courseId?._id ?? ''))),
    [enrollments],
  );

  const recommendedFiltered = useMemo(
    () =>
      recommended
        .filter((course) => !enrolledCourseIds.has(String(course._id)))
        .slice(0, RECOMMENDED_DISPLAY_LIMIT),
    [recommended, enrolledCourseIds],
  );

  const stats = useMemo(() => {
    const total = enrollments.length;
    const completedCount = completed.length;
    const inProgressCount = inProgress.length;
    const completionRate = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    return { total, completedCount, inProgressCount, completionRate };
  }, [enrollments.length, completed.length, inProgress.length]);

  /* --------------------------------- actions ------------------------------ */

  const handleDownloadCertificate = useCallback(
    async (enrollment) => {
      const id = enrollment._id ?? enrollment.id;
      if (!id) return;

      const studentName = user?.name ?? 'Student';

      setDownloadingCertId(id);
      try {
        const result = await toast.promise(
          requestCertificate(enrollment.courseId._id ?? enrollment.courseId.id),
          {
            loading: 'Preparing your certificate…',
            success: 'Certificate ready — opening download.',
            error: 'Could not generate certificate.',
          },
        );
        const data = result?.data ?? result;
        generateCertificatePdf({
          studentName: data.studentName ?? studentName,
          courseTitle: data.courseTitle ?? enrollment.courseId.title,
          instructorName:
            data.instructorName ?? enrollment.courseId.instructor?.name,
          completedAt: data.completedAt ?? enrollment.completedAt,
          certificateIssuedAt: data.certificateIssuedAt,
          certificateId: data.certificateId ?? id,
        });
      } catch {
        // toast.promise already surfaced the error message.
      } finally {
        setDownloadingCertId(null);
      }
    },
    [user?.name],
  );

  const handleUnenroll = useCallback(
    async (enrollment) => {
      const courseId = enrollment.courseId?._id ?? enrollment.courseId?.id;
      const courseTitle = enrollment.courseId?.title ?? 'this course';
      if (!courseId) return;

      const confirmed = window.confirm(
        `Unenroll from "${courseTitle}"? Your progress and quiz attempts for this course will be removed.`,
      );
      if (!confirmed) return;

      try {
        await unenrollCourse(courseId);
        toast.success(`Unenrolled from ${courseTitle}.`);
        setEnrollments((prev) =>
          prev.filter(
            (entry) => (entry._id ?? entry.id) !== (enrollment._id ?? enrollment.id),
          ),
        );
      } catch (error) {
        toast.error(
          error?.response?.data?.message ?? 'Could not unenroll. Please try again.',
        );
      }
    },
    [],
  );

  const handleSortChange = useCallback((columnId) => {
    setTableSort((prev) => {
      if (prev.column === columnId) {
        return {
          column: columnId,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        column: columnId,
        direction: columnId === 'enrolledAt' || columnId === 'progress' ? 'desc' : 'asc',
      };
    });
  }, []);

  /* --------------------------------- render ------------------------------- */

  const isInitialLoading = enrollmentsStatus === 'loading';
  const hasNoEnrollments = enrollmentsStatus === 'ready' && enrollments.length === 0;
  const hasError = enrollmentsStatus === 'error';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-12">
      {/* Welcome strip ------------------------------------------------------- */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-text-muted">
              Pick up where you left off, explore new topics, and keep building
              your learning streak.
            </p>
          </div>
          <Link to={ROUTES.catalog}>
            <Button
              variant="outline"
              leftIcon={<Icon name="Compass" size={16} />}
            >
              Browse catalog
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Enrolled courses"
            value={stats.total}
            icon={<Icon name="BookOpen" size={16} />}
            hint={
              stats.inProgressCount > 0
                ? `${stats.inProgressCount} in progress`
                : 'No active courses'
            }
          />
          <Stat
            label="Completed"
            value={stats.completedCount}
            icon={<Icon name="CheckCircle2" size={16} />}
            hint={
              stats.completedCount > 0
                ? `${stats.completionRate}% of your library`
                : 'Finish your first course'
            }
          />
          <Stat
            label="Completion rate"
            value={`${stats.completionRate}%`}
            icon={<Icon name="TrendingUp" size={16} />}
            hint={
              stats.total === 0
                ? 'Enroll to start tracking'
                : 'Across all enrollments'
            }
          />
        </div>
      </header>

      {hasError && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">We couldn&apos;t load your library.</p>
              <p className="mt-1 text-text-muted">{enrollmentsError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEnrollments}
              leftIcon={<Icon name="RefreshCcw" size={14} />}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty state — only when the user has zero enrollments. ------------- */}
      {hasNoEnrollments && (
        <section className="rounded-3xl border border-dashed border-border bg-bg-subtle">
          <EmptyState
            size="lg"
            icon="GraduationCap"
            title="You haven't enrolled in any courses yet"
            description="Browse the catalog to find your first course and start learning today."
            action={
              <Link to={ROUTES.catalog}>
                <Button leftIcon={<Icon name="Compass" size={16} />}>
                  Explore courses
                </Button>
              </Link>
            }
          />
        </section>
      )}

      {/* Continue learning -------------------------------------------------- */}
      {!hasNoEnrollments && (
        <section aria-labelledby="continue-learning-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="continue-learning-heading"
                className="text-xl font-semibold text-text"
              >
                Continue learning
              </h2>
              <p className="text-sm text-text-muted">
                Jump back into the courses you&apos;re working through.
              </p>
            </div>
          </div>

          {isInitialLoading ? (
            <ContinueLearningRailSkeleton />
          ) : inProgress.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-bg-subtle">
              <EmptyState
                size="sm"
                icon="Sparkles"
                title="All caught up"
                description="You don't have any courses in progress. Explore the catalog or revisit a completed course."
                action={
                  <Link to={ROUTES.catalog}>
                    <Button size="sm">Browse catalog</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2
                scroll-smooth sm:-mx-6 sm:px-6"
            >
              {inProgress.map((enrollment) => (
                <ContinueLearningCard
                  key={enrollment._id ?? enrollment.id}
                  enrollment={enrollment}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recommended -------------------------------------------------------- */}
      {!hasError && recommendedFiltered.length > 0 && (
        <section aria-labelledby="recommended-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="recommended-heading"
                className="text-xl font-semibold text-text"
              >
                Recommended for you
              </h2>
              <p className="text-sm text-text-muted">
                Trending courses picked from across the Lumen catalog.
              </p>
            </div>
            <Link
              to={ROUTES.catalog}
              className="hidden text-sm font-medium text-primary hover:underline sm:inline-flex"
            >
              View all →
            </Link>
          </div>

          {recommendedStatus === 'loading' ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <CourseCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {recommendedFiltered.map((course) => (
                <CourseCard key={course._id ?? course.id} course={course} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Completed ---------------------------------------------------------- */}
      {!hasNoEnrollments && enrollmentsStatus === 'ready' && completed.length > 0 && (
        <section aria-labelledby="completed-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="completed-heading"
                className="text-xl font-semibold text-text"
              >
                Completed courses
              </h2>
              <p className="text-sm text-text-muted">
                Download a certificate to celebrate the win.
              </p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {completed.map((enrollment) => (
              <CompletedCourseCard
                key={enrollment._id ?? enrollment.id}
                enrollment={enrollment}
                onDownload={handleDownloadCertificate}
                downloading={
                  downloadingCertId === (enrollment._id ?? enrollment.id)
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* All enrollments table --------------------------------------------- */}
      {!hasNoEnrollments && (
        <section className="space-y-4">
          {isInitialLoading ? (
            <EnrollmentsTableSkeleton />
          ) : (
            <EnrollmentsTable
              enrollments={enrollments}
              searchValue={tableSearch}
              searchFilter={debouncedSearch}
              onSearchChange={setTableSearch}
              sort={tableSort}
              onSortChange={handleSortChange}
              onUnenroll={handleUnenroll}
              onDownloadCertificate={handleDownloadCertificate}
              downloadingId={downloadingCertId}
            />
          )}
        </section>
      )}
    </div>
  );
}
