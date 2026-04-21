/**
 * `ImageDropzone` — drag-and-drop cover image picker for the course form.
 *
 * Handles the full lifecycle of a Cloudinary-backed thumbnail:
 *   1. Accepts a drop OR click-to-pick from the local filesystem.
 *   2. Validates MIME type + size client-side BEFORE the upload starts so
 *      bad files never burn an HTTP round-trip.
 *   3. Streams the upload via `upload.uploadImage`, surfacing progress.
 *   4. On success, calls `onChange({ url, publicId })`. If a previous asset
 *      exists, it is fire-and-forget deleted from Cloudinary so we don't
 *      leak orphaned uploads when the instructor swaps the cover.
 *   5. "Remove" wipes both the form state and the remote asset.
 *
 * The component is fully controlled — the parent owns `value`. Internal
 * state is limited to ephemeral upload progress + error display.
 */

import { useCallback, useId, useRef, useState } from 'react';

import { Button, Icon, IconButton, ProgressBar, toast } from '../ui/index.js';
import { uploadImage, deleteAsset } from '../../services/upload.service.js';
import { UPLOAD_RESOURCE_TYPES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

export function ImageDropzone({
  value,
  onChange,
  disabled = false,
  className,
  helperText = 'Recommended 1280×720 · JPG / PNG / WebP up to 5 MB',
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const hasImage = Boolean(value?.url);

  const validate = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Unsupported format. Use JPG, PNG, or WebP.';
    }
    if (file.size > MAX_BYTES) {
      return `File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_BYTES)}.`;
    }
    return '';
  }, []);

  const cleanupPrevious = useCallback(async (previousPublicId) => {
    if (!previousPublicId) return;
    try {
      await deleteAsset(previousPublicId, UPLOAD_RESOURCE_TYPES.image);
    } catch {
      // Silent — orphan cleanup is best-effort. The new asset is already
      // saved, so the form remains in a consistent state for the user.
    }
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file || disabled) return;
      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        toast.error(validationError);
        return;
      }

      setError('');
      setUploading(true);
      setProgress(0);

      const previousPublicId = value?.publicId;

      try {
        const result = await uploadImage(file, setProgress);
        onChange?.({ url: result.url, publicId: result.publicId });
        await cleanupPrevious(previousPublicId);
        toast.success('Cover image updated.');
      } catch (err) {
        const message =
          err?.response?.data?.message ??
          err?.message ??
          'Upload failed. Please try again.';
        setError(message);
        toast.error(message);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [cleanupPrevious, disabled, onChange, validate, value?.publicId],
  );

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (disabled || uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!disabled && !uploading) setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleRemove = useCallback(async () => {
    if (uploading) return;
    const publicId = value?.publicId;
    onChange?.({ url: '', publicId: '' });
    setError('');
    if (publicId) {
      try {
        await deleteAsset(publicId, UPLOAD_RESOURCE_TYPES.image);
      } catch {
        // Best-effort — the form already reflects an empty thumbnail so
        // the user can move on even if the remote delete glitched.
      }
    }
  }, [onChange, uploading, value?.publicId]);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnter={handleDragOver}
        className={cn(
          'relative overflow-hidden rounded-xl border-2 border-dashed transition-colors',
          'aspect-video bg-bg-subtle',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border-strong hover:border-primary/60',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        {hasImage ? (
          <>
            <img
              src={value.url}
              alt="Course cover preview"
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-end justify-end p-3 bg-gradient-to-t from-black/60 via-black/0 to-transparent">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  leftIcon={<Icon name="ImageUp" size={14} />}
                >
                  Replace
                </Button>
                <IconButton
                  aria-label="Remove cover image"
                  variant="danger"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <Icon name="Trash2" size={16} />
                </IconButton>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center',
              'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
            )}
          >
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon name="ImagePlus" size={22} />
            </span>
            <span className="text-sm font-medium text-text">
              Drag & drop a cover image
            </span>
            <span className="text-xs text-text-muted">
              or click to browse — {helperText}
            </span>
          </button>
        )}

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 bg-bg/90 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <span>Uploading…</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <ProgressBar value={progress} max={100} />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default ImageDropzone;
