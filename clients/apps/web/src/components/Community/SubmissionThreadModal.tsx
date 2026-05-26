'use client'

// Side-by-side modal viewer for a single submission.
// Photo/video on the left with prev/next arrows + keyboard ← / →.
// Comments on the right, with instructor notes styled in amber.

import {
  type CommunityActivitySubmissionRead,
  usePostSubmissionComment,
  useSubmissionComments,
} from '@/hooks/queries/community'
import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconPlayCircle, IconSend, IconX } from './icons'

type Props = {
  submission: CommunityActivitySubmissionRead
  submissions: readonly CommunityActivitySubmissionRead[]
  /** Customer-portal session token; null/undefined in creator mode. */
  customerSessionToken: string | null | undefined
  courseId: string
  activityId: string
  /** 'creator' = instructor previewing; 'customer' = student. */
  mode: 'creator' | 'customer'
  onClose: () => void
  onNavigate: (dir: number) => void
}

export function SubmissionThreadModal({
  submission,
  submissions,
  customerSessionToken,
  courseId,
  activityId,
  mode,
  onClose,
  onNavigate,
}: Props) {
  const [draft, setDraft] = useState('')

  const commentsQ = useSubmissionComments(
    customerSessionToken,
    courseId,
    activityId,
    submission.id,
    mode,
  )
  const postCommentMut = usePostSubmissionComment(
    customerSessionToken,
    courseId,
    activityId,
    submission.id,
    mode,
  )
  const comments = commentsQ.data ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNavigate(-1)
      if (e.key === 'ArrowRight') onNavigate(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate])

  useEffect(() => {
    setDraft('')
  }, [submission.id])

  const idx = submissions.findIndex((s) => s.id === submission.id)
  const total = submissions.length

  const photo =
    submission.file_url ||
    (submission.mux_playback_id
      ? `https://image.mux.com/${submission.mux_playback_id}/thumbnail.jpg?width=1280`
      : null)

  const isVideo = submission.submission_type === 'video'

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    try {
      await postCommentMut.mutateAsync({ body: text })
      setDraft('')
    } catch {
      // Mutation surfaces error via mut.isError; keep the draft so the
      // user doesn't lose their typing on a transient failure.
    }
  }

  return (
    <div className={styles.subThreadOverlay} onClick={onClose}>
      <div
        className={styles.subThread}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Activity submission"
      >
        <div className={styles.subThreadMedia}>
          {photo && (
            <div
              className={styles.subThreadMediaImg}
              style={{
                backgroundImage: `url(${photo})`,
                backgroundPosition:
                  submission.image_object_position || '50% 50%',
              }}
            />
          )}
          <span className={styles.subThreadCounter}>
            {idx + 1} / {total}
          </span>
          {idx > 0 && (
            <button
              type="button"
              className={`${styles.subThreadArrow} ${styles.subThreadArrowPrev}`}
              onClick={() => onNavigate(-1)}
              aria-label="Previous submission"
            >
              ‹
            </button>
          )}
          {idx < total - 1 && (
            <button
              type="button"
              className={`${styles.subThreadArrow} ${styles.subThreadArrowNext}`}
              onClick={() => onNavigate(1)}
              aria-label="Next submission"
            >
              ›
            </button>
          )}
          {isVideo && (
            <div className={styles.subCoverVideoBtn}>
              <span className="play">
                <IconPlayCircle size={26} />
              </span>
            </div>
          )}
        </div>

        <div className={styles.subThreadSide}>
          <div className={styles.subThreadHead}>
            <Avatar name={submission.author_name} size={36} />
            <div className={styles.subThreadHeadInfo}>
              <div className={styles.subThreadHeadName}>
                {submission.author_name}
              </div>
              <div className={styles.subThreadHeadSub}>
                {relativeTime(submission.created_at)}
              </div>
            </div>
            <button
              type="button"
              className={styles.subThreadClose}
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={17} />
            </button>
          </div>

          <div className={styles.subThreadBody}>
            {submission.body && (
              <div className={styles.subThreadCaption}>{submission.body}</div>
            )}
            {!submission.body &&
              submission.submission_type === 'link' &&
              submission.link_url && (
                <a
                  href={submission.link_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.subThreadCaption}
                >
                  {submission.link_url}
                </a>
              )}

            <div className={styles.subThreadCommentsLabel}>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </div>
            <div className={styles.subThreadComments}>
              {commentsQ.isLoading ? (
                <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Loading…
                </div>
              ) : comments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Be the first to comment.
                </div>
              ) : (
                comments.map((c) => {
                  const instr = c.author.kind === 'instructor'
                  return (
                    <div
                      key={c.id}
                      className={`${styles.cmt} ${instr ? styles.cmtInstr : ''}`}
                    >
                      <Avatar
                        name={c.author.name}
                        avatarUrl={c.author.avatar_url ?? undefined}
                        size={30}
                      />
                      <div className={styles.cmtBody}>
                        <div>
                          <span className={styles.cmtAuthor}>
                            {c.author.name}
                            {instr && <span className="instrBadge">INSTR</span>}
                          </span>
                          <span className={styles.cmtWhen}>
                            · {relativeTime(c.created_at)}
                          </span>
                        </div>
                        <div className={styles.cmtText}>{c.body}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className={styles.subThreadComposer}>
            <Avatar name="Me" size={30} />
            <input
              className="input"
              placeholder="Add a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send()
              }}
              disabled={postCommentMut.isPending}
            />
            <button
              type="button"
              className="send"
              disabled={!draft.trim() || postCommentMut.isPending}
              onClick={() => void send()}
              aria-label="Send"
            >
              <IconSend size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const relativeTime = (iso: string): string => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
