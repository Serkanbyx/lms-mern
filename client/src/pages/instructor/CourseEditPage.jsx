/**
 * Instructor — `/instructor/courses/:id/edit`
 *
 * Loads the course (via the owner-scoped `/courses/mine` endpoint, which
 * already returns full documents for the dashboard) then hands the
 * resulting object to `CourseForm` in `edit` mode. The form owns every
 * interaction including auto-save, lifecycle actions, and the destructive
 * delete confirmation.
 *
 * Why fetch through `getMyCourses` instead of a `GET /courses/:id`?
 * The course router exposes `GET /:slug` (with owner preview access) and
 * `GET /mine` (paginated list) but no `GET /:id`. Reusing the existing
 * endpoint keeps the server surface unchanged while still scoping the
 * fetch to the authenticated instructor's catalog.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Alert,
  Button,
  Icon,
  Skeleton,
  StatusBadge,
} from '../../components/ui/index.js';
import { CourseForm } from '../../components/instructor/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getMyCourses } from '../../services/course.service.js';
import { ROUTES } from '../../utils/constants.js';

const FETCH_LIMIT = 100;

export default function CourseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useDocumentTitle(course?.title ? `Edit · ${course.title}` : 'Edit course');

  const fetchCourse = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const payload = await getMyCourses({ limit: FETCH_LIMIT });
      const items = payload?.data?.items ?? payload?.items ?? [];
      const found = items.find((entry) => (entry._id ?? entry.id) === id);
      if (!found) {
        setStatus('not-found');
        return;
      }
      setCourse(found);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load this course.',
      );
    }
  }, [id]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handleUpdated = useCallback((updated) => {
    if (!updated) return;
    setCourse((prev) => ({ ...(prev ?? {}), ...updated }));
  }, []);

  const handleDeleted = useCallback(() => {
    navigate(ROUTES.instructor);
  }, [navigate]);

  const headerStatus = useMemo(() => course?.status, [course?.status]);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-6">
        <Skeleton variant="text" className="h-4 w-40" />
        <Skeleton variant="text" className="h-9 w-3/4 max-w-xl" />
        <Skeleton variant="text" className="h-4 w-2/3 max-w-2xl" />
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
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
        <Alert variant="danger" title="We couldn't load this course">
          {error}
        </Alert>
        <div className="flex items-center gap-3">
          <Button onClick={fetchCourse} leftIcon={<Icon name="RefreshCcw" size={14} />}>
            Retry
          </Button>
          <Link to={ROUTES.instructor}>
            <Button variant="ghost">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Link
            to={ROUTES.instructor}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <Icon name="ArrowLeft" size={14} />
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text truncate">
              {course?.title ?? 'Edit course'}
            </h1>
            {headerStatus && <StatusBadge status={headerStatus} />}
          </div>
          <p className="text-text-muted">
            Edit your course details, then jump to the curriculum builder
            when you&apos;re ready to add lessons.
          </p>
        </div>
        <Link to={ROUTES.instructorCurriculum(id)}>
          <Button
            variant="secondary"
            rightIcon={<Icon name="ArrowRight" size={14} />}
          >
            Go to curriculum
          </Button>
        </Link>
      </header>

      <CourseForm
        mode="edit"
        course={course}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
