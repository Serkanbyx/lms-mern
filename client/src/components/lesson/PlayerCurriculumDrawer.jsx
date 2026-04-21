/**
 * `PlayerCurriculumDrawer` — left rail of the lesson player.
 *
 * Two visual states driven by `collapsed`:
 *   - Expanded (280px): full section accordions with lesson rows. Each
 *     row shows a completion check, the lesson title + duration, a
 *     quiz badge when present, and a highlighted `aria-current` style
 *     for the lesson the user is currently watching.
 *   - Collapsed (52px icon strip): a vertical stack of dots (one per
 *     lesson) that double as quick-jump buttons. Hover a dot → tooltip
 *     with the lesson title.
 *
 * Defensive: even though `EnrolledRoute` should make non-enrolled
 * access impossible, locked rows are rendered (with a Lock icon and
 * disabled affordance) when a server-projected lesson lacks
 * `videoUrl`/`content` — the curriculum endpoint is the source of
 * truth for what the viewer is allowed to play.
 *
 * Keyboard:
 *   - Tab into the drawer focuses the first lesson row.
 *   - Up / Down move focus between adjacent visible lesson buttons,
 *     wrapping at the ends. Home / End jump to first / last.
 *   - Enter / Space activate the focused row (delegated to the
 *     button's native behavior — no custom handling required).
 */

import { useEffect, useMemo, useState } from 'react';

import { Icon, IconButton, Tooltip } from '../ui/index.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { cn } from '../../utils/cn.js';

// Roving keyboard navigation across the (visible) lesson list. Up/Down
// moves focus between lesson buttons, Home/End jump to first/last,
// Enter / Space activate (delegated to the button's native behavior).
const handleListKeyDown = (event) => {
  const { key } = event;
  if (
    key !== 'ArrowDown' &&
    key !== 'ArrowUp' &&
    key !== 'Home' &&
    key !== 'End'
  ) {
    return;
  }

  const root = event.currentTarget;
  const buttons = Array.from(
    root.querySelectorAll('button[data-lesson-button]:not([disabled])'),
  );
  if (buttons.length === 0) return;

  const currentIndex = buttons.indexOf(document.activeElement);
  let nextIndex = currentIndex;

  if (key === 'ArrowDown') {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
  } else if (key === 'ArrowUp') {
    nextIndex =
      currentIndex < 0
        ? buttons.length - 1
        : (currentIndex - 1 + buttons.length) % buttons.length;
  } else if (key === 'Home') {
    nextIndex = 0;
  } else if (key === 'End') {
    nextIndex = buttons.length - 1;
  }

  if (nextIndex === currentIndex) return;
  event.preventDefault();
  buttons[nextIndex]?.focus();
};

const LessonRow = ({ lesson, isActive, isCompleted, isLocked, onSelect }) => {
  const baseClasses =
    'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors';

  const stateClasses = isActive
    ? 'bg-primary/15 text-text ring-1 ring-inset ring-primary/40'
    : isLocked
      ? 'text-text-subtle cursor-not-allowed'
      : 'text-text-muted hover:bg-bg-muted hover:text-text';

  return (
    <li>
      <button
        type="button"
        data-lesson-button
        onClick={() => !isLocked && onSelect(lesson)}
        disabled={isLocked}
        aria-current={isActive ? 'true' : undefined}
        className={cn(baseClasses, stateClasses)}
      >
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
            isCompleted
              ? 'bg-success text-white'
              : isActive
                ? 'bg-primary text-primary-fg'
                : 'border border-border-strong text-text-subtle',
          )}
          aria-hidden="true"
        >
          {isCompleted ? (
            <Icon name="Check" size={12} strokeWidth={3} />
          ) : isLocked ? (
            <Icon name="Lock" size={11} />
          ) : lesson.type === 'text' ? (
            <Icon name="FileText" size={11} />
          ) : (
            <Icon name="Play" size={11} />
          )}
        </span>

        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium leading-tight">
            {lesson.title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-text-subtle tabular-nums">
            {formatDuration(lesson.duration)}
            {lesson.hasQuiz && (
              <span className="inline-flex items-center gap-0.5 text-info">
                <Icon name="ListChecks" size={10} />
                Quiz
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
};

const SectionGroup = ({
  section,
  sectionIndex,
  defaultOpen,
  currentLessonId,
  completedSet,
  onSelect,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  // Reopen the section whenever the active lesson moves into it (e.g. via
  // keyboard nav or the resume-from-last-accessed flow).
  useEffect(() => {
    if (
      currentLessonId &&
      section.lessons?.some(
        (lesson) => String(lesson._id) === String(currentLessonId),
      )
    ) {
      setOpen(true);
    }
  }, [currentLessonId, section.lessons]);

  const lessons = section.lessons ?? [];
  const completedCount = lessons.reduce(
    (sum, lesson) =>
      sum + (completedSet.has(String(lesson._id)) ? 1 : 0),
    0,
  );

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted hover:bg-bg-muted/60"
      >
        <Icon
          name="ChevronRight"
          size={14}
          className={cn(
            'shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-muted text-[10px] text-text-muted">
          {sectionIndex + 1}
        </span>
        <span className="flex-1 truncate normal-case text-sm font-semibold text-text">
          {section.title}
        </span>
        <span className="shrink-0 text-[11px] font-normal text-text-subtle tabular-nums">
          {completedCount}/{lessons.length}
        </span>
      </button>

      {open && (
        <ul className="space-y-0.5 px-2 pb-2">
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson._id}
              lesson={lesson}
              isActive={String(lesson._id) === String(currentLessonId)}
              isCompleted={completedSet.has(String(lesson._id))}
              isLocked={
                lesson.type === 'video'
                  ? !lesson.videoUrl
                  : !lesson.content
              }
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const CollapsedStrip = ({
  flatLessons,
  currentLessonId,
  completedSet,
  onSelect,
  onExpand,
}) => (
  <div className="flex h-full w-[52px] shrink-0 flex-col border-r border-border bg-bg-subtle/60">
    <div className="flex h-12 items-center justify-center border-b border-border">
      <IconButton
        aria-label="Expand curriculum"
        onClick={onExpand}
        variant="ghost"
        className="h-9 w-9"
      >
        <Icon name="PanelLeftOpen" size={18} />
      </IconButton>
    </div>

    {/* The <ul> is purely a layout container; the only "interactive"
        targets are the lesson <button>s inside. We delegate the
        Up/Down/Home/End focus shortcuts here as a roving-tabindex
        helper, which jsx-a11y can't recognise as essential. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
    <ul
      onKeyDown={handleListKeyDown}
      className="flex-1 space-y-1 overflow-y-auto px-2 py-3"
    >
      {flatLessons.map((lesson) => {
        const isActive = String(lesson._id) === String(currentLessonId);
        const isCompleted = completedSet.has(String(lesson._id));
        return (
          <li key={lesson._id} className="flex justify-center">
            <Tooltip content={lesson.title} side="right">
              <button
                type="button"
                data-lesson-button
                onClick={() => onSelect(lesson)}
                aria-label={lesson.title}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                  isCompleted
                    ? 'bg-success text-white'
                    : isActive
                      ? 'bg-primary text-primary-fg ring-2 ring-primary/30'
                      : 'border border-border-strong text-text-muted hover:border-primary hover:text-primary',
                )}
              >
                {isCompleted ? (
                  <Icon name="Check" size={12} strokeWidth={3} />
                ) : (
                  lesson.order + 1
                )}
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  </div>
);

export function PlayerCurriculumDrawer({
  sections = [],
  currentLessonId,
  completedLessonIds = [],
  collapsed = false,
  onToggleCollapsed,
  onSelectLesson,
  className,
}) {
  const completedSet = useMemo(
    () => new Set(completedLessonIds.map(String)),
    [completedLessonIds],
  );

  const flatLessons = useMemo(
    () =>
      sections.flatMap((section, sIdx) =>
        (section.lessons ?? []).map((lesson, lIdx) => ({
          ...lesson,
          order: sIdx * 100 + lIdx,
        })),
      ),
    [sections],
  );

  if (collapsed) {
    return (
      <CollapsedStrip
        flatLessons={flatLessons}
        currentLessonId={currentLessonId}
        completedSet={completedSet}
        onSelect={onSelectLesson}
        onExpand={() => onToggleCollapsed?.(false)}
      />
    );
  }

  // Decide which section is initially open: the one containing the
  // active lesson if we have one, otherwise the very first section.
  const activeSectionIndex = sections.findIndex((section) =>
    (section.lessons ?? []).some(
      (lesson) => String(lesson._id) === String(currentLessonId),
    ),
  );

  return (
    <aside
      className={cn(
        'flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-bg-subtle/60',
        className,
      )}
      aria-label="Course curriculum"
    >
      <header className="flex h-12 items-center justify-between gap-2 border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Course content
        </span>
        <IconButton
          aria-label="Collapse curriculum"
          onClick={() => onToggleCollapsed?.(true)}
          variant="ghost"
          className="h-8 w-8"
        >
          <Icon name="PanelLeftClose" size={16} />
        </IconButton>
      </header>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <ul
        onKeyDown={handleListKeyDown}
        className="flex-1 overflow-y-auto"
      >
        {sections.map((section, index) => (
          <SectionGroup
            key={section._id ?? `section-${index}`}
            section={section}
            sectionIndex={index}
            defaultOpen={
              activeSectionIndex === -1 ? index === 0 : index === activeSectionIndex
            }
            currentLessonId={currentLessonId}
            completedSet={completedSet}
            onSelect={onSelectLesson}
          />
        ))}
      </ul>
    </aside>
  );
}

export default PlayerCurriculumDrawer;
