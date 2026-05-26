'use client'

// Side-by-side modal viewer for a single submission.
// Photo/video on the left with prev/next arrows + keyboard ← / →.
// Comments on the right, with instructor's note styled in amber.
//
// Comments are local-state-only for now — there's no backend table
// for activity-submission comments yet. UI shell is correct so the
// backend can be slotted in without further UI work.

import type { CommunityActivitySubmissionRead } from '@/hooks/queries/community'
import { useEffect, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconPlayCircle, IconSend, IconX } from './icons'

type Comment = {
  id: string
  author: string
  when: string
  text: string
  instr?: boolean
}

type Props = {
  submission: CommunityActivitySubmissionRead
  submissions: readonly CommunityActivitySubmissionRead[]
  onClose: () => void
  onNavigate: (dir: number) => void
}

export function SubmissionThreadModal({
  submission,
  submissions,
  onClose,
  onNavigate,
}: Props) {
  const [draft, setDraft] = useState('')
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNavigate(-1)
      if (e.key === 'ArrowRight') onNavigate(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate])

  // Reset local comments when the active submission changes.
  useEffect(() => {
    setComments([])
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

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setComments((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        author: 'You',
        when: 'just now',
        text,
      },
    ])
    setDraft('')
  }

  return (
    <div className={styles.subThreadOverlay} onClick={onClose}>
      <div className={styles.subThread} onClick={(e) => e.stopPropagation()}>
        <div className={styles.subThreadMedia}>
          {photo && (
            <div
              className={styles.subThreadMediaImg}
              style={{ backgroundImage: `url(${photo})` }}
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
              {comments.length} comments
            </div>
            <div className={styles.subThreadComments}>
              {comments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  Be the first to comment. (Comments are session-local until the
                  activity-submission comments endpoint lands.)
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`${styles.cmt} ${c.instr ? styles.cmtInstr : ''}`}
                  >
                    <Avatar name={c.author} size={30} />
                    <div className={styles.cmtBody}>
                      <div>
                        <span className={styles.cmtAuthor}>
                          {c.author}
                          {c.instr && <span className="instrBadge">INSTR</span>}
                        </span>
                        <span className={styles.cmtWhen}>· {c.when}</span>
                      </div>
                      <div className={styles.cmtText}>{c.text}</div>
                    </div>
                  </div>
                ))
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
                if (e.key === 'Enter') send()
              }}
            />
            <button
              type="button"
              className="send"
              disabled={!draft.trim()}
              onClick={send}
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
