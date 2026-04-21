/**
 * Settings → Account.
 *
 * Three independent panels:
 *   1. Email (read-only) — surfacing it under Account avoids the
 *      classic "where do I change my email?" hunt; even though the
 *      field is locked, putting it here matches user expectation.
 *   2. Change password — explicit submit, requires the current
 *      password (server-enforced; the client mirrors that contract
 *      so validation errors surface inline before the round-trip).
 *   3. Delete account — danger zone, gated by a `Modal` that
 *      requires the user to retype their password AND the literal
 *      string "DELETE" so they cannot fat-finger the action.
 *
 * On successful deletion we logout (which also clears the token and
 * redirects to `/login`).
 */

import { useState } from 'react';

import {
  Alert,
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';

const PASSWORD_MIN = 8;
const DELETE_CONFIRMATION = 'DELETE';

const validatePasswordChange = ({ currentPassword, newPassword, confirm }) => {
  const errors = {};
  if (!currentPassword) {
    errors.currentPassword = 'Enter your current password.';
  }
  if (!newPassword) {
    errors.newPassword = 'Enter a new password.';
  } else if (newPassword.length < PASSWORD_MIN) {
    errors.newPassword = `Use at least ${PASSWORD_MIN} characters.`;
  } else if (newPassword === currentPassword) {
    errors.newPassword = 'New password must differ from the current one.';
  }
  if (newPassword && confirm !== newPassword) {
    errors.confirm = 'Passwords do not match.';
  }
  return errors;
};

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

export default function SettingsAccountPage() {
  const { user, logout } = useAuth();
  useDocumentTitle('Account settings');

  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const setPasswordField = (key) => (event) => {
    const value = event.target.value;
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
    if (passwordErrors[key]) {
      setPasswordErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const errors = validatePasswordChange(passwordForm);
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordSubmitting(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success('Password updated.');
    } catch (error) {
      const message =
        error?.response?.data?.message ?? 'Could not update password.';
      // Surface the "current password is incorrect" path inline instead of
      // a transient toast — it's the most common authentication failure
      // and the user shouldn't have to re-read the toast.
      if (error?.response?.status === 401) {
        setPasswordErrors({ currentPassword: message });
      } else {
        toast.error(message);
      }
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      <section aria-labelledby="email-heading" className="space-y-3">
        <header>
          <h2 id="email-heading" className="text-lg font-semibold text-text">
            Email address
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Your sign-in identity. Email changes are not supported yet — reach
            out to support if you need this.
          </p>
        </header>

        <FormField label="Email" hideLabel>
          {(props) => (
            <Input
              {...props}
              type="email"
              value={user?.email ?? ''}
              readOnly
              leadingIcon={<Icon name="Mail" size={16} />}
            />
          )}
        </FormField>
      </section>

      <section aria-labelledby="password-heading" className="space-y-4">
        <header>
          <h2 id="password-heading" className="text-lg font-semibold text-text">
            Change password
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Use at least {PASSWORD_MIN} characters. Mixing letters, numbers and
            symbols makes guessing exponentially harder.
          </p>
        </header>

        <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
          <FormField
            label="Current password"
            required
            error={passwordErrors.currentPassword}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={setPasswordField('currentPassword')}
              />
            )}
          </FormField>

          <FormField
            label="New password"
            required
            error={passwordErrors.newPassword}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={setPasswordField('newPassword')}
              />
            )}
          </FormField>

          <FormField
            label="Confirm new password"
            required
            error={passwordErrors.confirm}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirm}
                onChange={setPasswordField('confirm')}
              />
            )}
          </FormField>

          <div className="flex justify-end">
            <Button type="submit" loading={passwordSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      <section
        aria-labelledby="danger-heading"
        className="rounded-xl border border-danger/30 bg-danger/5 p-5 space-y-4"
      >
        <header className="flex items-start gap-3">
          <span className="mt-0.5 text-danger">
            <Icon name="AlertTriangle" size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="danger-heading" className="text-lg font-semibold text-text">
              Delete account
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              This permanently removes your profile, enrollments, progress, and
              quiz history. This action cannot be undone.
            </p>
          </div>
        </header>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            leftIcon={<Icon name="Trash2" size={16} />}
          >
            Delete my account
          </Button>
        </div>
      </section>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={logout}
      />
    </div>
  );
}

function DeleteAccountModal({ open, onClose, onDeleted }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirmation('');
    setError('');
  };

  const handleClose = () => {
    if (deleting) return;
    onClose();
    reset();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (confirmation !== DELETE_CONFIRMATION) {
      setError(`Type ${DELETE_CONFIRMATION} to confirm.`);
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await authService.deleteAccount({ password });
      toast.success('Your account has been deleted.');
      onDeleted();
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Could not delete account.');
      setDeleting(false);
    }
  };

  const canDelete =
    password.length > 0 &&
    confirmation === DELETE_CONFIRMATION &&
    !deleting;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete account?"
      description="This action is permanent. We cannot recover your data after deletion."
      size="sm"
      showCloseButton={!deleting}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={deleting}>
            Keep account
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={deleting}
            disabled={!canDelete}
          >
            Delete account
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Your password" required>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={deleting}
            />
          )}
        </FormField>
        <FormField
          label={`Type ${DELETE_CONFIRMATION} to confirm`}
          required
          helper="This protects against accidental deletion."
        >
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={deleting}
            />
          )}
        </FormField>
        {error && (
          <Alert variant="danger" title="Couldn't delete account">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
