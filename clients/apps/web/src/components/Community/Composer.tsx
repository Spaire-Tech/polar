'use client'

import {
  type CommunityTagRead,
  useCreateCommunityPost,
  useUploadPostImage,
} from '@/hooks/queries/community'
import { useRef, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconImage, IconPlus, IconX } from './icons'

const MAX_IMAGES = 4

type AttachedImage = {
  file_id: string
  preview_url: string
}

type Props = {
  token: string
  courseId: string
  selfName?: string | null
  tags: CommunityTagRead[]
  modules: { id: string; label: string }[]
  defaultModuleId?: string | null
  // When the user clicks the top-right "+ New post" button.
  forceOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onPosted?: () => void
}

export function Composer({
  token,
  courseId,
  selfName,
  tags,
  modules,
  defaultModuleId,
  forceOpen,
  onOpenChange,
  onPosted,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceOpen ?? expanded
  const [body, setBody] = useState('')
  const [tagId, setTagId] = useState<string>('')
  const [lessonModuleId, setLessonModuleId] = useState<string>(
    defaultModuleId ?? '',
  )
  const [images, setImages] = useState<AttachedImage[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const create = useCreateCommunityPost(token, courseId)
  const upload = useUploadPostImage(token, courseId)

  const reset = () => {
    setBody('')
    setTagId('')
    setLessonModuleId(defaultModuleId ?? '')
    setImages([])
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
    // Cap at MAX_IMAGES total — silently drop overflow.
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
        setUploadError(
          e instanceof Error ? e.message : 'Upload failed',
        )
      }
    }
    // Reset input so picking the same file again re-fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    const trimmed = body.trim()
    if (!trimmed && images.length === 0) return
    try {
      await create.mutateAsync({
        body: trimmed || ' ', // body is min_length=1 on the server
        body_format: 'plain',
        tag_id: tagId || null,
        media: images.map((img, idx) => ({
          media_type: 'image',
          file_id: img.file_id,
          position: idx,
        })),
      })
      reset()
      setExpanded(false)
      onOpenChange?.(false)
      onPosted?.()
    } catch {
      // Mutation surfaces the error via .isError if the parent wants
      // to render it; keep the composer open so the user doesn't lose
      // their draft.
    }
  }

  if (!isOpen) {
    return (
      <div className={styles.composer}>
        <div className={styles.composerRow}>
          <Avatar name={selfName ?? 'You'} size={36} />
          <button
            type="button"
            className={styles.composerInput}
            style={{
              textAlign: 'left',
              cursor: 'text',
              color: 'var(--c-muted)',
            }}
            onClick={open}
          >
            Start a post
          </button>
          <button
            type="button"
            className={styles.composerAdd}
            onClick={open}
            aria-label="New post"
          >
            <IconPlus size={17} />
          </button>
        </div>
      </div>
    )
  }

  const canSubmit =
    !create.isPending &&
    !upload.isPending &&
    (body.trim().length > 0 || images.length > 0)

  return (
    <div className={styles.composer}>
      <div className={styles.composerRow} style={{ alignItems: 'flex-start' }}>
        <Avatar name={selfName ?? 'You'} size={36} />
        <div className={styles.composerExpanded} style={{ flex: 1 }}>
          <textarea
            className={styles.composerTextarea}
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
          />

          {/* Attached-image thumbnails (1–4 chips above the foot) */}
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
              {upload.isPending && (
                <div
                  className={styles.composerThumb}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--c-muted)',
                    fontSize: 11,
                  }}
                >
                  Uploading…
                </div>
              )}
            </div>
          )}
          {upload.isPending && images.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--c-muted)',
                marginTop: 4,
              }}
            >
              Uploading…
            </div>
          )}
          {uploadError && (
            <div
              style={{
                fontSize: 12,
                color: '#dc2626',
                marginTop: 4,
              }}
              role="alert"
            >
              {uploadError}
            </div>
          )}

          <div className={styles.composerFoot}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => onFilesPicked(e.target.files)}
              />
              <button
                type="button"
                className={styles.composerIconBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  images.length >= MAX_IMAGES || upload.isPending
                }
                aria-label="Attach image"
                title={
                  images.length >= MAX_IMAGES
                    ? `Maximum ${MAX_IMAGES} images per post`
                    : 'Attach image'
                }
              >
                <IconImage size={16} />
              </button>
              {tags.length > 0 && (
                <select
                  className={styles.composerSelect}
                  value={tagId}
                  onChange={(e) => setTagId(e.target.value)}
                  aria-label="Tag"
                >
                  <option value="">No tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
              {modules.length > 0 && (
                <select
                  className={styles.composerSelect}
                  value={lessonModuleId}
                  onChange={(e) => setLessonModuleId(e.target.value)}
                  aria-label="Module"
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
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={styles.composerCancel}
                onClick={close}
                disabled={create.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.composerSubmit}
                onClick={submit}
                disabled={!canSubmit}
              >
                {create.isPending ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
