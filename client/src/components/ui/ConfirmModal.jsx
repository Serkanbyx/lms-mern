/**
 * `ConfirmModal` — opinionated wrapper around `Modal` for the destructive
 * confirmation pattern ("Delete course?", "Unenrol?", "Reject submission?").
 *
 * Standardising this prevents every page from authoring its own subtly
 * different copy, button order, and danger-styling.
 *
 * `loading` keeps the modal open while the async confirm action runs and
 * disables both buttons + shows a spinner inside the confirm button.
 */

import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      showCloseButton={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* Description handled by Modal header; body left empty for room. */}
    </Modal>
  );
}

export default ConfirmModal;
