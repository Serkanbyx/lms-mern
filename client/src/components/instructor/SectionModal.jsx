/**
 * `SectionModal` — single-field dialog for creating or renaming a section.
 *
 * The section schema only exposes a `title` to the authoring UI
 * (`courseId` and `order` are server-derived), so the modal is reduced
 * to one validated input. Both create and edit flows share this view —
 * the parent toggles `mode` and provides the handler.
 *
 * Validation mirrors `Section.model.js` (3–120 chars). The form refuses
 * to submit while empty / out of bounds and surfaces inline guidance so
 * the request never round-trips an obvious mistake.
 */

import { useEffect, useRef, useState } from 'react';

import {
  Button,
  FormField,
  Input,
  Modal,
  toast,
} from '../ui/index.js';

const TITLE_MIN = 3;
const TITLE_MAX = 120;

const validateTitle = (value) => {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < TITLE_MIN) {
    return `Title must be at least ${TITLE_MIN} characters.`;
  }
  if (trimmed.length > TITLE_MAX) {
    return `Title must be at most ${TITLE_MAX} characters.`;
  }
  return '';
};

export function SectionModal({
  open,
  mode = 'create',
  initialTitle = '',
  onClose,
  onSubmit,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setError('');
    setSubmitting(false);
    // Defer focus until after the framer-motion enter animation settles
    // so the focus trap doesn't fight the panel mount.
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, initialTitle]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateTitle(title);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.(title.trim());
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Could not save section. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => null : onClose}
      title={mode === 'create' ? 'Add a section' : 'Rename section'}
      description={
        mode === 'create'
          ? 'Sections group related lessons into chapters.'
          : 'Pick a clear, descriptive name learners will recognize.'
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={Boolean(validateTitle(title))}
          >
            {mode === 'create' ? 'Create section' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Section title"
          required
          error={error}
          helper={`${TITLE_MIN}–${TITLE_MAX} characters.`}
        >
          {(props) => (
            <Input
              {...props}
              ref={inputRef}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Getting started"
              maxLength={TITLE_MAX}
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
}

export default SectionModal;
