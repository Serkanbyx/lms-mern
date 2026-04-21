/**
 * Admin dashboard — `/admin`
 *
 * Three vertical zones, top-to-bottom:
 *
 *   1. Stat strip          → Users · Courses · Enrollments · Quiz attempts.
 *                            Each tile is a `Link` so the most common drill-
 *                            down is one click away.
 *   2. Charts row          → bar chart of enrollment activity over the last
 *                            30 days + donut of course status distribution.
 *                            Both are drawn with raw SVG to avoid pulling
 *                            in a chart library for v1.
 *   3. Recent activity     → two columns: latest 10 registrations + latest
 *                            10 pending course submissions, with avatars
 *                            and relative timestamps.
 *
 * Data strategy
 * -------------
 * - Three parallel requests on mount:
 *     • `admin.getStats()`              → aggregate counters + status breakdown
 *     • `admin.listUsers({ sort: 'newest', limit: 10 })`         → registrations
 *     • `admin.listCoursesAdmin({ status: 'pending', sort: 'newest', limit: 10 })` → submissions
 *   They're independent, so `Promise.allSettled` lets a slow secondary
 *   panel fail without blocking the headline stats from rendering.
 * - Charts read directly from `stats` so there is no extra round-trip.
 *   The 30-day bar chart synthesises a plausible distribution from the
 *   `last7Days` + `total` snapshot the backend already provides (a real
 *   time-series endpoint would replace `buildEnrollmentSeries` later).
 *
 * Loading / error
 * ---------------
 * - Initial loading: skeleton stats + skeleton chart + skeleton lists so
 *   the layout never shifts when data resolves.
 * - Failed sections degrade gracefully (per-card error states) instead
 *   of blanking the whole page; admins still see whatever DID load.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  RoleBadge,
  Skeleton,
  Stat,
  StatusBadge,
} from '../../components/ui/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  getPendingCourses,
  getStats,
  listUsers,
} from '../../services/admin.service.js';
import { ROUTES } from '../../utils/constants.js';
import { formatRelativeTime } from '../../utils/formatDate.js';
import { cn } from '../../utils/cn.js';

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat('en-US');

const STATUS_LEGEND = Object.freeze([
  { key: 'published', label: 'Published', color: 'var(--color-success)' },
  { key: 'pending', label: 'Pending', color: 'var(--color-warning)' },
  { key: 'draft', label: 'Draft', color: 'var(--color-text-subtle)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--color-danger)' },
  { key: 'archived', label: 'Archived', color: 'var(--color-text-muted)' },
]);

/* -------------------------------------------------------------------------- */
/*  Synthetic 30-day enrollment series                                        */
/* -------------------------------------------------------------------------- */

/**
 * Until the backend exposes a daily aggregation endpoint, build a 30-day
 * enrollment shape from the two figures we DO have (`last7Days`, `total`).
 *
 * We anchor the last 7 bars so they sum to `last7Days` (truthful for the
 * recent window), then fade the earlier 23 days down toward an estimated
 * historical daily average (`(total - last7Days) / 23`, floored at 0).
 *
 * A deterministic per-day jitter keeps the silhouette interesting without
 * making the chart re-randomise every render.
 */
const buildEnrollmentSeries = ({ last7Days = 0, total = 0 } = {}) => {
  const days = 30;
  const series = new Array(days).fill(0);

  const jitter = (seed) => 0.7 + ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * 0.3;

  const last7Average = last7Days / 7;
  for (let i = 0; i < 7; i += 1) {
    const idx = days - 7 + i;
    series[idx] = Math.max(0, Math.round(last7Average * jitter(idx)));
  }
  // Re-balance so the last 7 sum exactly to last7Days (rounding wobble).
  const last7Sum = series.slice(-7).reduce((a, b) => a + b, 0);
  if (last7Sum !== last7Days && last7Days > 0) {
    series[days - 1] += last7Days - last7Sum;
    if (series[days - 1] < 0) series[days - 1] = 0;
  }

  const historicalAvg = Math.max(0, (total - last7Days) / 23);
  for (let i = 0; i < days - 7; i += 1) {
    const ramp = 0.4 + (i / (days - 7)) * 0.6;
    series[i] = Math.max(0, Math.round(historicalAvg * ramp * jitter(i + 100)));
  }

  return series;
};

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function PageHeader() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          Platform overview
        </h1>
        <p className="mt-1 max-w-xl text-text-muted">
          Headline counters, recent activity, and the moderation queue at a
          glance.
        </p>
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
  );
}

function StatCard({ to, label, value, hint, icon }) {
  return (
    <Link
      to={to}
      className="group rounded-xl outline-none focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Stat
        label={label}
        value={value}
        hint={hint}
        icon={<Icon name={icon} size={16} />}
        className="h-full transition-all group-hover:-translate-y-0.5
          group-hover:border-border-strong group-hover:shadow-md"
      />
    </Link>
  );
}

function StatsStripSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
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

function ChartCard({ title, subtitle, action, loading, children }) {
  return (
    <section className="rounded-2xl border border-border bg-bg shadow-xs">
      <header className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="px-5 pb-5 pt-3">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * 30-day enrollment bar chart (pure SVG, no chart lib).
 *
 * Bars are sized via a tabular `viewBox` so the chart scales cleanly on
 * any column width. An axis label every 5 days keeps the X scale readable
 * without overcrowding. Hover tooltips use a native `<title>` so we don't
 * have to build custom tooltip plumbing for a placeholder chart.
 */
function EnrollmentBarChart({ series }) {
  const width = 320;
  const height = 160;
  const padding = { top: 8, right: 0, bottom: 22, left: 0 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...series);
  const barGap = 2;
  const barWidth = (innerWidth - barGap * (series.length - 1)) / series.length;

  if (series.every((v) => v === 0)) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        No enrollments yet — once students join, daily activity will show up
        here.
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Enrollments over the last 30 days"
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0}
            x2={width}
            y1={padding.top + innerHeight * t}
            y2={padding.top + innerHeight * t}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
        ))}
        {series.map((value, i) => {
          const h = (value / max) * innerHeight;
          const x = padding.left + i * (barWidth + barGap);
          const y = padding.top + (innerHeight - h);
          const isLast7 = i >= series.length - 7;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, h)}
                rx={1.5}
                fill={isLast7 ? 'var(--color-primary)' : 'var(--color-border-strong)'}
                opacity={isLast7 ? 1 : 0.55}
              >
                <title>{`Day -${series.length - 1 - i}: ${value} enrollment${value === 1 ? '' : 's'}`}</title>
              </rect>
            </g>
          );
        })}
        {[0, 7, 14, 21, 29].map((i) => (
          <text
            key={i}
            x={padding.left + i * (barWidth + barGap) + barWidth / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-text-subtle)"
          >
            {`-${series.length - 1 - i}d`}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex items-center gap-4 text-xs text-text-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}
          />
          Last 7 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-sm opacity-60"
            style={{ backgroundColor: 'var(--color-border-strong)' }}
          />
          Earlier 23 days (estimate)
        </span>
      </div>
    </div>
  );
}

/**
 * Course status distribution donut (pure SVG).
 *
 * Implements the donut as a stacked set of `<circle>` strokes whose
 * `stroke-dasharray` carves out each segment's arc length. This avoids
 * the trigonometry needed for `<path d="A ...">` arcs and stays crisp
 * at any size.
 */
function StatusDonutChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        No courses yet — once instructors publish, the breakdown will appear
        here.
      </div>
    );
  }

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label="Course status distribution"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--color-bg-muted)"
            strokeWidth={stroke}
          />
          {data.map((segment) => {
            if (segment.value === 0) return null;
            const portion = segment.value / total;
            const length = portion * circumference;
            const dash = `${length} ${circumference - length}`;
            const dashOffset = -offset;
            offset += length;
            return (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-text">
            {compact.format(total)}
          </span>
          <span className="text-xs text-text-subtle">courses</span>
        </div>
      </div>

      <ul className="flex-1 min-w-[160px] space-y-2">
        {data.map((segment) => {
          const portion = total === 0 ? 0 : Math.round((segment.value / total) * 100);
          return (
            <li
              key={segment.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 text-text">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}
              </span>
              <span className="tabular-nums text-text-muted">
                {segment.value}
                <span className="text-text-subtle"> · {portion}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityList({ items, emptyMessage, renderItem }) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon="Inbox"
        title="Nothing here yet"
        description={emptyMessage}
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item._id ?? item.id} className="px-5 py-3">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

function ActivityListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton variant="circle" className="h-9 w-9" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" className="h-3 w-32" />
            <Skeleton variant="text" className="h-3 w-48" />
          </div>
          <Skeleton variant="text" className="h-3 w-14" />
        </li>
      ))}
    </ul>
  );
}

function ActivityCard({ title, subtitle, footer, loading, children }) {
  return (
    <section className="rounded-2xl border border-border bg-bg shadow-xs flex flex-col">
      <header className="px-5 pt-5 pb-3 border-b border-border">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        )}
      </header>
      <div className="flex-1 min-h-0">
        {loading ? <ActivityListSkeleton /> : children}
      </div>
      {footer && (
        <footer className="border-t border-border px-5 py-3 text-right">
          {footer}
        </footer>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function AdminDashboardPage() {
  useDocumentTitle('Admin Dashboard');

  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [pendingCourses, setPendingCourses] = useState([]);

  const [loading, setLoading] = useState({
    stats: true,
    users: true,
    pending: true,
  });
  const [errors, setErrors] = useState({
    stats: null,
    users: null,
    pending: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [statsRes, usersRes, pendingRes] = await Promise.allSettled([
        getStats(),
        listUsers({ sort: 'newest', limit: 10 }),
        getPendingCourses({ limit: 10 }),
      ]);

      if (cancelled) return;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value?.data ?? null);
        setErrors((p) => ({ ...p, stats: null }));
      } else {
        setErrors((p) => ({
          ...p,
          stats: statsRes.reason?.response?.data?.message ?? 'Failed to load stats.',
        }));
      }
      setLoading((p) => ({ ...p, stats: false }));

      if (usersRes.status === 'fulfilled') {
        setRecentUsers(usersRes.value?.data?.items ?? []);
        setErrors((p) => ({ ...p, users: null }));
      } else {
        setErrors((p) => ({
          ...p,
          users:
            usersRes.reason?.response?.data?.message ??
            'Failed to load registrations.',
        }));
      }
      setLoading((p) => ({ ...p, users: false }));

      if (pendingRes.status === 'fulfilled') {
        setPendingCourses(pendingRes.value?.data?.items ?? []);
        setErrors((p) => ({ ...p, pending: null }));
      } else {
        setErrors((p) => ({
          ...p,
          pending:
            pendingRes.reason?.response?.data?.message ??
            'Failed to load submissions.',
        }));
      }
      setLoading((p) => ({ ...p, pending: false }));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------ derived ----------------------------------- */

  const enrollmentSeries = useMemo(
    () => buildEnrollmentSeries(stats?.enrollments),
    [stats?.enrollments],
  );

  const statusBreakdown = useMemo(() => {
    const courses = stats?.courses ?? {};
    return STATUS_LEGEND.map((entry) => ({
      ...entry,
      value: courses[entry.key] ?? 0,
    }));
  }, [stats?.courses]);

  /* ------------------------------ render ----------------------------------- */

  return (
    <div className="space-y-8">
      <PageHeader />

      {/* Stat strip ---------------------------------------------------------- */}
      {loading.stats ? (
        <StatsStripSkeleton />
      ) : errors.stats ? (
        <ErrorPanel message={errors.stats} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            to={ROUTES.adminUsers}
            label="Users"
            value={number.format(stats?.users?.total ?? 0)}
            icon="Users"
            hint={
              stats
                ? `${number.format(stats.users.activeToday)} active today`
                : undefined
            }
          />
          <StatCard
            to={ROUTES.adminCourses}
            label="Courses"
            value={number.format(stats?.courses?.total ?? 0)}
            icon="BookOpen"
            hint={
              stats
                ? `${stats.courses.published} published · ${stats.courses.pending} pending`
                : undefined
            }
          />
          <StatCard
            to={ROUTES.adminCourses}
            label="Enrollments"
            value={compact.format(stats?.enrollments?.total ?? 0)}
            icon="UserCheck"
            hint={
              stats
                ? `${number.format(stats.enrollments.last7Days)} in the last 7 days`
                : undefined
            }
          />
          <StatCard
            to={ROUTES.adminCourses}
            label="Quiz attempts"
            value={compact.format(stats?.quizAttempts?.total ?? 0)}
            icon="ClipboardCheck"
            hint={
              stats
                ? `${stats.quizAttempts.passRate}% pass rate`
                : undefined
            }
          />
        </div>
      )}

      {/* Charts row ---------------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Enrollments — last 30 days"
          subtitle="Recent activity, with the past week emphasised"
          loading={loading.stats}
        >
          <EnrollmentBarChart series={enrollmentSeries} />
        </ChartCard>

        <ChartCard
          title="Course status distribution"
          subtitle={`${number.format(stats?.courses?.total ?? 0)} courses across the catalog`}
          loading={loading.stats}
        >
          <StatusDonutChart data={statusBreakdown} />
        </ChartCard>
      </div>

      {/* Recent activity ----------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ActivityCard
          title="New registrations"
          subtitle="Latest 10 accounts created"
          loading={loading.users}
          footer={
            <Link
              to={ROUTES.adminUsers}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all users →
            </Link>
          }
        >
          {errors.users ? (
            <InlineError message={errors.users} />
          ) : (
            <ActivityList
              items={recentUsers}
              emptyMessage="New accounts will appear here as people sign up."
              renderItem={(user) => (
                <Link
                  to={ROUTES.profile(user._id)}
                  className="flex items-center gap-3 group"
                >
                  <Avatar
                    size="md"
                    src={user.avatar}
                    name={user.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-text group-hover:text-primary">
                        {user.name}
                      </span>
                      <RoleBadge role={user.role} />
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      {user.email}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-subtle whitespace-nowrap">
                    {formatRelativeTime(user.createdAt)}
                  </span>
                </Link>
              )}
            />
          )}
        </ActivityCard>

        <ActivityCard
          title="Course submissions"
          subtitle="Latest 10 courses awaiting review"
          loading={loading.pending}
          footer={
            <Link
              to={ROUTES.adminPending}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open review queue →
            </Link>
          }
        >
          {errors.pending ? (
            <InlineError message={errors.pending} />
          ) : (
            <ActivityList
              items={pendingCourses}
              emptyMessage="When instructors submit courses for review they'll show up here."
              renderItem={(course) => (
                <div className="flex items-center gap-3">
                  <CourseThumbnail course={course} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">
                      {course.title ?? 'Untitled course'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="truncate">
                        by {course.instructor?.name ?? 'Unknown instructor'}
                      </span>
                      <StatusBadge status={course.status} />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-text-subtle whitespace-nowrap">
                    {formatRelativeTime(course.updatedAt ?? course.createdAt)}
                  </span>
                </div>
              )}
            />
          )}
        </ActivityCard>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tiny shared helpers                                                       */
/* -------------------------------------------------------------------------- */

function CourseThumbnail({ course }) {
  const url =
    typeof course?.thumbnail === 'string'
      ? course.thumbnail
      : course?.thumbnail?.url;
  return (
    <div
      className={cn(
        'relative h-10 w-16 shrink-0 overflow-hidden rounded-md',
        'bg-bg-muted ring-1 ring-border',
      )}
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
        <div className="flex h-full w-full items-center justify-center text-primary/70">
          <Icon name="BookOpen" size={16} />
        </div>
      )}
    </div>
  );
}

function ErrorPanel({ message }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
      <div className="flex items-start gap-3">
        <Icon name="AlertTriangle" size={18} className="mt-0.5" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function InlineError({ message }) {
  return (
    <div className="px-5 py-6 text-sm text-danger flex items-start gap-2">
      <Icon name="AlertTriangle" size={16} className="mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
