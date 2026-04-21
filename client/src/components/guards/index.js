/**
 * Barrel for route guards. Always import via `@/components/guards` so a
 * future re-org (e.g., merging Protected + Enrolled into a HOC factory)
 * never ripples out into the route table.
 */

export { ProtectedRoute } from './ProtectedRoute.jsx';
export { GuestOnlyRoute } from './GuestOnlyRoute.jsx';
export { InstructorRoute } from './InstructorRoute.jsx';
export { AdminRoute } from './AdminRoute.jsx';
export { EnrolledRoute } from './EnrolledRoute.jsx';
export { FullPageSpinner } from './FullPageSpinner.jsx';
export { RedirectWithToast } from './RedirectWithToast.jsx';
