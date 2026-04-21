/**
 * `CurriculumTree` — left-rail authoring tree.
 *
 * Surfaces the section/lesson hierarchy with full keyboard + drag-and-drop
 * reordering. The component is presentation only; the parent owns state
 * and wires the persistence handlers.
 *
 * Reorder UX
 * ----------
 * Two redundant affordances so the surface is keyboard-accessible without
 * sacrificing pointer ergonomics:
 *   - HTML5 drag events (`draggable` + `dragover` + `drop`) for mouse /
 *     touch users. We use a simple "drag id + drop slot" model rather
 *     than a full motion library — sections and lessons are flat lists
 *     so the math is trivial.
 *   - "Move up / Move down" arrow buttons on each row, surfaced as
 *     `IconButton`s with proper `aria-label`s. Keyboard users can also
 *     hit `Alt+ArrowUp / Alt+ArrowDown` while a row is focused — the
 *     same handler runs regardless of input method.
 *
 * The parent passes `onReorderSections(orderedIds)` and
 * `onReorderLessons(sectionId, orderedIds)`. We commit the new order
 * locally for instant feedback and let the parent debounce the network
 * call (the page debounces 800ms after the last drop / arrow press).
 */

import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Dropdown, Icon, IconButton } from '../ui/index.js';
import { cn } from '../../utils/cn.js';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const formatRuntime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total === 0) return '—';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
};

const moveItem = (items, index, direction) => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(index, 1);
  next.splice(target, 0, removed);
  return next;
};

const lessonIcon = (lesson) => {
  if (lesson.type === 'text') return 'FileText';
  return 'Play';
};

/* -------------------------------------------------------------------------- */
/*  Lesson row                                                                */
/* -------------------------------------------------------------------------- */

function LessonRow({
  lesson,
  index,
  total,
  isActive,
  onSelect,
  onEdit,
  onManageQuiz,
  onDelete,
  onMove,
  dragHandlers,
  isDragOver,
}) {
  const handleKeyDown = (event) => {
    if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(-1);
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <li
      {...dragHandlers}
      className={cn(
        'group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors',
        isActive
          ? 'bg-primary/10 ring-1 ring-inset ring-primary/30'
          : 'hover:bg-bg-muted/70',
        isDragOver && 'border-primary/60 bg-primary/5',
      )}
    >
      <span
        className="cursor-grab text-text-subtle hover:text-text-muted active:cursor-grabbing"
        aria-hidden="true"
        title="Drag to reorder"
      >
        <Icon name="GripVertical" size={14} />
      </span>

      <button
        type="button"
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'flex flex-1 min-w-0 items-center gap-2 text-left outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm',
        )}
      >
        <span
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            isActive
              ? 'bg-primary text-primary-fg'
              : 'bg-bg-muted text-text-muted',
          )}
          aria-hidden="true"
        >
          <Icon name={lessonIcon(lesson)} size={12} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-text">
            {lesson.title}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-subtle tabular-nums">
            {formatRuntime(lesson.duration)}
            {lesson.isFreePreview && (
              <Badge variant="info" size="sm">
                Preview
              </Badge>
            )}
            {lesson.hasQuiz && (
              <span className="inline-flex items-center gap-0.5 text-info">
                <Icon name="ListChecks" size={10} />
                Quiz
              </span>
            )}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          aria-label="Move lesson up"
          variant="ghost"
          size="sm"
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          <Icon name="ChevronUp" size={14} />
        </IconButton>
        <IconButton
          aria-label="Move lesson down"
          variant="ghost"
          size="sm"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
        >
          <Icon name="ChevronDown" size={14} />
        </IconButton>
      </div>

      <Dropdown
        trigger={
          <IconButton aria-label="Lesson actions" variant="ghost" size="sm">
            <Icon name="MoreVertical" size={14} />
          </IconButton>
        }
        align="end"
        items={[
          { id: 'edit', label: 'Edit lesson', icon: 'Pencil', onSelect: onEdit },
          {
            id: 'quiz',
            label: lesson.hasQuiz ? 'Edit quiz' : 'Add quiz',
            icon: 'ListChecks',
            onSelect: onManageQuiz,
          },
          { id: 'sep', separator: true },
          {
            id: 'delete',
            label: 'Delete lesson',
            icon: 'Trash2',
            danger: true,
            onSelect: onDelete,
          },
        ]}
      />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section card                                                              */
/* -------------------------------------------------------------------------- */

function SectionCard({
  section,
  index,
  total,
  defaultOpen,
  activeLessonId,
  onSelectLesson,
  onAddLesson,
  onEditSection,
  onDeleteSection,
  onMoveSection,
  onEditLesson,
  onDeleteLesson,
  onManageQuiz,
  onMoveLesson,
  dragHandlers,
  lessonDragState,
  isDragOver,
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-expand the section that contains the active lesson so the
  // tree stays in sync with the right-pane preview.
  useEffect(() => {
    if (
      activeLessonId &&
      (section.lessons ?? []).some(
        (lesson) => String(lesson._id) === String(activeLessonId),
      )
    ) {
      setOpen(true);
    }
  }, [activeLessonId, section.lessons]);

  const lessons = section.lessons ?? [];
  const totalRuntime = lessons.reduce(
    (sum, lesson) => sum + (Number(lesson.duration) || 0),
    0,
  );

  return (
    <li
      {...dragHandlers}
      className={cn(
        'rounded-xl border bg-bg shadow-xs transition-colors',
        isDragOver
          ? 'border-primary/60 ring-2 ring-primary/20'
          : 'border-border',
      )}
    >
      <header className="flex items-start gap-2 px-3 py-2.5">
        <span
          className="mt-0.5 cursor-grab text-text-subtle hover:text-text-muted active:cursor-grabbing"
          aria-hidden="true"
          title="Drag to reorder section"
        >
          <Icon name="GripVertical" size={14} />
        </span>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        >
          <Icon
            name="ChevronRight"
            size={14}
            className={cn(
              'mt-1 shrink-0 text-text-muted transition-transform',
              open && 'rotate-90',
            )}
          />
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-muted text-[10px] font-semibold text-text-muted">
            {index + 1}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block truncate text-sm font-semibold text-text">
              {section.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-text-subtle tabular-nums">
              {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
              {' · '}
              {formatRuntime(totalRuntime)}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <IconButton
            aria-label="Move section up"
            variant="ghost"
            size="sm"
            onClick={() => onMoveSection(-1)}
            disabled={index === 0}
          >
            <Icon name="ChevronUp" size={14} />
          </IconButton>
          <IconButton
            aria-label="Move section down"
            variant="ghost"
            size="sm"
            onClick={() => onMoveSection(1)}
            disabled={index === total - 1}
          >
            <Icon name="ChevronDown" size={14} />
          </IconButton>
          <Dropdown
            trigger={
              <IconButton aria-label="Section actions" variant="ghost" size="sm">
                <Icon name="MoreVertical" size={14} />
              </IconButton>
            }
            align="end"
            items={[
              {
                id: 'rename',
                label: 'Rename section',
                icon: 'Pencil',
                onSelect: onEditSection,
              },
              {
                id: 'add-lesson',
                label: 'Add lesson',
                icon: 'Plus',
                onSelect: onAddLesson,
              },
              { id: 'sep', separator: true },
              {
                id: 'delete',
                label: 'Delete section',
                icon: 'Trash2',
                danger: true,
                onSelect: onDeleteSection,
              },
            ]}
          />
        </div>
      </header>

      {open && (
        <div className="border-t border-border px-2 py-2">
          {lessons.length === 0 ? (
            <p className="px-2 py-3 text-xs text-text-muted">
              No lessons yet — add the first one to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {lessons.map((lesson, lessonIndex) => (
                <LessonRow
                  key={lesson._id}
                  lesson={lesson}
                  index={lessonIndex}
                  total={lessons.length}
                  isActive={String(activeLessonId) === String(lesson._id)}
                  onSelect={() => onSelectLesson(lesson)}
                  onEdit={() => onEditLesson(lesson)}
                  onManageQuiz={() => onManageQuiz(lesson)}
                  onDelete={() => onDeleteLesson(lesson)}
                  onMove={(direction) =>
                    onMoveLesson(section, lessonIndex, direction)
                  }
                  dragHandlers={lessonDragState.handlersFor(
                    section._id,
                    lesson._id,
                  )}
                  isDragOver={lessonDragState.isOver(section._id, lesson._id)}
                />
              ))}
            </ul>
          )}

          <div className="mt-2 px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddLesson}
              leftIcon={<Icon name="Plus" size={14} />}
              className="text-xs"
            >
              Add lesson
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tree                                                                      */
/* -------------------------------------------------------------------------- */

const noopDragState = {
  handlersFor: () => ({}),
  isOver: () => false,
};

const useDragController = ({ onReorder }) => {
  const draggingId = useRef(null);
  const [overId, setOverId] = useState(null);

  const handlersFor = (id) => ({
    draggable: true,
    onDragStart: (event) => {
      draggingId.current = id;
      event.dataTransfer.effectAllowed = 'move';
      // Some browsers refuse to start the drag without setData.
      try {
        event.dataTransfer.setData('text/plain', String(id));
      } catch {
        // No-op — Safari/Firefox quirk; the in-memory ref is the source
        // of truth so we don't need the data transfer payload.
      }
    },
    onDragEnter: (event) => {
      event.preventDefault();
      if (draggingId.current && draggingId.current !== id) {
        setOverId(id);
      }
    },
    onDragOver: (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: () => {
      setOverId((prev) => (prev === id ? null : prev));
    },
    onDrop: (event) => {
      event.preventDefault();
      const sourceId = draggingId.current;
      draggingId.current = null;
      setOverId(null);
      if (!sourceId || sourceId === id) return;
      onReorder(sourceId, id);
    },
    onDragEnd: () => {
      draggingId.current = null;
      setOverId(null);
    },
  });

  const isOver = (id) => overId === id;

  return { handlersFor, isOver };
};

const useScopedDragController = ({ onReorder }) => {
  // Each section keeps its own drag scope so a lesson dropped on a row
  // in section B never reorders into section A.
  const draggingId = useRef({ scope: null, id: null });
  const [over, setOver] = useState({ scope: null, id: null });

  const handlersFor = (scope, id) => ({
    draggable: true,
    onDragStart: (event) => {
      event.stopPropagation();
      draggingId.current = { scope, id };
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', String(id));
      } catch {
        // No-op.
      }
    },
    onDragEnter: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = draggingId.current;
      if (!current.id) return;
      if (current.scope !== scope) return;
      if (current.id === id) return;
      setOver({ scope, id });
    },
    onDragOver: (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: (event) => {
      event.stopPropagation();
      setOver((prev) =>
        prev.scope === scope && prev.id === id ? { scope: null, id: null } : prev,
      );
    },
    onDrop: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = draggingId.current;
      draggingId.current = { scope: null, id: null };
      setOver({ scope: null, id: null });
      if (!current.id) return;
      if (current.scope !== scope) return;
      if (current.id === id) return;
      onReorder(scope, current.id, id);
    },
    onDragEnd: (event) => {
      event.stopPropagation();
      draggingId.current = { scope: null, id: null };
      setOver({ scope: null, id: null });
    },
  });

  const isOver = (scope, id) => over.scope === scope && over.id === id;

  return { handlersFor, isOver };
};

export function CurriculumTree({
  sections = [],
  activeLessonId,
  onSelectLesson,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onManageQuiz,
  onReorderSections,
  onReorderLessons,
}) {
  const sectionDrag = useDragController({
    onReorder: (sourceId, overIdValue) => {
      const sourceIndex = sections.findIndex((s) => s._id === sourceId);
      const overIndex = sections.findIndex((s) => s._id === overIdValue);
      if (sourceIndex === -1 || overIndex === -1) return;
      const next = [...sections];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(overIndex, 0, removed);
      onReorderSections(next.map((s) => s._id));
    },
  });

  const lessonDrag = useScopedDragController({
    onReorder: (sectionId, sourceLessonId, overLessonId) => {
      const section = sections.find((s) => s._id === sectionId);
      if (!section) return;
      const lessons = section.lessons ?? [];
      const sourceIndex = lessons.findIndex((l) => l._id === sourceLessonId);
      const overIndex = lessons.findIndex((l) => l._id === overLessonId);
      if (sourceIndex === -1 || overIndex === -1) return;
      const next = [...lessons];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(overIndex, 0, removed);
      onReorderLessons(sectionId, next.map((l) => l._id));
    },
  });

  const handleMoveSection = (sectionIndex, direction) => {
    const next = moveItem(sections, sectionIndex, direction);
    if (next === sections) return;
    onReorderSections(next.map((s) => s._id));
  };

  const handleMoveLesson = (section, lessonIndex, direction) => {
    const lessons = section.lessons ?? [];
    const next = moveItem(lessons, lessonIndex, direction);
    if (next === lessons) return;
    onReorderLessons(section._id, next.map((l) => l._id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Curriculum
        </h2>
        <Button
          size="sm"
          variant="primary"
          onClick={onAddSection}
          leftIcon={<Icon name="Plus" size={14} />}
        >
          Add section
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-bg-subtle p-6 text-center">
          <Icon
            name="LayoutList"
            size={26}
            className="mx-auto mb-2 text-text-muted"
          />
          <p className="text-sm font-medium text-text">No sections yet</p>
          <p className="mb-3 text-xs text-text-muted">
            Group lessons into chapters so learners can navigate your course.
          </p>
          <Button
            size="sm"
            onClick={onAddSection}
            leftIcon={<Icon name="Plus" size={14} />}
          >
            Add your first section
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sections.map((section, sectionIndex) => (
            <SectionCard
              key={section._id}
              section={section}
              index={sectionIndex}
              total={sections.length}
              defaultOpen={sections.length <= 4 || sectionIndex === 0}
              activeLessonId={activeLessonId}
              onSelectLesson={onSelectLesson}
              onAddLesson={() => onAddLesson(section)}
              onEditSection={() => onEditSection(section)}
              onDeleteSection={() => onDeleteSection(section)}
              onMoveSection={(direction) =>
                handleMoveSection(sectionIndex, direction)
              }
              onEditLesson={onEditLesson}
              onDeleteLesson={onDeleteLesson}
              onManageQuiz={onManageQuiz}
              onMoveLesson={handleMoveLesson}
              dragHandlers={sectionDrag.handlersFor(section._id)}
              lessonDragState={lessonDrag ?? noopDragState}
              isDragOver={sectionDrag.isOver(section._id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default CurriculumTree;
