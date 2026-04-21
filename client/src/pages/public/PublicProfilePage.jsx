/**
 * Public profile page — `/u/:userId`.
 *
 * Renders any user's public-facing identity card. The server already
 * filters the payload through the target user's privacy preferences
 * (`showEmail`, `showEnrolledCourses`) so the client just renders
 * whatever it gets and falls back to "this user keeps it private"
 * empty states for the optional fields.
 *
 * Tabs:
 *  - Instructors → "Courses": grid of their published catalog. Pulled
 *    from `getInstructorPublicCourses` so drafts/pending stay hidden.
 *  - Students    → "Stats":  enrollment counters (only shown when the
 *    target user opted into `showEnrolledCourses`).
 *
 * The two tab sets are mutually exclusive: a student profile never
 * shows "Courses" (they don't author any), an instructor profile
 * skips the learner stats tab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { CourseCard, CourseCardSkeleton } from '../../components/course/index.js';
import { Seo } from '../../components/seo/index.js';
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  Icon,
  RoleBadge,
  Skeleton,
  Stat,
  Tabs,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as courseService from '../../services/course.service.js';
import * as userService from '../../services/user.service.js';
import { ROLES, ROUTES } from '../../utils/constants.js';

const COURSE_SKELETON_COUNT = 4;

const formatJoinDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
};

const buildTabs = ({ isInstructor, hasStats }) => {
  const tabs = [];
  if (isInstructor) tabs.push({ id: 'courses', label: 'Courses' });
  if (hasStats) tabs.push({ id: 'stats', label: 'Stats' });
  return tabs;
};

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user: viewer } = useAuth();

  const [profileState, setProfileState] = useState({
    status: 'loading',
    profile: null,
    error: null,
    notFound: false,
  });

  const [coursesState, setCoursesState] = useState({
    status: 'idle',
    items: [],
    error: null,
  });

  const [activeTab, setActiveTab] = useState(null);

  useDocumentTitle(profileState.profile?.name ?? 'Profile');

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setProfileState({ status: 'loading', profile: null, error: null, notFound: false });
    try {
      const resp = await userService.getPublicProfile(userId);
      const profile = resp?.user ?? resp?.data ?? resp ?? null;
      setProfileState({
        status: profile ? 'ready' : 'error',
        profile,
        error: profile ? null : 'Could not load this profile.',
        notFound: !profile,
      });
    } catch (error) {
      const status = error?.response?.status;
      setProfileState({
        status: 'error',
        profile: null,
        error: error?.message ?? 'Could not load this profile.',
        notFound: status === 404,
      });
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const profile = profileState.profile;
  const isInstructor = profile?.role === ROLES.instructor;
  const hasStats =
    profile?.role === ROLES.student &&
    typeof profile?.enrolledCoursesCount === 'number';

  const tabs = useMemo(
    () => buildTabs({ isInstructor, hasStats }),
    [isInstructor, hasStats],
  );

  // Default the active tab once the role-aware tab list is known.
  useEffect(() => {
    if (tabs.length === 0) {
      setActiveTab(null);
      return;
    }
    setActiveTab((current) =>
      current && tabs.some((tab) => tab.id === current) ? current : tabs[0].id,
    );
  }, [tabs]);

  const loadCourses = useCallback(async () => {
    if (!isInstructor || !profile?._id) return;
    setCoursesState({ status: 'loading', items: [], error: null });
    try {
      const resp = await courseService.getInstructorPublicCourses(profile._id, {
        limit: 12,
      });
      const items =
        resp?.courses ?? resp?.data?.courses ?? resp?.data ?? resp ?? [];
      setCoursesState({
        status: 'ready',
        items: Array.isArray(items) ? items : [],
        error: null,
      });
    } catch (error) {
      setCoursesState({
        status: 'error',
        items: [],
        error: error?.message ?? 'Could not load courses.',
      });
    }
  }, [isInstructor, profile?._id]);

  useEffect(() => {
    if (activeTab === 'courses' && coursesState.status === 'idle') {
      loadCourses();
    }
  }, [activeTab, coursesState.status, loadCourses]);

  if (profileState.status === 'loading') {
    return <ProfileSkeleton />;
  }

  if (profileState.notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState
          icon="UserX"
          title="Profile not found"
          description="The person you're looking for may have closed their account or the link is broken."
          action={
            <Link to={ROUTES.home}>
              <Button>Back to home</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (profileState.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Alert variant="danger" title="We couldn't load this profile">
          {profileState.error}
        </Alert>
        <div className="mt-6 flex justify-center">
          <Button
            onClick={loadProfile}
            leftIcon={<Icon name="RefreshCw" size={16} />}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const isOwnProfile =
    viewer && profile && String(viewer._id ?? viewer.id) === String(profile._id);

  const seoDescription =
    profile.headline ||
    (isInstructor
      ? `Public instructor profile of ${profile.name} on Lumen LMS.`
      : `Public learner profile of ${profile.name} on Lumen LMS.`);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <Seo
        title={profile.name}
        description={seoDescription}
        image={profile.avatar}
        url={`/u/${profile._id ?? userId}`}
        type="profile"
      />

      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />

      {tabs.length > 0 ? (
        <div className="mt-10">
          <Tabs value={activeTab} onChange={setActiveTab} items={tabs}>
            {activeTab === 'courses' && (
              <CoursesTab
                state={coursesState}
                onRetry={loadCourses}
                instructorName={profile.name}
              />
            )}
            {activeTab === 'stats' && <StatsTab profile={profile} />}
          </Tabs>
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            icon="EyeOff"
            title="This user keeps their learning private"
            description="There's nothing else to show on their public profile."
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

function ProfileHeader({ profile, isOwnProfile }) {
  const joined = formatJoinDate(profile.createdAt);

  return (
    <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
      <Avatar
        src={profile.avatar}
        name={profile.name}
        size="xl"
        className="h-24 w-24 text-2xl"
      />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <h1 className="text-2xl font-semibold text-text">{profile.name}</h1>
          <RoleBadge role={profile.role} />
        </div>

        {profile.headline && (
          <p className="mt-2 text-base text-text-muted">{profile.headline}</p>
        )}

        {profile.email && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-muted">
            <Icon name="Mail" size={14} />
            <a
              href={`mailto:${profile.email}`}
              className="hover:text-text underline-offset-4 hover:underline"
            >
              {profile.email}
            </a>
          </p>
        )}

        {profile.bio && (
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-text-muted">
            {profile.bio}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          {joined && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-subtle">
              <Icon name="Calendar" size={14} />
              Joined {joined}
            </span>
          )}
          {isOwnProfile && (
            <Link to={ROUTES.settings}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Icon name="Settings" size={14} />}
              >
                Edit profile
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function CoursesTab({ state, onRetry, instructorName }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <ul
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        aria-busy="true"
      >
        {Array.from({ length: COURSE_SKELETON_COUNT }).map((_, index) => (
          <li key={index}>
            <CourseCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-4">
        <Alert variant="danger" title="Couldn't load courses">
          {state.error}
        </Alert>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          leftIcon={<Icon name="RotateCcw" size={14} />}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <EmptyState
        icon="BookOpen"
        title={`${instructorName} hasn't published any courses yet`}
        description="Check back soon — every great instructor starts with that first lesson."
        size="sm"
      />
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {state.items.map((course) => (
        <li key={course._id ?? course.slug}>
          <CourseCard course={course} />
        </li>
      ))}
    </ul>
  );
}

function StatsTab({ profile }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Stat
        label="Enrolled courses"
        value={profile.enrolledCoursesCount ?? 0}
        icon={<Icon name="BookMarked" size={18} />}
      />
      <Stat
        label="Member since"
        value={formatJoinDate(profile.createdAt) ?? '—'}
        icon={<Icon name="Calendar" size={18} />}
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32 mt-3" />
        </div>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: COURSE_SKELETON_COUNT }).map((_, index) => (
          <CourseCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
