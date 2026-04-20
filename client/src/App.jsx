/**
 * Top-level route table.
 *
 * Layout strategy:
 *  - `MainLayout` is the default chrome (Navbar + Footer) and wraps every
 *    public + most authenticated routes via a layout route.
 *  - `LearnLayout` replaces the chrome for the lesson player + quiz so
 *    the player canvas owns the viewport.
 *  - `SettingsLayout` and `AdminLayout` provide nested side-nav shells.
 *
 * Guard composition:
 *  - Guards are React components that wrap the layout/page they protect
 *    (`<ProtectedRoute><Layout /></ProtectedRoute>`). Because each guard
 *    waits for `loading` before deciding, a refresh on a protected URL
 *    no longer flashes the login screen.
 *  - `EnrolledRoute` is composed inside `LearnLayout` because the slug
 *    URL param is required to verify enrollment.
 *
 * Lazy loading:
 *  - Every page is wrapped in `React.lazy` so the initial bundle stays
 *    light. The Suspense fallback (`<RouteSkeleton />`) is mounted by
 *    each layout so route-level chunk loads never blank out the chrome.
 *
 * StyleGuide:
 *  - `/styleguide` is gated by `import.meta.env.DEV` so the visual QA
 *    surface never ships in production builds.
 */

import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import {
  AdminRoute,
  EnrolledRoute,
  GuestOnlyRoute,
  InstructorRoute,
  ProtectedRoute,
} from './components/guards/index.js';
import AdminLayout from './layouts/AdminLayout.jsx';
import LearnLayout from './layouts/LearnLayout.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import SettingsLayout from './layouts/SettingsLayout.jsx';

// Public
const LandingPage = lazy(() => import('./pages/public/LandingPage.jsx'));
const CourseCatalogPage = lazy(() =>
  import('./pages/public/CourseCatalogPage.jsx'),
);
const CourseDetailPage = lazy(() =>
  import('./pages/public/CourseDetailPage.jsx'),
);
const BecomeInstructorPage = lazy(() =>
  import('./pages/public/BecomeInstructorPage.jsx'),
);
const PublicProfilePage = lazy(() =>
  import('./pages/public/PublicProfilePage.jsx'),
);
const AboutPage = lazy(() => import('./pages/public/AboutPage.jsx'));
const TermsPage = lazy(() => import('./pages/public/TermsPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/public/PrivacyPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage.jsx'));

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage.jsx'),
);

// Student
const StudentDashboardPage = lazy(() =>
  import('./pages/student/StudentDashboardPage.jsx'),
);
const LessonPlayerPage = lazy(() =>
  import('./pages/student/LessonPlayerPage.jsx'),
);
const QuizPage = lazy(() => import('./pages/student/QuizPage.jsx'));

// Instructor
const InstructorDashboardPage = lazy(() =>
  import('./pages/instructor/InstructorDashboardPage.jsx'),
);
const CourseCreatePage = lazy(() =>
  import('./pages/instructor/CourseCreatePage.jsx'),
);
const CourseEditPage = lazy(() =>
  import('./pages/instructor/CourseEditPage.jsx'),
);
const CurriculumBuilderPage = lazy(() =>
  import('./pages/instructor/CurriculumBuilderPage.jsx'),
);
const QuizBuilderPage = lazy(() =>
  import('./pages/instructor/QuizBuilderPage.jsx'),
);

// Settings
const SettingsProfilePage = lazy(() =>
  import('./pages/settings/ProfilePage.jsx'),
);
const SettingsAccountPage = lazy(() =>
  import('./pages/settings/AccountPage.jsx'),
);
const SettingsAppearancePage = lazy(() =>
  import('./pages/settings/AppearancePage.jsx'),
);
const SettingsPrivacyPage = lazy(() =>
  import('./pages/settings/PrivacyPage.jsx'),
);
const SettingsNotificationsPage = lazy(() =>
  import('./pages/settings/NotificationsPage.jsx'),
);
const SettingsPlaybackPage = lazy(() =>
  import('./pages/settings/PlaybackPage.jsx'),
);

// Admin
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage.jsx'),
);
const AdminUsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'));
const AdminCoursesPage = lazy(() => import('./pages/admin/CoursesPage.jsx'));
const AdminPendingReviewPage = lazy(() =>
  import('./pages/admin/PendingReviewPage.jsx'),
);

// Dev-only
const StyleGuidePage = lazy(() => import('./pages/dev/StyleGuidePage.jsx'));

export default function App() {
  return (
    <Routes>
      {/* Public + most authenticated routes share `MainLayout`. */}
      <Route element={<MainLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="courses" element={<CourseCatalogPage />} />
        <Route path="courses/:slug" element={<CourseDetailPage />} />
        <Route path="teach" element={<BecomeInstructorPage />} />
        <Route path="u/:userId" element={<PublicProfilePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />

        <Route element={<GuestOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<StudentDashboardPage />} />
        </Route>

        <Route element={<InstructorRoute />}>
          <Route path="instructor" element={<InstructorDashboardPage />} />
          <Route
            path="instructor/courses/new"
            element={<CourseCreatePage />}
          />
          <Route
            path="instructor/courses/:id/edit"
            element={<CourseEditPage />}
          />
          <Route
            path="instructor/courses/:id/curriculum"
            element={<CurriculumBuilderPage />}
          />
          <Route
            path="instructor/lessons/:id/quiz"
            element={<QuizBuilderPage />}
          />
        </Route>

        {import.meta.env.DEV && (
          <Route path="styleguide" element={<StyleGuidePage />} />
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Settings — nested layout under `ProtectedRoute`. */}
      <Route
        path="settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SettingsProfilePage />} />
        <Route path="account" element={<SettingsAccountPage />} />
        <Route path="appearance" element={<SettingsAppearancePage />} />
        <Route path="privacy" element={<SettingsPrivacyPage />} />
        <Route path="notifications" element={<SettingsNotificationsPage />} />
        <Route path="playback" element={<SettingsPlaybackPage />} />
      </Route>

      {/* Admin — nested layout under `AdminRoute`. */}
      <Route
        path="admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="courses" element={<AdminCoursesPage />} />
        <Route path="pending" element={<AdminPendingReviewPage />} />
      </Route>

      {/* Lesson player + quiz — minimal `LearnLayout`, enrollment-gated.
          Declared as a layout route (no `path`) so `/courses/:slug` keeps
          matching the public detail page above; only the deeper learn /
          quiz URLs slide into this dark, full-bleed shell. */}
      <Route
        element={
          <EnrolledRoute>
            <LearnLayout />
          </EnrolledRoute>
        }
      >
        <Route
          path="courses/:slug/learn"
          element={<LessonPlayerPage />}
        />
        <Route
          path="courses/:slug/learn/:lessonId"
          element={<LessonPlayerPage />}
        />
        <Route
          path="courses/:slug/quiz/:quizId"
          element={<QuizPage />}
        />
      </Route>
    </Routes>
  );
}
