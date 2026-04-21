/**
 * Settings → Profile.
 *
 * Edits the four fields the auth controller exposes via
 * `PATCH /api/auth/me`: `name`, `headline`, `bio`, `avatar`.
 *
 * Avatar uploads use the same Cloudinary pipeline as the course
 * cover dropzone — a successful upload returns `{ url, publicId }`
 * and we store the URL on the user document. Clearing the avatar
 * fires a best-effort delete on the previous publicId so we don't
 * leave orphans behind.
 *
 * Submit is explicit because changing your displayed name has visible
 * consequences across the app — autosaving every keystroke would feel
 * unsettling.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Avatar,
  Button,
  FormField,
  Icon,
  Input,
  IconButton,
  Spinner,
  Textarea,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as authService from '../../services/auth.service.js';
import * as uploadService from '../../services/upload.service.js';
import { UPLOAD_RESOURCE_TYPES } from '../../utils/constants.js';

const NAME_LIMIT = 60;
const HEADLINE_LIMIT = 120;
const BIO_LIMIT = 500;

const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const buildInitialForm = (user) => ({
  name: user?.name ?? '',
  headline: user?.headline ?? '',
  bio: user?.bio ?? '',
  avatar: user?.avatar ?? '',
});

const isFormDirty = (form, user) => {
  const base = buildInitialForm(user);
  return (
    form.name.trim() !== base.name ||
    form.headline.trim() !== base.headline ||
    form.bio.trim() !== base.bio ||
    form.avatar !== base.avatar
  );
};

const validateForm = (form) => {
  const errors = {};
  const name = form.name.trim();
  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (name.length > NAME_LIMIT) {
    errors.name = `Name must be at most ${NAME_LIMIT} characters.`;
  }
  if (form.headline.length > HEADLINE_LIMIT) {
    errors.headline = `Headline must be at most ${HEADLINE_LIMIT} characters.`;
  }
  if (form.bio.length > BIO_LIMIT) {
    errors.bio = `Bio must be at most ${BIO_LIMIT} characters.`;
  }
  return errors;
};

export default function SettingsProfilePage() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => buildInitialForm(user));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPublicId, setAvatarPublicId] = useState(null);

  useDocumentTitle('Profile settings');

  // Re-seed the form whenever the auth user record updates (initial
  // hydrate, optimistic updates from elsewhere) so we never overwrite
  // a fresher value with a stale one.
  useEffect(() => {
    if (user) {
      setForm(buildInitialForm(user));
      setErrors({});
    }
  }, [user]);

  const dirty = useMemo(() => isFormDirty(form, user), [form, user]);

  const setField = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Unsupported format. Use JPG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Avatar must be 2 MB or smaller.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await uploadService.uploadImage(file);
      setForm((prev) => ({ ...prev, avatar: result.url }));
      setAvatarPublicId(result.publicId ?? null);
      toast.success('Avatar uploaded — save to apply.');
    } catch (error) {
      toast.error(
        error?.response?.data?.message ?? 'Could not upload avatar.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setForm((prev) => ({ ...prev, avatar: '' }));
    if (avatarPublicId) {
      try {
        await uploadService.deleteAsset(
          avatarPublicId,
          UPLOAD_RESOURCE_TYPES.image,
        );
      } catch {
        // Best-effort cleanup — the form already reflects the empty avatar.
      }
      setAvatarPublicId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        avatar: form.avatar,
      };
      const resp = await authService.updateProfile(payload);
      const nextUser = resp?.user ?? null;
      if (nextUser) {
        updateUser(nextUser);
      } else {
        updateUser(payload);
      }
      setAvatarPublicId(null);
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error?.response?.data?.message ?? 'Could not save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(buildInitialForm(user));
    setErrors({});
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8"
      noValidate
      aria-busy={submitting}
    >
      <section aria-labelledby="avatar-heading" className="space-y-3">
        <div>
          <h2 id="avatar-heading" className="text-lg font-semibold text-text">
            Profile photo
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            JPG, PNG, or WebP. Max 2 MB.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              src={form.avatar}
              name={form.name || user?.name}
              size="xl"
              className="h-20 w-20 text-xl"
            />
            {uploadingAvatar && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white">
                <Spinner size="sm" />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAvatarPick}
              disabled={uploadingAvatar}
              leftIcon={<Icon name="ImageUp" size={14} />}
            >
              {form.avatar ? 'Replace' : 'Upload'}
            </Button>
            {form.avatar && (
              <IconButton
                type="button"
                aria-label="Remove avatar"
                variant="ghost"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar}
              >
                <Icon name="Trash2" size={16} />
              </IconButton>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(',')}
              className="sr-only"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
            />
          </div>
        </div>
      </section>

      <FormField label="Display name" required error={errors.name}>
        {(props) => (
          <Input
            {...props}
            type="text"
            value={form.name}
            onChange={setField('name')}
            maxLength={NAME_LIMIT}
            autoComplete="name"
            placeholder="How should we call you?"
          />
        )}
      </FormField>

      <FormField
        label="Headline"
        helper="A one-line tagline shown under your name."
        error={errors.headline}
      >
        {(props) => (
          <Input
            {...props}
            type="text"
            value={form.headline}
            onChange={setField('headline')}
            maxLength={HEADLINE_LIMIT}
            placeholder="e.g. Senior frontend engineer · React enthusiast"
          />
        )}
      </FormField>

      <FormField
        label="Bio"
        helper="Tell other learners and instructors a little about yourself."
        error={errors.bio}
      >
        {(props) => (
          <Textarea
            {...props}
            value={form.bio}
            onChange={setField('bio')}
            rows={5}
            maxLength={BIO_LIMIT}
            showCounter
            autosize
            placeholder="What do you teach? What are you learning right now?"
          />
        )}
      </FormField>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          disabled={!dirty || submitting}
        >
          Discard changes
        </Button>
        <Button
          type="submit"
          loading={submitting}
          disabled={!dirty || uploadingAvatar}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
