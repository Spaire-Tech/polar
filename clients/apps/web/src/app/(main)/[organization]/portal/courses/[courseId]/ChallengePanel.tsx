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
  // already-submitted post doesn't drop its photos. Multi-image now —
  // the data model + endpoint always supported it; this lifts the
  // composer from the v0.1 single-image cap (audit B16). Order by
  // `position` so the carousel reads the way the student saved it.
  const [imageUrls, setImageUrls] = useState<string[]>(
    () =>
      (existing?.media ?? [])
        .filter((m) => m.kind === 'image' && m.url)
        .sort((a, b) => a.position - b.position)
        .map((m) => m.url as string),
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const upsert = useUpsertSubmission(courseId)
  const submit = useSubmitSubmission(courseId, challengeId)
  const busy = upsert.isPending || submit.isPending || uploading

  // Cap matches the IG carousel + the 6-emoji react palette earlier
  // in the experience. Beyond ~6 the carousel becomes tedious to
  // browse; server-side cap (Pass 5 backend change) is the source of
  // truth — this is just the UX guardrail.
  const MAX_IMAGES = 6
  const hasImages = imageUrls.length > 0
  const canAct = (caption.trim().length > 0 || hasImages) && !busy

  const buildMedia = () =>
    imageUrls.map((url, i) => ({
      kind: 'image' as const,
      url,
      position: i,
    }))

  const onSubmit = async () => {
    if (!caption.trim() && !hasImages) return
    const created = await upsert.mutateAsync({
      challengeId,
      payload: { caption: caption.trim(), media: buildMedia() },
    })
    await submit.mutateAsync(created.id)
  }

  const onSaveDraft = async () => {
    if (!caption.trim() && !hasImages) return
    await upsert.mutateAsync({
      challengeId,
      payload: { caption: caption.trim(), media: buildMedia() },
    })
  }

  const onPickFiles = async (files: FileList) => {
    setUploadError(null)
    const remaining = MAX_IMAGES - imageUrls.length
    if (remaining <= 0) {
      setUploadError(`You can attach up to ${MAX_IMAGES} photos.`)
      return
    }
    const picked = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      // Sequential to keep error attribution clean — one failed file
      // shouldn't drop the upload state for the others, but parallel
      // uploads from the same browser tab often collide on the
      // signed-PUT TTL window.
      const uploaded: string[] = []
      for (const f of picked) {
        const url = await uploadSubmissionImage(f)
        uploaded.push(url)
      }
      setImageUrls((prev) => [...prev, ...uploaded])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const removeImageAt = (i: number) => {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== i))
  }

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
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void onPickFiles(e.target.files)
          }
          e.target.value = ''
        }}
      />

      {hasImages && (
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns:
              imageUrls.length === 1
                ? '1fr'
                : 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          {imageUrls.map((url, i) => (
            <div key={`${i}-${url}`} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Submission photo ${i + 1}`}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: imageUrls.length === 1 ? undefined : '1 / 1',
                  maxHeight: imageUrls.length === 1 ? 360 : undefined,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.line}`,
                  background: 'white',
                  objectFit: 'cover',
                }}
              />
              <button
                type="button"
                onClick={() => removeImageAt(i)}
                disabled={busy}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(20,20,22,0.65)',
                  color: 'white',
                  fontSize: 13,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                aria-label={`Remove photo ${i + 1}`}
                title="Remove photo"
              >
                ✕
              </button>
              {i === 0 && imageUrls.length > 1 && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 6,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(20,20,22,0.65)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

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
          disabled={busy || imageUrls.length >= MAX_IMAGES}
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
            : imageUrls.length === 0
              ? 'Add photos'
              : imageUrls.length >= MAX_IMAGES
                ? `${MAX_IMAGES}/${MAX_IMAGES} photos`
                : `Add more (${imageUrls.length}/${MAX_IMAGES})`}
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
        const images = submission.media
          .filter((m) => m.kind === 'image' && m.url)
          .sort((a, b) => a.position - b.position)
        if (images.length === 0) return null
        if (images.length === 1) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[0].url as string}
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
        }
        // Horizontal scroll carousel — same shape as the IG-style
        // gallery layouts elsewhere in the portal. Snap-x so a
        // touch-flick lands cleanly on each photo.
        return (
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              marginBottom: 12,
              borderRadius: 10,
            }}
          >
            {images.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url as string}
                alt={`Photo ${i + 1}`}
                style={{
                  flex: '0 0 auto',
                  maxHeight: 480,
                  maxWidth: '100%',
                  borderRadius: 10,
                  border: `1px solid ${COLORS.lineSoft}`,
                  objectFit: 'cover',
                  scrollSnapAlign: 'start',
                }}
              />
            ))}
          </div>
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
                // Gallery card: show the cover image with a "+N" badge
                // when there are more photos. Tapping the card opens
                // the submission so the full carousel is one step
                // away without ballooning the gallery layout.
                const images = s.media
                  .filter((m) => m.kind === 'image' && m.url)
                  .sort((a, b) => a.position - b.position)
                if (images.length === 0) return null
                const extra = images.length - 1
                return (
                  <div
                    style={{
                      position: 'relative',
                      marginBottom: 8,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[0].url as string}
                      alt=""
                      style={{
                        display: 'block',
                        width: '100%',
                        maxHeight: 320,
                        borderRadius: 8,
                        border: `1px solid ${COLORS.lineSoft}`,
                        objectFit: 'cover',
                      }}
                    />
                    {extra > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          padding: '4px 9px',
                          borderRadius: 999,
                          background: 'rgba(20,20,22,0.7)',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 600,
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        +{extra}
                      </span>
                    )}
                  </div>
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
