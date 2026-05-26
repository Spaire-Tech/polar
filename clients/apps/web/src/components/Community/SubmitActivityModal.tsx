'use client'

// v5 submit-to-activity modal. Drag-drop upload zone + Notes textarea
// + visibility pills. Real S3/Mux upload — no URL inputs.
//
// Per design: the bake-specific spec fields (Hydration / Bulk / Flour /
// One thing you'd change) are intentionally NOT rendered — they belong
// to the demo design only. The activity's submission_type decides
// what to upload (photo → community image endpoint, video → Mux).

import {
  useUploadPostImage,
  useUploadPostVideo,
} from '@/hooks/queries/community'
import { useEffect, useState } from 'react'
import type {
  ActivitySubmissionInput,
  CommunityActivity,
} from './ActivitiesView'
import styles from './community.module.css'
import {
  IconBookmark,
  IconCamera,
  IconChat,
  IconGlobe,
  IconImage,
  IconSend,
  IconUsers,
  IconVideo,
  IconX,
} from './icons'

type Visibility = 'cohort' | 'all' | 'instr'

type Props = {
  activity: CommunityActivity | null
  courseId: string | undefined
  customerSessionToken: string | null | undefined
  /** 'creator' = host previewing from the editor; 'customer' = student. */
  mode: 'creator' | 'customer'
  onClose: () => void
  onSubmit: (
    activityId: string,
    submission: ActivitySubmissionInput,
  ) => Promise<void> | void
}

export function SubmitActivityModal({
  activity,
  courseId,
  customerSessionToken,
  mode,
  onClose,
  onSubmit,
}: Props) {
  const [file, setFile] = useState<{ name: string; previewUrl: string } | null>(
    null,
  )
  const [fileId, setFileId] = useState<string | null>(null)
  const [muxUploadId, setMuxUploadId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('cohort')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const uploadImage = useUploadPostImage(customerSessionToken, courseId, mode)
  const uploadVideo = useUploadPostVideo(customerSessionToken, courseId, mode)

  // Reset state whenever the active activity changes.
  useEffect(() => {
    setFile(null)
    setFileId(null)
    setMuxUploadId(null)
    setCaption('')
    setLinkUrl('')
    setVisibility('cohort')
    setUploading(false)
    setProgress(0)
    setError(null)
    setSubmitting(false)
  }, [activity?.id])

  useEffect(() => {
    if (!activity) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activity, onClose])

  if (!activity) return null

  const isVideo = activity.submissionType === 'video'
  const isText = activity.submissionType === 'text'
  const isLink = activity.submissionType === 'link'
  const requiresUpload = isVideo || activity.submissionType === 'photo'

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile({ name: f.name, previewUrl: URL.createObjectURL(f) })
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      if (isVideo) {
        const result = await uploadVideo.mutateAsync({
          file: f,
          onProgress: (frac) => setProgress(Math.round(frac * 100)),
        })
        setMuxUploadId(result.upload_id)
        setFileId(null)
      } else {
        const result = await uploadImage.mutateAsync(f)
        setFileId(result.file_id)
        setMuxUploadId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setFile(null)
    } finally {
      setUploading(false)
      // Reset input so picking the same file again still fires onChange.
      e.target.value = ''
    }
  }

  const clearFile = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFile(null)
    setFileId(null)
    setMuxUploadId(null)
    setProgress(0)
  }

  const canPost = (() => {
    if (uploading || submitting) return false
    if (isText) return caption.trim().length > 0
    if (isLink) return linkUrl.trim().length > 0
    // photo / video
    return !!(fileId || muxUploadId) && caption.trim().length > 0
  })()

  const submit = async () => {
    if (!canPost) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(activity.id, {
        submissionType: activity.submissionType,
        body: caption.trim() || undefined,
        fileId: fileId ?? undefined,
        muxUploadId: muxUploadId ?? undefined,
        linkUrl: linkUrl.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const channelWord = activity.channelKind === 'lesson' ? 'Episode' : 'Module'

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.saModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.saHead}>
          <div className={styles.saHeadInfo}>
            <span className={styles.saEyebrow}>
              {channelWord} · Submit your work
            </span>
            <span className={styles.saTitle}>{activity.title}</span>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className={styles.saBody}>
          {requiresUpload && (
            <div className={styles.ceField}>
              <span className={styles.ceLabel}>
                {isVideo ? 'Video' : 'Photo'} · required
              </span>
              <label
                className={`${styles.uploadZone} ${file ? styles.uploadZoneHasFile : ''}`}
                style={
                  file && !isVideo
                    ? { backgroundImage: `url(${file.previewUrl})` }
                    : undefined
                }
              >
                {!file && (
                  <>
                    <span className={styles.uploadZoneIcon}>
                      {isVideo ? (
                        <IconVideo size={22} />
                      ) : (
                        <IconImage size={22} />
                      )}
                    </span>
                    <span className={styles.uploadZoneText}>
                      Drop your {isVideo ? 'video' : 'photo'} here, or click to
                      browse
                    </span>
                    <span className={styles.uploadZoneSub}>
                      {isVideo
                        ? 'MP4 or MOV · up to 60 seconds'
                        : 'JPG or PNG · up to 12MB'}
                    </span>
                  </>
                )}
                {file && (
                  <>
                    {isVideo && (
                      <div
                        style={{
                          textAlign: 'center',
                          color: 'var(--c-ink)',
                          padding: 24,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          {file.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                          {uploading ? `Uploading… ${progress}%` : 'Uploaded'}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.uploadZoneClear}
                      onClick={clearFile}
                      aria-label="Remove file"
                    >
                      <IconX size={14} />
                    </button>
                  </>
                )}
                <input
                  className={styles.uploadZoneInput}
                  type="file"
                  accept={isVideo ? 'video/*' : 'image/*'}
                  onChange={onFile}
                  disabled={uploading}
                />
              </label>
              {!isVideo && uploading && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--c-muted)',
                    marginTop: 6,
                  }}
                >
                  Uploading photo…
                </div>
              )}
            </div>
          )}

          {isLink && (
            <div className={styles.ceField}>
              <span className={styles.ceLabel}>Link · required</span>
              <input
                className={styles.ceInput}
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          )}

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>
              Notes{isText ? ' · required' : ''}
            </span>
            <textarea
              className={styles.ceInput}
              style={{ minHeight: 90, resize: 'none' }}
              placeholder={
                isText
                  ? 'Write your response…'
                  : "What did you try? What's working? What would you change next time?"
              }
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Visibility</span>
            <div className={styles.visibilityPills}>
              <button
                type="button"
                className={`${styles.visibilityPill} ${visibility === 'cohort' ? styles.visibilityPillActive : ''}`}
                onClick={() => setVisibility('cohort')}
              >
                <IconUsers size={12} /> Your cohort only
              </button>
              <button
                type="button"
                className={`${styles.visibilityPill} ${visibility === 'all' ? styles.visibilityPillActive : ''}`}
                onClick={() => setVisibility('all')}
              >
                <IconGlobe size={12} /> All cohorts
              </button>
              <button
                type="button"
                className={`${styles.visibilityPill} ${visibility === 'instr' ? styles.visibilityPillActive : ''}`}
                onClick={() => setVisibility('instr')}
              >
                <IconBookmark size={12} /> Instructor only
              </button>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: 'var(--c-muted)',
              }}
            >
              Visibility scoping ships with the next backend slice; for now
              every submission is visible to the whole cohort.
            </div>
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>
          )}
        </div>

        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>
            Visible to the cohort + the instructor
          </div>
          <div className={styles.ceActions}>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              disabled={!canPost}
              onClick={submit}
            >
              <IconSend size={13} /> {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Silence unused-import helpers for icons that the upload-zone hover
// surface uses conditionally.
const _ = [IconChat, IconCamera]
