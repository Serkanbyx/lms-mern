/**
 * Public course detail page — `/courses/:slug`.
 *
 * Drives the marketing surface every other route in the app links into:
 * the catalog card, the navbar search, the public profile feed, the
 * dashboard's "continue learning" tile and the post-registration deep
 * link all converge here.
 *
 * Data fan-out
 * ------------
 * On mount (or when `slug` changes) we fan out three requests in
 * parallel:
 *   1. `getCourseBySlug` — the marketing payload (404 → empty state).
 *   2. `getCurriculum`   — section/lesson tree, content-gated server
 *      side; preview lessons come back with `videoUrl`, locked
 *      lessons only carry titles + duration.
 *   3. (auth only) `getEnrollmentForCourse` — silent best-effort; a
 *      404 just means "not enrolled yet" and is treated as such.
 * If the user is enrolled we additionally pull `getCourseProgress` so
 * the EnrollmentCard can render the progress ring on "Continue
 * learning". An out-of-order guard (`requestId`) protects the page
 * from the classic stale-response problem when the user navigates
 * between two slugs faster than the network responds.
 *
 * Layout
 * ------
 * Full-bleed hero band followed by a two-column body where the right
 * column hosts a sticky `EnrollmentCard` that visually overlaps the
 * hero (`-mt-` pulls the card up into the dark band). On mobile the
 * enrollment card collapses into normal flow at the top of the body
 * AND we render a compact fixed bottom bar so the primary CTA is
 * always within thumb-reach.
 *
 * Preview player
 * --------------
 * `ReactPlayer` is loaded lazily — the marketing page should never
 * carry the streaming runtime in its initial bundle for visitors who
 * never click the preview thumbnail. The first preview interaction
 * pays the import cost, every subsequent one uses the cached chunk.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  CourseDetailSkeleton,
  CourseHero,
  CurriculumOutline,
  EnrollmentCard,
} from '../../components/course/index.js';
import { JsonLd, Seo } from '../../components/seo/index.js';
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  Icon,
  Modal,
  Spinner,
  Tabs,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import * as courseService from '../../services/course.service.js';
import * as enrollmentService from '../../services/enrollment.service.js';
import * as progressService from '../../services/progress.service.js';
import { ROLES, ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { markPwaEnrollment } from '../../utils/pwa.js';

const ReactPlayer = lazy(() => import('react-player'));

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'instructor', label: 'Instructor' },
  { id: 'reviews', label: 'Reviews' },
];

const formatPrice = (price) => {
  const numeric = Number(price);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
};

const findFirstPreviewLesson = (sections) => {
  for (const section of sections ?? []) {
    for (const lesson of section.lessons ?? []) {
      if (lesson.isFreePreview && lesson.type === 'video' && lesson.videoUrl) {
        return lesson;
      }
    }
  }
  return null;
};

export default function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [state, setState] = useState({
    status: 'loading',
    course: null,
    sections: [],
    enrollment: null,
    progress: null,
    error: null,
    notFound: false,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [enrolling, setEnrolling] = useState(false);
  const [previewLesson, setPreviewLesson] = useState(null);

  const requestId = useRef(0);

  // The page title only updates once the course resolves; before that the
  // hook gets a generic placeholder so refreshes still get a sensible tab.
  useDocumentTitle(state.course?.title ?? 'Course');

  const loadCourse = useCallback(async () => {
    if (!slug) return;
    requestId.current += 1;
    const myId = requestId.current;
    setState((prev) => ({ ...prev, status: 'loading', error: null, notFound: false }));

    try {
      const [courseResp, curriculumResp] = await Promise.all([
        courseService.getCourseBySlug(slug),
        courseService.getCurriculum(slug),
      ]);

      if (myId !== requestId.current) return;

      const course = courseResp?.course ?? courseResp?.data ?? courseResp;
      const sections =
        curriculumResp?.data?.sections ??
        curriculumResp?.sections ??
        [];

      let enrollment = null;
      let progress = null;
      if (isAuthenticated && course?._id) {
        try {
          const enrollmentResp = await enrollmentService.getEnrollmentForCourse(
            course._id,
          );
          enrollment =
            enrollmentResp?.enrollment ??
            enrollmentResp?.data ??
            enrollmentResp ??
            null;
        } catch {
          enrollment = null;
        }

        if (enrollment) {
          try {
            const progressResp = await progressService.getCourseProgress(
              course._id,
            );
            progress = progressResp?.data ?? progressResp ?? null;
          } catch {
            progress = null;
          }
        }
      }

      if (myId !== requestId.current) return;
      setState({
        status: 'ready',
        course,
        sections,
        enrollment,
        progress,
        error: null,
        notFound: false,
      });
    } catch (error) {
      if (myId !== requestId.current) return;
      const status = error?.response?.status;
      setState({
        status: 'error',
        course: null,
        sections: [],
        enrollment: null,
        progress: null,
        error: error?.message ?? 'Could not load this course.',
        notFound: status === 404,
      });
    }
  }, [slug, isAuthenticated]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  useEffect(() => {
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  const course = state.course;
  const sections = state.sections;

  const isOwner = useMemo(() => {
    if (!user || !course) return false;
    const ownerId =
      typeof course.instructor === 'string'
        ? course.instructor
        : course.instructor?._id ?? course.instructor?.id;
    return (
      ownerId &&
      String(ownerId) === String(user._id ?? user.id) &&
      (user.role === ROLES.instructor || user.role === ROLES.admin)
    );
  }, [course, user]);

  const previewCandidate = useMemo(
    () => findFirstPreviewLesson(sections),
    [sections],
  );

  /**
   * Schema.org `Course` payload — emitted as JSON-LD so search engines
   * can surface the course in rich results. We deliberately keep it
   * server-data driven (no hard-coded provider URL) so it stays in sync
   * with whatever the catalog ships.
   */
  const courseJsonLd = useMemo(() => {
    if (!course) return null;
    const instructorName =
      typeof course.instructor === 'object' ? course.instructor?.name : null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.title,
      description: course.shortDescription || course.description,
      provider: {
        '@type': 'Organization',
        name: import.meta.env.VITE_APP_NAME || 'Lumen LMS',
        sameAs:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      ...(instructorName && {
        instructor: { '@type': 'Person', name: instructorName },
      }),
      ...(course.thumbnail?.url && { image: course.thumbnail.url }),
      ...(course.language && { inLanguage: course.language }),
    };
  }, [course]);

  const handleEnroll = useCallback(async () => {
    if (!course?._id) return;
    setEnrolling(true);
    try {
      const resp = await enrollmentService.enroll(course._id);
      const enrollment =
        resp?.enrollment ?? resp?.data ?? resp ?? { courseId: course._id };
      toast.success("You're enrolled — happy learning!");
      // Flip the high-intent flag the install prompt watches; first
      // enrollment is the strongest "this user gets value" signal we
      // have, so the PWA banner unlocks immediately afterwards.
      markPwaEnrollment();
      setState((prev) => ({ ...prev, enrollment }));
      navigate(ROUTES.courseLearn(course.slug));
    } catch (error) {
      toast.error(error?.message ?? 'Could not enroll. Please try again.');
    } finally {
      setEnrolling(false);
    }
  }, [course, navigate]);

  if (state.status === 'loading') {
    return <CourseDetailSkeleton />;
  }

  if (state.notFound || (state.status === 'error' && !course)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState
          icon="Compass"
          title="Course not found"
          description="This course may have been unpublished or the link is broken. Try browsing the catalog instead."
          action={
            <Link to={ROUTES.catalog}>
              <Button>Browse courses</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Alert variant="danger" title="We couldn't load this course">
          {state.error}
        </Alert>
        <div className="mt-6 flex justify-center">
          <Button onClick={loadCourse} leftIcon={<Icon name="RefreshCw" size={16} />}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const enrollmentCardProps = {
    course,
    enrollment: state.enrollment,
    progress: state.progress,
    isAuthenticated,
    isOwner,
    enrolling,
    onEnroll: handleEnroll,
    previewLesson: previewCandidate,
    onPreview: setPreviewLesson,
  };

  const priceLabel = formatPrice(course.price);
  const isFree = priceLabel === null;

  return (
    <div className="pb-24 lg:pb-12">
      <Seo
        title={course.title}
        description={course.shortDescription || course.description?.slice(0, 200)}
        image={course.thumbnail?.url}
        url={`/courses/${course.slug}`}
        type="article"
      />
      <JsonLd data={courseJsonLd} />

      <CourseHero course={course} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <main className="min-w-0 pt-8">
            {!isDesktop && (
              <div className="mb-8">
                <EnrollmentCard {...enrollmentCardProps} />
              </div>
            )}

            <Tabs value={activeTab} onChange={setActiveTab} items={TAB_ITEMS}>
              {activeTab === 'overview' && <OverviewTab course={course} />}
              {activeTab === 'curriculum' && (
                <CurriculumOutline
                  sections={sections}
                  isEnrolled={Boolean(state.enrollment)}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  onPreview={setPreviewLesson}
                />
              )}
              {activeTab === 'instructor' && (
                <InstructorTab instructor={course.instructor} />
              )}
              {activeTab === 'reviews' && <ReviewsTab />}
            </Tabs>
          </main>

          {isDesktop && (
            <aside className="relative">
              <div className="sticky top-20 -mt-32">
                <EnrollmentCard {...enrollmentCardProps} />
              </div>
            </aside>
          )}
        </div>
      </div>

      {!isDesktop && (
        <MobileEnrollmentBar
          course={course}
          enrollment={state.enrollment}
          isAuthenticated={isAuthenticated}
          isOwner={isOwner}
          enrolling={enrolling}
          onEnroll={handleEnroll}
          isFree={isFree}
          priceLabel={priceLabel}
        />
      )}

      <PreviewModal
        lesson={previewLesson}
        onClose={() => setPreviewLesson(null)}
      />
    </div>
  );
}

function OverviewTab({ course }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        {course.learningOutcomes?.length > 0 && (
          <section
            aria-labelledby="learn-heading"
            className="rounded-2xl border border-border bg-bg-subtle p-6 mb-8"
          >
            <h2
              id="learn-heading"
              className="text-lg font-semibold text-text mb-4"
            >
              What you&apos;ll learn
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {course.learningOutcomes.map((outcome, index) => (
                <li
                  key={`${outcome}-${index}`}
                  className="flex items-start gap-2 text-sm text-text"
                >
                  <Icon
                    name="Check"
                    size={16}
                    className="mt-0.5 shrink-0 text-success"
                  />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="description-heading" className="mb-8">
          <h2
            id="description-heading"
            className="text-lg font-semibold text-text mb-3"
          >
            About this course
          </h2>
          <div className="prose prose-sm max-w-none whitespace-pre-line text-text-muted leading-relaxed">
            {course.description}
          </div>
        </section>

        {course.requirements?.length > 0 && (
          <section aria-labelledby="requirements-heading" className="mb-8">
            <h2
              id="requirements-heading"
              className="text-lg font-semibold text-text mb-3"
            >
              Requirements
            </h2>
            <ul className="space-y-2 text-sm text-text-muted">
              {course.requirements.map((requirement, index) => (
                <li
                  key={`${requirement}-${index}`}
                  className="flex items-start gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-text-subtle"
                  />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {course.tags?.length > 0 && (
          <section aria-labelledby="tags-heading">
            <h2
              id="tags-heading"
              className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3"
            >
              Topics
            </h2>
            <ul className="flex flex-wrap gap-2">
              {course.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs text-text-muted"
                >
                  #{tag}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          At a glance
        </h3>
        <dl className="rounded-xl border border-border bg-bg-subtle divide-y divide-border text-sm">
          <FactRow icon="PlayCircle" label="Lessons" value={course.totalLessons ?? 0} />
          <FactRow
            icon="Clock"
            label="Duration"
            value={formatDuration(course.totalDuration)}
          />
          <FactRow
            icon="Users"
            label="Students"
            value={(course.enrollmentCount ?? 0).toLocaleString()}
          />
          {course.language && (
            <FactRow
              icon="Languages"
              label="Language"
              value={course.language.toUpperCase()}
            />
          )}
        </dl>
      </aside>
    </div>
  );
}

function FactRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} size={16} className="text-text-muted" />
      <dt className="flex-1 text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}

function InstructorTab({ instructor }) {
  if (!instructor) {
    return (
      <p className="text-sm text-text-muted">
        Instructor profile is not available.
      </p>
    );
  }

  const instructorId = instructor._id ?? instructor.id;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <Avatar size="xl" src={instructor.avatar} name={instructor.name} />
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-semibold text-text">{instructor.name}</h2>
        {instructor.headline && (
          <p className="mt-1 text-sm text-text-muted">{instructor.headline}</p>
        )}
        {instructor.bio && (
          <p className="mt-4 text-sm text-text-muted leading-relaxed whitespace-pre-line">
            {instructor.bio}
          </p>
        )}
        {instructorId && (
          <div className="mt-5">
            <Link to={ROUTES.profile(instructorId)}>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<Icon name="ArrowRight" size={14} />}
              >
                View public profile
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewsTab() {
  return (
    <EmptyState
      icon="Star"
      title="Reviews are coming soon"
      description="Once learners start finishing this course you'll see their feedback here."
      size="sm"
    />
  );
}

function MobileEnrollmentBar({
  course,
  enrollment,
  isAuthenticated,
  isOwner,
  enrolling,
  onEnroll,
  isFree,
  priceLabel,
}) {
  const isEnrolled = Boolean(enrollment);

  let cta;
  if (isOwner) {
    cta = (
      <Link to={ROUTES.instructorCourseEdit(course._id ?? course.id)} className="block">
        <Button variant="outline" className="w-full">
          Edit course
        </Button>
      </Link>
    );
  } else if (isEnrolled) {
    cta = (
      <Link to={ROUTES.courseLearn(course.slug)} className="block">
        <Button className="w-full" rightIcon={<Icon name="ArrowRight" size={16} />}>
          Continue
        </Button>
      </Link>
    );
  } else if (!isAuthenticated) {
    const nextHref = `${ROUTES.register}?next=${encodeURIComponent(
      ROUTES.courseDetail(course.slug),
    )}`;
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md p-3 lg:hidden">
        <Link to={nextHref} className="block">
          <Button className="w-full">Sign up to enroll</Button>
        </Link>
      </div>
    );
  } else {
    cta = (
      <Button className="w-full" loading={enrolling} onClick={onEnroll}>
        {isFree ? 'Enroll for free' : `Enroll · ${priceLabel}`}
      </Button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md p-3 lg:hidden">
      <div className="flex items-center gap-3">
        {!isEnrolled && !isOwner && (
          <span className={['shrink-0 text-lg font-semibold tracking-tight', isFree ? 'text-success' : 'text-text'].join(' ')}>
            {isFree ? 'Free' : priceLabel}
          </span>
        )}
        <div className="flex-1">{cta}</div>
      </div>
    </div>
  );
}

function PreviewModal({ lesson, onClose }) {
  return (
    <Modal
      open={Boolean(lesson)}
      onClose={onClose}
      title={lesson?.title ?? 'Preview lesson'}
      size="xl"
    >
      {lesson?.videoUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Spinner label="Loading player…" />
              </div>
            }
          >
            <ReactPlayer
              src={lesson.videoUrl}
              controls
              playing
              width="100%"
              height="100%"
              style={{ position: 'absolute', inset: 0 }}
            />
          </Suspense>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          No preview is available for this lesson.
        </p>
      )}
    </Modal>
  );
}
