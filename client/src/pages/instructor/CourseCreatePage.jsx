/**
 * Instructor — `/instructor/courses/new`
 *
 * Thin wrapper around `CourseForm` configured in `create` mode. The form
 * owns every interaction; this page is just the page chrome (heading,
 * back link, document title) plus a redirect to the curriculum builder
 * once the draft has been persisted.
 */

import { Link, useNavigate } from 'react-router-dom';

import { Button, Icon } from '../../components/ui/index.js';
import { CourseForm } from '../../components/instructor/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ROUTES } from '../../utils/constants.js';

export default function CourseCreatePage() {
  useDocumentTitle('Create course');
  const navigate = useNavigate();

  const handleCreated = (course) => {
    const id = course?._id ?? course?.id;
    if (!id) return;
    navigate(ROUTES.instructorCurriculum(id));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 lg:py-12 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            to={ROUTES.instructor}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <Icon name="ArrowLeft" size={14} />
            Back to dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
            Create a new course
          </h1>
          <p className="text-text-muted max-w-2xl">
            Outline the basics now — you can keep refining lessons, quizzes,
            and pricing afterwards. Nothing is published until you submit it
            for review.
          </p>
        </div>
        <Link to={ROUTES.instructor}>
          <Button variant="ghost">Cancel</Button>
        </Link>
      </header>

      <CourseForm mode="create" onCreated={handleCreated} />
    </div>
  );
}
