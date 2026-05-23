'use client'

// ChallengePanel — student-facing surface for the module's challenge,
// rendered between the lesson player and the comment thread.
//
// Visual language inherits from CommentThread.tsx in the same directory:
// same Poppins-first font stack, same oklch palette (no Tailwind), so
// the panel reads as a natural extension of the lesson view rather
// than an unrelated dashboard widget.
//
// v0.1 ships text-only submissions: students write a caption and hit
// Submit. The schema supports image / video media already; the
// composer for those lands once the customer-side file upload
// endpoint is in place.

import {
  uploadSubmissionImage,
  useChallengeGallery,
  useDeleteOwnSubmission,
  useEnrolledCourseChallenges,
  useOwnSubmission,
  useSubmitSubmission,
  useUpsertSubmission,
  type ChallengeRead,
  type SubmissionRead,
} from '@/hooks/queries/challenges'
import { useMemo, useRef, useState } from 'react'

const fontStack = "'Poppins', var(--font-poppins), system-ui, sans-serif"

// Mirrors the palette in CommentThread.tsx so both blocks sit on the
// same surface system. Kept inline rather than imported because
// CommentThread defines them locally too.
const COLORS = {
  fg0: 'oklch(0.18 0.008 280)',
  fg1: 'oklch(0.32 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  line: 'oklch(0.92 0.003 280)',
  lineSoft: 'oklch(0.945 0.003 280)',
  bg2: 'oklch(0.975 0.002 280)',
  accent: 'oklch(0.55 0.20 265)',
  accentSoft: 'oklch(0.55 0.20 265 / 0.10)',
}

export function ChallengePanel({
  courseId,
  moduleId,
}: {
  courseId: string
  moduleId: string | null | undefined
}) {
  const challengesQ = useEnrolledCourseChallenges(courseId)
  const challenge = useMemo<ChallengeRead | undefined>(() => {
    if (!moduleId) return undefined
    return challengesQ.data?.find((c) => c.module_id === moduleId)
  }, [challengesQ.data, moduleId])

  if (!moduleId || challengesQ.isLoading) return null
  if (!challenge) return null
  return <ChallengeBody courseId={courseId} challenge={challenge} />
}

function ChallengeBody({
  courseId,
  challenge,
}: {
  courseId: string
  challenge: ChallengeRead
}) {
  const ownQ = useOwnSubmission(challenge.id)
  const own = ownQ.data ?? null
  const galleryQ = useChallengeGallery(challenge.id)
  const gallery = galleryQ.data ?? []
  // Exclude the student's own submission from the gallery — it has its
  // own dedicated section above. Keeps the "what other people did"
  // row from feeling like a duplicate.
  const othersGallery = useMemo(
    () => gallery.filter((s) => own == null || s.id !== own.id),
    [gallery, own],
  )

  return (
    <section
      style={{
        fontFamily: fontStack,
        margin: '32px 0 0',
        padding: '24px 0 12px',
        borderTop: `1px solid ${COLORS.line}`,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: COLORS.fg3,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COLORS.accent,
            }}
          />
          Challenge
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.22,
            color: COLORS.fg0,
          }}
        >
          {challenge.title}
        </h3>
        {challenge.prompt && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: COLORS.fg2,
              maxWidth: 640,
            }}
          >
            {challenge.prompt}
          </p>
        )}
      </div>

      {own ? (
        <SubmissionView
          courseId={courseId}
          challengeId={challenge.id}
          submission={own}
        />
      ) : (
        <Composer
          courseId={courseId}
          challengeId={challenge.id}
          existing={null}
        />
      )}

      {othersGallery.length > 0 && (
        <Gallery submissions={othersGallery} />
      )}
    </section>
  )
}

function Composer({
  courseId,
  challengeId,
  existing,
}: {
  courseId: string
  challengeId: string
  existing: SubmissionRead | null
}) {
  const [caption, setCaption] = useState(existing?.caption ?? '')
  // Pre-populate from the existing submission's media so editing an
  // already-submitted post doesn't drop its photo.
  const [imageUrl, setImageUrl] = useState<string | null>(
    existing?.media.find((m) => m.kind === 'image')?.url ?? null,
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const upsert = useUpsertSubmission(courseId)
  const submit = useSubmitSubmission(courseId, challengeId)
  const busy = upsert.isPending || submit.isPending || uploading

  const buildMedia = () =>
    imageUrl
      ? [{ kind: 'image' as const, url: imageUrl, position: 0 }]
      : []

  const onSubmit = async () => {
    if (!caption.trim() && !imageUrl) return
    const created = await upsert.mutateAsync({
      challengeId,
      payload: { caption: caption.trim(), media: buildMedia() },
    })
    await submit.mutateAsync(created.id)
  }

  const onSaveDraft = async () => {
    if (!caption.trim() && !imageUrl) return
    await upsert.mutateAsync({
      challengeId,
      payload: { caption: caption.trim(), media: buildMedia() },
    })
  }

  const onPickFile = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const url = await uploadSubmissionImage(file)
      setImageUrl(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const canAct =
    (caption.trim().length > 0 || imageUrl !== null) && !busy

  return (
    <div
      style={{
        background: COLORS.bg2,
        border: `1px solid ${COLORS.lineSoft}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: COLORS.fg3,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Your submission
      </label>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={4}
        placeholder="What did you make? What changed? Share it with the class."
        style={{
          width: '100%',
          resize: 'vertical',
          border: `1px solid ${COLORS.line}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 14,
          lineHeight: 1.55,
          color: COLORS.fg0,
          background: 'white',
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.accent
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = COLORS.line
        }}
      />

      {/* Image — picker, preview, error. Hidden <input> + a styled
          button so the affordance fits the surrounding pill-button
          system instead of a raw browser-chrome file input. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPickFile(f)
          e.target.value = ''
        }}
      />

      {imageUrl ? (
        <div style={{ marginTop: 12, position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your submission"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 360,
              borderRadius: 10,
              border: `1px solid ${COLORS.line}`,
              background: 'white',
              objectFit: 'cover',
            }}
          />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            disabled={busy}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(20,20,22,0.65)',
              color: 'white',
              fontSize: 14,
              cursor: busy ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            aria-label="Remove photo"
            title="Remove photo"
          >
            ✕
          </button>
        </div>
      ) : null}

      {uploadError && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 12.5,
            color: 'oklch(0.5 0.18 25)',
          }}
        >
          {uploadError}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{
            border: `1px solid ${COLORS.line}`,
            background: 'white',
            color: COLORS.fg1,
            fontSize: 12.5,
            fontWeight: 500,
            padding: '7px 13px',
            borderRadius: 999,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>
            📷
          </span>
          {uploading
            ? 'Uploading…'
            : imageUrl
              ? 'Replace photo'
              : 'Add photo'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={!canAct}
            style={{
              border: `1px solid ${COLORS.line}`,
              background: 'white',
              color: COLORS.fg1,
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 999,
              cursor: canAct ? 'pointer' : 'not-allowed',
              opacity: canAct ? 1 : 0.5,
            }}
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canAct}
            style={{
              border: 'none',
              background: COLORS.accent,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 999,
              cursor: canAct ? 'pointer' : 'not-allowed',
              opacity: canAct ? 1 : 0.5,
            }}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmissionView({
  courseId,
  challengeId,
  submission,
}: {
  courseId: string
  challengeId: string
  submission: SubmissionRead
}) {
  const [editing, setEditing] = useState(false)
  const del = useDeleteOwnSubmission(courseId, challengeId)
  const isDraft = submission.status === 'draft'
  const isHidden = submission.status === 'hidden'

  if (editing) {
    return (
      <Composer
        courseId={courseId}
        challengeId={challengeId}
        existing={submission}
      />
    )
  }

  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: COLORS.fg3,
            textTransform: 'uppercase',
          }}
        >
          Your submission
          {isDraft && (
            <span
              style={{
                background: 'oklch(0.96 0.05 80)',
                color: 'oklch(0.42 0.10 80)',
                padding: '2px 8px',
                borderRadius: 999,
                letterSpacing: '0.04em',
              }}
            >
              Draft
            </span>
          )}
          {isHidden && (
            <span
              style={{
                background: 'oklch(0.96 0.04 25)',
                color: 'oklch(0.42 0.12 25)',
                padding: '2px 8px',
                borderRadius: 999,
                letterSpacing: '0.04em',
              }}
            >
              Hidden by creator
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              border: `1px solid ${COLORS.line}`,
              background: 'white',
              color: COLORS.fg1,
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this submission?'))
                del.mutate(submission.id)
            }}
            style={{
              border: `1px solid ${COLORS.line}`,
              background: 'white',
              color: COLORS.fg2,
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {(() => {
        const image = submission.media.find(
          (m) => m.kind === 'image' && m.url,
        )
        if (!image?.url) return null
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              maxHeight: 480,
              borderRadius: 10,
              border: `1px solid ${COLORS.lineSoft}`,
              objectFit: 'cover',
              marginBottom: 12,
            }}
          />
        )
      })()}
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          lineHeight: 1.6,
          color: COLORS.fg0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {submission.caption || (
          <em style={{ color: COLORS.fg3 }}>(no caption yet)</em>
        )}
      </p>
      {submission.reactions.some((r) => r.actor_type === 'creator') && (
        <div
          style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: COLORS.accentSoft,
            color: COLORS.fg1,
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 14 }}>
            {
              submission.reactions.find(
                (r) => r.actor_type === 'creator',
              )?.emoji
            }
          </span>
          <span>The creator reacted to your submission</span>
        </div>
      )}
    </div>
  )
}

function Gallery({ submissions }: { submissions: SubmissionRead[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? submissions : submissions.slice(0, 3)
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: COLORS.fg3,
          }}
        >
          From the class · {submissions.length}
        </div>
        {submissions.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            style={{
              border: 'none',
              background: 'transparent',
              color: COLORS.accent,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {expanded ? 'Show fewer' : `Show all ${submissions.length}`}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {visible.map((s) => {
          const creatorReaction = s.reactions.find(
            (r) => r.actor_type === 'creator',
          )
          return (
            <article
              key={s.id}
              style={{
                background: 'white',
                border: `1px solid ${COLORS.lineSoft}`,
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.fg1,
                  }}
                >
                  {s.author.display_name}
                </span>
                {creatorReaction && (
                  <span
                    title="The creator reacted"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 13,
                      background: COLORS.accentSoft,
                      color: COLORS.fg1,
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      {creatorReaction.emoji}
                    </span>
                  </span>
                )}
              </div>
              {(() => {
                const image = s.media.find(
                  (m) => m.kind === 'image' && m.url,
                )
                if (!image?.url) return null
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt=""
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 320,
                      borderRadius: 8,
                      border: `1px solid ${COLORS.lineSoft}`,
                      objectFit: 'cover',
                      marginBottom: 8,
                    }}
                  />
                )
              })()}
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: COLORS.fg1,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {s.caption || (
                  <em style={{ color: COLORS.fg3 }}>(no caption)</em>
                )}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
