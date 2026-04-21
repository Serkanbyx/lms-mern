/**
 * `CurriculumOutline` — accordion-driven section / lesson tree.
 *
 * Used inside the public detail page's "Curriculum" tab. Each section
 * is an accordion item whose content is the list of lessons it owns;
 * the first section is expanded by default so visitors immediately see
 * concrete lesson titles without an extra click.
 *
 * Per-row affordances:
 *   - Type icon (PlayCircle for video, FileText for text).
 *   - Duration (formatted).
 *   - "Preview" pill on free-preview lessons. Clicking either the row
 *     or the pill triggers `onPreview(lesson)` so the parent can open
 *     the player modal.
 *   - "Quiz" badge when `lesson.hasQuiz` is true.
 *   - Lock icon for locked content (anonymous / non-enrolled visitors).
 *
 * Locked rows are not focusable and never fire a preview — they are
 * informational only.
 */

import { Accordion, Badge, Icon } from '../ui/index.js';
import { formatDuration } from '../../utils/formatDuration.js';

const lessonsTotalDuration = (lessons = []) =>
  lessons.reduce((sum, lesson) => sum + (Number(lesson.duration) || 0), 0);

const LessonRow = ({ lesson, onPreview, viewerCanPlay }) => {
  const canPreview =
    typeof onPreview === 'function' &&
    lesson.type === 'video' &&
    Boolean(lesson.videoUrl) &&
    (lesson.isFreePreview || viewerCanPlay);

  const Wrapper = canPreview ? 'button' : 'div';

  return (
    <li>
      <Wrapper
        type={canPreview ? 'button' : undefined}
        onClick={canPreview ? () => onPreview(lesson) : undefined}
        className={[
          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
          canPreview
            ? 'cursor-pointer text-text hover:bg-bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            : 'text-text',
        ].join(' ')}
      >
        <Icon
          name={
            !canPreview && !lesson.isFreePreview && !viewerCanPlay
              ? 'Lock'
              : lesson.type === 'text'
                ? 'FileText'
                : 'PlayCircle'
          }
          size={16}
          className={
            canPreview
              ? 'text-primary'
              : !lesson.isFreePreview && !viewerCanPlay
                ? 'text-text-subtle'
                : 'text-text-muted'
          }
        />
        <span className="flex-1 truncate">{lesson.title}</span>

        {lesson.hasQuiz && (
          <Badge variant="info" size="sm">
            Quiz
          </Badge>
        )}
        {lesson.isFreePreview && (
          <Badge variant="success" size="sm">
            Preview
          </Badge>
        )}

        <span className="tabular-nums text-xs text-text-muted">
          {formatDuration(lesson.duration)}
        </span>
      </Wrapper>
    </li>
  );
};

export function CurriculumOutline({
  sections = [],
  isEnrolled = false,
  isOwner = false,
  isAdmin = false,
  onPreview,
  className,
}) {
  const viewerCanPlay = isEnrolled || isOwner || isAdmin;
  const totalLessons = sections.reduce(
    (sum, section) => sum + (section.lessons?.length ?? 0),
    0,
  );
  const totalDuration = sections.reduce(
    (sum, section) => sum + lessonsTotalDuration(section.lessons),
    0,
  );

  if (sections.length === 0) {
    return (
      <p className={['text-sm text-text-muted', className].filter(Boolean).join(' ')}>
        The curriculum for this course hasn&apos;t been published yet.
      </p>
    );
  }

  const items = sections.map((section, index) => {
    const lessons = section.lessons ?? [];
    const sectionDuration = formatDuration(lessonsTotalDuration(lessons));
    return {
      id: section._id ?? section.id ?? `section-${index}`,
      title: (
        <span className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="font-medium text-text">{section.title}</span>
        </span>
      ),
      meta: `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} · ${sectionDuration}`,
      content:
        lessons.length === 0 ? (
          <p className="px-3 py-2 text-sm text-text-muted">No lessons in this section yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {lessons.map((lesson) => (
              <LessonRow
                key={lesson._id ?? lesson.id}
                lesson={lesson}
                onPreview={onPreview}
                viewerCanPlay={viewerCanPlay}
              />
            ))}
          </ul>
        ),
    };
  });

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-sm text-text-muted">
        <p>
          <strong className="text-text">{sections.length}</strong>{' '}
          section{sections.length === 1 ? '' : 's'} ·{' '}
          <strong className="text-text">{totalLessons}</strong>{' '}
          lesson{totalLessons === 1 ? '' : 's'} ·{' '}
          <strong className="text-text">{formatDuration(totalDuration)}</strong>{' '}
          total length
        </p>
        {!viewerCanPlay && (
          <p className="inline-flex items-center gap-1.5 text-xs">
            <Icon name="Lock" size={12} />
            Enroll to unlock all lessons
          </p>
        )}
      </div>

      <Accordion items={items} type="multiple" defaultOpen={items[0]?.id} />
    </div>
  );
}

export default CurriculumOutline;
