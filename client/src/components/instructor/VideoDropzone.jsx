/**
 * `VideoDropzone` — drag-and-drop Cloudinary uploader for lesson videos.
 *
 * Mirrors `ImageDropzone` but tuned for video:
 *   - Accepts MP4 / WebM / MOV up to 500 MB (sanity cap before the
 *     request even leaves the browser).
 *   - Surfaces an inline `<video>` preview once the upload settles.
 *   - On replace, the prior Cloudinary asset is fire-and-forget destroyed
 *     so the account doesn't accumulate orphan uploads when an
 *     instructor swaps takes mid-session.
 *
 * The Cloudinary response includes a `duration` (seconds) which we hand
 * back to the parent so the lesson form can pre-fill its duration field
 * — saving the instructor a manual measurement.
 *
 * Fully controlled. Parent owns `value`; internal state is limited to
 * upload progress + transient error display.
 */

import { useCallback, useId, useRef, useState } from 'react';

import { Button, Icon, IconButton, ProgressBar, toast } from '../ui/index.js';
import { uploadVideo, deleteAsset } from '../../services/upload.service.js';
import { UPLOAD_RESOURCE_TYPES } from '../../utils/constants.js';
import { cn } from '../../utils/cn.js';

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_BYTES = 500 * 1024 * 1024;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

export function VideoDropzone({
  value,
  onChange,
  disabled = false,
  className,
  helperText = 'MP4 / WebM / MOV up to 500 MB',
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const hasVideo = Boolean(value?.url);

  const validate = useCallback((file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Unsupported format. Use MP4, WebM, or MOV.';
    }
    if (file.size > MAX_BYTES) {
      return `File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_BYTES)}.`;
    }
    return '';
  }, []);

  const cleanupPrevious = useCallback(async (previousPublicId) => {
    if (!previousPublicId) return;
    try {
      await deleteAsset(previousPublicId, UPLOAD_RESOURCE_TYPES.video);
    } catch {
      // Best-effort orphan cleanup; the new asset is already saved.
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
        const result = await uploadVideo(file, setProgress);
        onChange?.({
          url: result.url,
          publicId: result.publicId,
          duration: Math.round(Number(result.duration) || 0),
        });
        await cleanupPrevious(previousPublicId);
        toast.success('Video uploaded.');
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
    onChange?.({ url: '', publicId: '', duration: 0 });
    setError('');
    if (publicId) {
      try {
        await deleteAsset(publicId, UPLOAD_RESOURCE_TYPES.video);
      } catch {
        // Best-effort cleanup; the form already reflects an empty video.
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
        {hasVideo ? (
          <>
            <video
              src={value.url}
              controls
              preload="metadata"
              className="h-full w-full object-cover bg-black"
            >
              <track kind="captions" />
            </video>
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                leftIcon={<Icon name="Upload" size={14} />}
              >
                Replace
              </Button>
              <IconButton
                aria-label="Remove video"
                variant="danger"
                onClick={handleRemove}
                disabled={uploading}
              >
                <Icon name="Trash2" size={16} />
              </IconButton>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
            )}
          >
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon name="Video" size={22} />
            </span>
            <span className="text-sm font-medium text-text">
              Drag & drop a video file
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

export default VideoDropzone;
