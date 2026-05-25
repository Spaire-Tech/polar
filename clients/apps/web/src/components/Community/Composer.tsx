'use client'

import {
  type CommunityTagRead,
  useCreateCommunityPost,
  useUploadPostImage,
  useUploadPostVideo,
} from '@/hooks/queries/community'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import {
  IconFile,
  IconImage,
  IconSend,
  IconSmile,
  IconVideo,
  IconX,
} from './icons'

const MAX_IMAGES = 4
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

type AttachedImage = {
  file_id: string
  preview_url: string
}

type AttachedVideo = {
  upload_id: string
  preview_url: string
  filename: string
  progress: number
}

type Props = {
  token: string
  courseId: string
  selfName?: string | null
  modules: { id: string; label: string }[]
  defaultModuleId?: string | null
  // Available tags surfaced as chips in the modal. When empty, the
  // tag selector is hidden so the creator hasn't accidentally exposed
  // an empty row.
  tags?: CommunityTagRead[]
  forceOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onPosted?: () => void
}

export function Composer({
  token,
  courseId,
  selfName,
  modules,
  defaultModuleId,
  tags = [],
  forceOpen,
  onOpenChange,
  onPosted,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceOpen ?? expanded
  const [body, setBody] = useState('')
  const [lessonModuleId, setLessonModuleId] = useState<string>(
    defaultModuleId ?? '',
  )
  const [tagId, setTagId] = useState<string | null>(null)
  const [images, setImages] = useState<AttachedImage[]>([])
  const [video, setVideo] = useState<AttachedVideo | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const create = useCreateCommunityPost(token, courseId)
  const upload = useUploadPostImage(token, courseId)
  const uploadVideo = useUploadPostVideo(token, courseId)

  // Focus the textarea once the modal mounts.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Esc closes the modal — global key listener stays scoped to the open
  // state so it doesn't capture keys when the composer is collapsed.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const reset = () => {
    setBody('')
    setLessonModuleId(defaultModuleId ?? '')
    setTagId(null)
    setImages([])
    if (video) URL.revokeObjectURL(video.preview_url)
    setVideo(null)
    setUploadError(null)
  }

  const close = () => {
    setExpanded(false)
    onOpenChange?.(false)
    reset()
  }

  const open = () => {
    setExpanded(true)
    onOpenChange?.(true)
  }

  const onFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    const slots = MAX_IMAGES - images.length
    const queue = Array.from(files).slice(0, slots)
    for (const file of queue) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Only images can be attached.')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" is over 10 MB.`)
        continue
      }
      try {
        const result = await upload.mutateAsync(file)
        setImages((prev) => [
          ...prev,
          { file_id: result.file_id, preview_url: result.public_url },
        ])
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed')
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onVideoPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    const file = files[0]
    if (!file.type.startsWith('video/')) {
      setUploadError('Only videos can be attached here.')
      if (videoInputRef.current) videoInputRef.current.value = ''
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setUploadError(`"${file.name}" is over 500 MB.`)
      if (videoInputRef.current) videoInputRef.current.value = ''
      return
    }
    const preview = URL.createObjectURL(file)
    setVideo({
      upload_id: '',
      preview_url: preview,
      filename: file.name,
      progress: 0,
    })
    try {
      const result = await uploadVideo.mutateAsync({
        file,
        onProgress: (fraction) =>
          setVideo((prev) => (prev ? { ...prev, progress: fraction } : prev)),
      })
      setVideo((prev) =>
        prev ? { ...prev, upload_id: result.upload_id, progress: 1 } : prev,
      )
    } catch (e) {
      URL.revokeObjectURL(preview)
      setVideo(null)
      setUploadError(e instanceof Error ? e.message : 'Video upload failed')
    }
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeVideo = () => {
    if (video) URL.revokeObjectURL(video.preview_url)
    setVideo(null)
  }

  const submit = async () => {
    const trimmed = body.trim()
    const hasVideo = video !== null && video.upload_id !== ''
    if (!trimmed && images.length === 0 && !hasVideo) return
    try {
      if (hasVideo) {
        await create.mutateAsync({
          type: 'video',
          body: trimmed || ' ',
          body_format: 'plain',
          tag_id: tagId,
          media: [
            {
              media_type: 'video',
              mux_upload_id: video!.upload_id,
              position: 0,
            },
          ],
        })
      } else {
        await create.mutateAsync({
          body: trimmed || ' ',
          body_format: 'plain',
          tag_id: tagId,
          media: images.map((img, idx) => ({
            media_type: 'image',
            file_id: img.file_id,
            position: idx,
          })),
        })
      }
      reset()
      setExpanded(false)
      onOpenChange?.(false)
      onPosted?.()
    } catch {
      // Keep modal open so the draft survives.
    }
  }

  const videoReady = video !== null && video.upload_id !== ''
  const canSubmit =
    !create.isPending &&
    !upload.isPending &&
    !uploadVideo.isPending &&
    (body.trim().length > 0 || images.length > 0 || videoReady)

  const moduleLabel =
    modules.find((m) => m.id === lessonModuleId)?.label ?? 'No module'

  // Photo/Video tool buttons open the OS file picker directly, then
  // expand the modal so the user lands on a draft with the file already
  // attached. The pill itself and the Write tool just open the modal.
  const pickPhotoAndOpen = () => {
    fileInputRef.current?.click()
    open()
  }
  const pickVideoAndOpen = () => {
    videoInputRef.current?.click()
    open()
  }

  return (
    <>
      {/* Hidden inputs sit OUTSIDE the modal so the device picker can
          be invoked from the collapsed pill before the modal renders.
          They're re-used by the modal's foot tools via the same refs. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => onFilesPicked(e.target.files)}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => onVideoPicked(e.target.files)}
      />

      {/* Collapsed pill — always rendered. The pill itself + Write open
          the modal; Photo/Video skip straight to the device picker. */}
      <div className={styles.composer}>
        <div className={styles.composerRow}>
          <Avatar name={selfName ?? 'You'} size={40} />
          <button type="button" className={styles.composerInput} onClick={open}>
            Start a discussion, ask a question, share what you&apos;re working
            on…
          </button>
        </div>
        <div className={styles.composerTools}>
          <button
            type="button"
            className={styles.composerTool}
            onClick={pickPhotoAndOpen}
            aria-label="Attach photo"
          >
            <span className={styles.composerToolPhoto}>
              <IconImage size={18} />
            </span>
            Photo
          </button>
          <button
            type="button"
            className={styles.composerTool}
            onClick={pickVideoAndOpen}
            aria-label="Attach video"
          >
            <span className={styles.composerToolVideo}>
              <IconVideo size={18} />
            </span>
            Video
          </button>
          <button
            type="button"
            className={styles.composerTool}
            onClick={open}
            aria-label="Write a post"
          >
            <span className={styles.composerToolPoll}>
              <IconFile size={18} />
            </span>
            Write
          </button>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalAuthor}>
                <Avatar name={selfName ?? 'You'} size={38} />
                <div>
                  <div className={styles.modalAuthorName}>
                    {selfName ?? 'You'}
                  </div>
                  {modules.length > 0 && (
                    <select
                      className={styles.modalAuthorMeta}
                      value={lessonModuleId}
                      onChange={(e) => setLessonModuleId(e.target.value)}
                      aria-label="Module"
                      title={moduleLabel}
                    >
                      <option value="">No module</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={close}
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <textarea
                ref={textareaRef}
                className={styles.modalTextarea}
                placeholder={`What's on your mind${
                  selfName ? `, ${selfName.split(' ')[0]}` : ''
                }? Share a question, a win, or what you've been working on…`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    submit()
                  }
                }}
              />

              {tags.length > 0 && (
                <div className={styles.modalTagRow}>
                  <span className={styles.modalTagLabel}>Tag your post:</span>
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.modalTagChip} ${
                        tagId === t.id ? styles.active : ''
                      }`}
                      onClick={() =>
                        setTagId((prev) => (prev === t.id ? null : t.id))
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {video && (
                <div className={styles.composerVideoPreview}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={video.preview_url} controls playsInline />
                  <button
                    type="button"
                    className={styles.composerVideoRemove}
                    onClick={removeVideo}
                    aria-label="Remove video"
                  >
                    <IconX size={13} />
                  </button>
                  {video.upload_id === '' && (
                    <div className={styles.composerVideoProgress}>
                      Uploading {Math.round(video.progress * 100)}% —{' '}
                      {video.filename}
                      <div className={styles.composerVideoProgressBar}>
                        <div
                          className={styles.composerVideoProgressFill}
                          style={{
                            width: `${Math.round(video.progress * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {images.length > 0 && (
                <div className={styles.composerThumbs}>
                  {images.map((img, idx) => (
                    <div key={img.file_id} className={styles.composerThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview_url} alt="" loading="lazy" />
                      <button
                        type="button"
                        className={styles.composerThumbRemove}
                        onClick={() => removeImage(idx)}
                        aria-label="Remove image"
                      >
                        <IconX size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(upload.isPending || uploadVideo.isPending) && (
                <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Uploading…
                </div>
              )}

              {uploadError && (
                <div className={styles.composerError} role="alert">
                  {uploadError}
                </div>
              )}
            </div>

            <div className={styles.modalFoot}>
              <div className={styles.modalFootTools}>
                <button
                  type="button"
                  className={`${styles.modalTool} ${styles.modalToolPhoto}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    images.length >= MAX_IMAGES ||
                    upload.isPending ||
                    video !== null
                  }
                  aria-label="Add photo"
                  title={
                    video !== null
                      ? 'Remove the video first to attach images'
                      : images.length >= MAX_IMAGES
                        ? `Maximum ${MAX_IMAGES} images per post`
                        : 'Add photo'
                  }
                >
                  <IconImage size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles.modalTool} ${styles.modalToolVideo}`}
                  onClick={() => videoInputRef.current?.click()}
                  disabled={
                    video !== null || uploadVideo.isPending || images.length > 0
                  }
                  aria-label="Add video"
                  title={
                    images.length > 0
                      ? 'Remove images first to attach a video'
                      : video !== null
                        ? 'Only one video per post'
                        : 'Add video'
                  }
                >
                  <IconVideo size={18} />
                </button>
                <button
                  type="button"
                  className={styles.modalTool}
                  aria-label="Add emoji"
                  disabled
                  title="Emoji picker coming soon"
                >
                  <IconSmile size={18} />
                </button>
              </div>
              <button
                type="button"
                className={styles.modalPostBtn}
                disabled={!canSubmit}
                onClick={submit}
              >
                <IconSend size={13} />
                {create.isPending ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
