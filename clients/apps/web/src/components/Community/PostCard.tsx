'use client'

import {
  type CommunityAuthor,
  type CommunityCommentRead,
  type CommunityIOMode,
  type CommunityPostRead,
  type CommunityReactionEmoji,
  useCommunityPostComments,
  useCreateCommunityComment,
  useDeleteCommunityComment,
  useDeleteCommunityPost,
  useToggleCommentReaction,
  useTogglePostReaction,
} from '@/hooks/queries/community'
import { buildCommentTree, type CommentNode } from '@/lib/comments/build-tree'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HlsVideo } from '../Courses/HlsVideo'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import {
  IconBook,
  IconChat,
  IconDots,
  IconGlobe,
  IconPin,
  IconRepeat,
  IconSend,
  IconThumbsUp,
  IconTrash,
  IconX,
} from './icons'

type ReactionDef = {
  id: CommunityReactionEmoji
  emoji: string
  label: string
}

const REACTIONS: ReactionDef[] = [
  { id: 'thumbsup', emoji: '👍', label: 'Like' },
  { id: 'clap', emoji: '👏', label: 'Celebrate' },
  { id: 'heart', emoji: '❤️', label: 'Love' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'idea', emoji: '💡', label: 'Insightful' },
  { id: 'pray', emoji: '🙏', label: 'Support' },
]

const DEFAULT_REACTION: CommunityReactionEmoji = 'thumbsup'

const REACTION_BY_ID: Record<CommunityReactionEmoji, ReactionDef> =
  REACTIONS.reduce(
    (acc, r) => {
      acc[r.id] = r
      return acc
    },
    {} as Record<CommunityReactionEmoji, ReactionDef>,
  )

const formatRelative = (iso: string): string => {
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

const authorName = (a: CommunityAuthor): string =>
  a.name ?? (a.kind === 'instructor' ? 'Instructor' : 'Member')

const formatTimestamp = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

const isInstructor = (a: CommunityAuthor): boolean => a.kind === 'instructor'

// Map a tag slug to its colored-pill CSS variant. The seeded slugs get
// hand-tuned palettes from the design system; instructor-created slugs
// fall back to a deterministic HSL palette derived from the slug hash
// so they at least stay visually distinguishable and stable across
// renders (the same slug always lands on the same hue).
const tagPillClass = (slug: string): string => {
  switch (slug) {
    case 'activity':
      return styles.tagPillActivity
    case 'question':
      return styles.tagPillQuestion
    case 'win':
      return styles.tagPillWin
    default:
      return ''
  }
}

const SEEDED_SLUGS = new Set(['activity', 'question', 'win'])

// djb2-ish hash so the same slug always picks the same hue, no matter
// where the pill renders. Keeps lightness/saturation locked so the pill
// stays readable on the panel background.
const tagPillStyle = (slug: string): React.CSSProperties | undefined => {
  if (SEEDED_SLUGS.has(slug)) return undefined
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return {
    backgroundColor: `hsl(${hue} 70% 94%)`,
    color: `hsl(${hue} 55% 28%)`,
    borderColor: `hsl(${hue} 50% 82%)`,
  }
}

// ---------------------------------------------------------------------
// Body — LinkedIn-style truncation. Posts cap visibly at ~210
// characters with a "...see more" expander; once expanded the post
// stays expanded for the remainder of the session (per-post local
// state). The cutoff is character-based — line breaks, emojis and
// spaces all count — to match the rhythm LinkedIn creators write to.
// ---------------------------------------------------------------------

const BODY_TRUNCATE_AT = 210

// Find the last whitespace before `limit` so we don't snip a word in
// half. Falls back to the hard limit when the whole prefix is
// whitespace-free (one giant URL, etc).
const findTruncationPoint = (body: string, limit: number): number => {
  if (body.length <= limit) return body.length
  const window = body.slice(0, limit)
  // Prefer breaking at a newline first — LinkedIn-style posts use the
  // line-break drama, so the natural visual cliff is at one.
  const lastNewline = window.lastIndexOf('\n')
  if (lastNewline >= limit * 0.6) return lastNewline
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace >= limit * 0.6) return lastSpace
  return limit
}

function ExpandableBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = body.length > BODY_TRUNCATE_AT
  if (!needsTruncation || expanded) {
    return <p className={styles.postBody}>{body}</p>
  }
  const cut = findTruncationPoint(body, BODY_TRUNCATE_AT)
  const head = body.slice(0, cut).replace(/\s+$/, '')
  return (
    <p className={styles.postBody}>
      {head}
      {'… '}
      <button
        type="button"
        className={styles.seeMore}
        onClick={() => setExpanded(true)}
      >
        see more
      </button>
    </p>
  )
}

// ---------------------------------------------------------------------
// Like button — collapsed default + hover-reveal reaction picker.
// Replaces the old always-visible inline emoji row. The stats bar above
// the action row carries the aggregate count.
// ---------------------------------------------------------------------

function LikeButton({
  reactions,
  onToggle,
}: {
  reactions: CommunityPostRead['reactions']
  onToggle: (emoji: CommunityReactionEmoji) => void
}) {
  const mine = useMemo(() => reactions.find((r) => r.mine), [reactions])
  const active = mine ? REACTION_BY_ID[mine.emoji] : null
  const [burst, setBurst] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const scheduleHide = () => {
    clearHide()
    hideTimer.current = setTimeout(() => setPickerOpen(false), 220)
  }

  // Click anywhere outside the wrap closes the picker — necessary on
  // touch devices where there is no mouseleave to fall back on.
  useEffect(() => {
    if (!pickerOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [pickerOpen])

  useEffect(() => () => clearHide(), [])

  const choose = (id: CommunityReactionEmoji) => {
    setBurst(true)
    setTimeout(() => setBurst(false), 400)
    setPickerOpen(false)
    clearHide()
    onToggle(id)
  }

  // Tapping the button toggles the user's current reaction off, or
  // applies the default 👍 reaction when nothing is set.
  const onPrimary = () => {
    setPickerOpen(false)
    clearHide()
    choose(active ? active.id : DEFAULT_REACTION)
  }

  return (
    <div
      ref={wrapRef}
      className={`${styles.likeWrap} ${pickerOpen ? styles.likeWrapOpen : ''}`}
      onMouseEnter={() => {
        clearHide()
        setPickerOpen(true)
      }}
      onMouseLeave={scheduleHide}
    >
      <div
        className={styles.reactionPicker}
        onMouseEnter={clearHide}
        onMouseLeave={scheduleHide}
      >
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={styles.rx}
            onClick={(e) => {
              e.stopPropagation()
              choose(r.id)
            }}
            aria-label={r.label}
          >
            <span className={styles.rxLabel}>{r.label}</span>
            {r.emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${styles.postAction} ${active ? styles.reacted : ''}`}
        onClick={onPrimary}
        onContextMenu={(e) => {
          // Long-press / right-click opens the picker without firing a
          // reaction — mirrors the LinkedIn touch behavior.
          e.preventDefault()
          setPickerOpen((v) => !v)
        }}
      >
        {active ? (
          <>
            <span
              className={burst ? styles.reactionBurst : undefined}
              style={{ fontSize: 16, lineHeight: 1 }}
            >
              {active.emoji}
            </span>
            {active.label}
          </>
        ) : (
          <>
            <IconThumbsUp size={16} />
            Like
          </>
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Stats bar — emoji stack + numeric likes count + comments count.
// Sits above the action row, separated by a hairline border. Mirrors the
// LinkedIn-style aggregate strip in v4.
// ---------------------------------------------------------------------

function StatsBar({
  reactions,
  commentCount,
  onCommentsClick,
}: {
  reactions: CommunityPostRead['reactions']
  commentCount: number
  onCommentsClick?: () => void
}) {
  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0)
  // Stack the three most-used emojis with non-zero counts. Stable sort
  // by count desc, then by REACTIONS order to keep ties deterministic.
  const top = useMemo(() => {
    const ranked = REACTIONS.map((r) => {
      const found = reactions.find((x) => x.emoji === r.id)
      return { def: r, count: found?.count ?? 0 }
    })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    return ranked.map((r) => r.def.emoji)
  }, [reactions])

  if (totalReactions === 0 && commentCount === 0) {
    return <div className={styles.statsBar} aria-hidden="true" />
  }

  return (
    <div className={styles.statsBar}>
      <div className={styles.statsLeft}>
        {top.length > 0 && (
          <div className={styles.reactionStack}>
            {top.map((emoji, i) => (
              <span key={i} className="em">
                {emoji}
              </span>
            ))}
          </div>
        )}
        {totalReactions > 0 && <span>{totalReactions}</span>}
      </div>
      <button
        type="button"
        className={styles.statsRight}
        onClick={onCommentsClick}
        disabled={commentCount === 0 && !onCommentsClick}
      >
        {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Comment row + thread
// ---------------------------------------------------------------------

function CommentNodeView({
  comment,
  depth,
  onReply,
  onDelete,
  onReact,
  composingId,
  setComposingId,
  replyDraft,
  setReplyDraft,
  submitReply,
  isSubmittingReply,
  onSeek,
}: {
  comment: CommentNode<CommunityCommentRead>
  depth: number
  onReply: () => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: CommunityReactionEmoji) => void
  composingId: string | null
  setComposingId: (id: string | null) => void
  replyDraft: string
  setReplyDraft: (s: string) => void
  submitReply: () => void
  isSubmittingReply: boolean
  onSeek?: (seconds: number) => void
}) {
  const isComposing = composingId === comment.id
  return (
    <>
      <div className={`${styles.commentRow} ${depth > 0 ? styles.indent : ''}`}>
        <Avatar
          name={comment.deleted ? null : authorName(comment.author)}
          avatarUrl={comment.author.avatar_url ?? undefined}
          size={32}
        />
        <div className={styles.commentBody}>
          <div className={styles.commentBubble}>
            <div className={styles.commentHead}>
              <span className={styles.commentAuthor}>
                {comment.deleted ? 'Deleted user' : authorName(comment.author)}
              </span>
              {!comment.deleted && isInstructor(comment.author) && (
                <span className={`${styles.roleChip} ${styles.roleChipInstr}`}>
                  Instructor
                </span>
              )}
              <span className={styles.commentMeta}>
                {formatRelative(comment.created_at)}
              </span>
              {comment.timestamp_seconds !== null && onSeek && (
                <button
                  type="button"
                  className={styles.timestampChip}
                  onClick={() => onSeek(comment.timestamp_seconds!)}
                  title="Jump to this moment in the video"
                >
                  @ {formatTimestamp(comment.timestamp_seconds)}
                </button>
              )}
            </div>
            <div
              className={`${styles.commentContent} ${comment.deleted ? styles.deleted : ''}`}
            >
              {comment.deleted ? 'This comment was deleted.' : comment.content}
            </div>
          </div>
          {!comment.deleted && (
            <div className={styles.commentActions}>
              {depth === 0 && (
                <button
                  type="button"
                  className={styles.commentActionBtn}
                  onClick={() => {
                    onReply()
                    setReplyDraft('')
                    setComposingId(isComposing ? null : comment.id)
                  }}
                >
                  {isComposing ? 'Cancel' : 'Reply'}
                </button>
              )}
              <button
                type="button"
                className={styles.commentActionBtn}
                onClick={() => onReact(comment.id, 'heart')}
                aria-label="Heart comment"
              >
                ❤️
                {comment.reactions.find((r) => r.emoji === 'heart')?.count
                  ? ` ${comment.reactions.find((r) => r.emoji === 'heart')!.count}`
                  : ''}
              </button>
              {comment.is_own && (
                <button
                  type="button"
                  className={styles.commentActionBtn}
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) {
                      onDelete(comment.id)
                    }
                  }}
                  aria-label="Delete comment"
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
          )}
          {isComposing && (
            <div className={styles.replyComposer} style={{ marginTop: 8 }}>
              <textarea
                className={styles.replyInput}
                placeholder={`Reply to ${authorName(comment.author)}`}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                autoFocus
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    submitReply()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setComposingId(null)
                  }
                }}
              />
              <button
                type="button"
                className={styles.replySubmit}
                disabled={!replyDraft.trim() || isSubmittingReply}
                onClick={submitReply}
              >
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
      {comment.replies.map((r) => (
        <CommentNodeView
          key={r.id}
          comment={r}
          depth={Math.min(depth + 1, 1)}
          onReply={onReply}
          onDelete={onDelete}
          onReact={onReact}
          composingId={composingId}
          setComposingId={setComposingId}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          submitReply={submitReply}
          isSubmittingReply={isSubmittingReply}
          onSeek={onSeek}
        />
      ))}
    </>
  )
}

function CommentSection({
  token,
  courseId,
  postId,
  selfName,
  selfAvatarUrl,
  isVideoPost = false,
  videoElementRef,
  mode = 'customer',
}: {
  token: string
  courseId: string
  postId: string
  selfName?: string | null
  selfAvatarUrl?: string | null
  selfEnrollmentId?: string | null
  isVideoPost?: boolean
  videoElementRef?: React.MutableRefObject<HTMLVideoElement | null>
  mode?: CommunityIOMode
}) {
  const { data: comments = [], isLoading } = useCommunityPostComments(
    token,
    courseId,
    postId,
    mode,
  )
  const create = useCreateCommunityComment(token, courseId, postId, mode)
  const del = useDeleteCommunityComment(token, courseId, postId, mode)
  const reactComment = useToggleCommentReaction(token, courseId, postId, mode)

  const tree = useMemo(() => buildCommentTree(comments), [comments])

  const [draft, setDraft] = useState('')
  const [composingId, setComposingId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null)

  const readCurrentTime = useCallback((): number | null => {
    const el = videoElementRef?.current
    if (!el || Number.isNaN(el.currentTime)) return null
    return Math.max(0, Math.floor(el.currentTime))
  }, [videoElementRef])

  const seekTo = useCallback(
    (seconds: number) => {
      const el = videoElementRef?.current
      if (!el) return
      el.currentTime = seconds
      if (el.paused) void el.play().catch(() => undefined)
    },
    [videoElementRef],
  )

  const beginDraft = (value: string) => {
    setDraft(value)
    if (isVideoPost && value.length > 0 && pendingTimestamp === null) {
      setPendingTimestamp(readCurrentTime())
    }
    if (value.length === 0 && pendingTimestamp !== null) {
      setPendingTimestamp(null)
    }
  }

  const submitTopLevel = async () => {
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({
        content,
        timestamp_seconds: isVideoPost ? pendingTimestamp : null,
      })
      setDraft('')
      setPendingTimestamp(null)
    } catch {
      /* surface via mutation state */
    }
  }

  const submitReply = async () => {
    const content = replyDraft.trim()
    if (!content || !composingId) return
    try {
      await create.mutateAsync({
        content,
        parent_id: composingId,
        timestamp_seconds: isVideoPost ? readCurrentTime() : null,
      })
      setReplyDraft('')
      setComposingId(null)
    } catch {
      /* keep composer open so the draft survives */
    }
  }

  return (
    <div className={styles.comments}>
      <div className={styles.replyComposer}>
        <Avatar
          name={selfName ?? 'You'}
          avatarUrl={selfAvatarUrl ?? undefined}
          size={32}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            className={styles.replyInput}
            placeholder={
              isVideoPost
                ? 'Comment — pinned to the moment you start typing'
                : 'Write a comment'
            }
            value={draft}
            onChange={(e) => beginDraft(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submitTopLevel()
              }
            }}
          />
          {isVideoPost && pendingTimestamp !== null && (
            <div
              style={{
                marginTop: 4,
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                fontSize: 11,
                color: 'var(--c-muted)',
              }}
            >
              <span className={styles.timestampChip}>
                @ {formatTimestamp(pendingTimestamp)}
              </span>
              <button
                type="button"
                onClick={() => setPendingTimestamp(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--c-muted)',
                  fontSize: 11,
                  padding: 0,
                }}
              >
                Detach
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.replySubmit}
          disabled={!draft.trim() || create.isPending}
          onClick={submitTopLevel}
        >
          {create.isPending ? '…' : 'Send'}
        </button>
      </div>

      {isLoading && (
        <div className={styles.commentMeta} style={{ marginLeft: 44 }}>
          Loading comments…
        </div>
      )}
      {!isLoading && tree.length === 0 && (
        <div className={styles.commentMeta} style={{ marginLeft: 44 }}>
          No comments yet — be the first to reply.
        </div>
      )}
      {tree.map((c) => (
        <CommentNodeView
          key={c.id}
          comment={c}
          depth={0}
          onReply={() => {}}
          onDelete={(id) => del.mutate(id)}
          onReact={(commentId, emoji) =>
            reactComment.mutate({ commentId, emoji })
          }
          composingId={composingId}
          setComposingId={setComposingId}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          submitReply={submitReply}
          isSubmittingReply={create.isPending}
          onSeek={isVideoPost ? seekTo : undefined}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------

export type PostCardProps = {
  post: CommunityPostRead
  token: string
  courseId: string
  selfName?: string | null
  selfAvatarUrl?: string | null
  selfEnrollmentId?: string | null
  // The signed-in admin's user_id when in creator mode — used to flag
  // own posts (so the dots menu surfaces "Delete post") without
  // an enrollment.
  selfUserId?: string | null
  reactionsEnabled: boolean
  onLessonChipClick?: (lessonId: string) => void
  onShareToast?: (msg: string) => void
  /** Fired when the user clicks the 'Open activity' button on an
   * activity-pin post (pin_type === 'activity'). Receives the linked
   * activity id from the post payload. */
  onOpenActivity?: (activityId: string) => void
  // 'creator' routes every read/write to the dashboard-auth endpoints
  // and lets the admin interact as themselves. 'customer' is the
  // student-portal default.
  mode?: CommunityIOMode
}

function PostMediaGrid({
  media,
  onVideoElement,
  onOpenLightbox,
}: {
  media: CommunityPostRead['media']
  onVideoElement?: (el: HTMLVideoElement | null) => void
  onOpenLightbox?: (index: number) => void
}) {
  const video = useMemo(
    () => media.find((m) => m.media_type === 'video'),
    [media],
  )
  const images = useMemo(
    () =>
      media
        .filter((m) => m.media_type === 'image' && m.public_url)
        .slice(0, 4)
        .sort((a, b) => a.position - b.position),
    [media],
  )
  if (video) return <PostVideo media={video} onVideoElement={onVideoElement} />
  if (images.length === 0) return null
  // Single image renders at its natural aspect ratio so we don't crop
  // portraits or screenshots. Multi-image stays in the cropped grid for
  // layout sanity — the lightbox always shows the un-cropped original.
  const isSingle = images.length === 1
  return (
    <div
      className={`${styles.postMediaGrid} ${isSingle ? styles.postMediaGridSingle : ''}`}
      data-count={images.length}
    >
      {images.map((m, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={m.id}
          src={m.public_url!}
          alt=""
          loading="lazy"
          className={styles.postMediaImage}
          onClick={() => onOpenLightbox?.(idx)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Image lightbox — LinkedIn-style two-pane modal. The clicked image
// (with prev/next navigation through the other attachments) takes the
// left side at its natural aspect; the right side renders the post
// author, body and comment thread so the reader can react without
// leaving the modal.
// ---------------------------------------------------------------------

function PostImageLightbox({
  images,
  startIndex,
  onClose,
  post,
  token,
  courseId,
  selfName,
  selfAvatarUrl,
  selfEnrollmentId,
  reactionsEnabled,
  mode = 'customer',
}: {
  images: { id: string; public_url: string }[]
  startIndex: number
  onClose: () => void
  post: CommunityPostRead
  token: string
  courseId: string
  selfName?: string | null
  selfAvatarUrl?: string | null
  selfEnrollmentId?: string | null
  reactionsEnabled: boolean
  mode?: CommunityIOMode
}) {
  const [index, setIndex] = useState(startIndex)
  const togglePostReaction = useTogglePostReaction(token, courseId, mode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')
        setIndex((i) => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
    }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [images.length, onClose])

  const active = images[Math.max(0, Math.min(index, images.length - 1))]
  const onReact = (emoji: CommunityReactionEmoji) => {
    togglePostReaction.mutate({ postId: post.id, emoji })
  }

  return (
    <div
      className={styles.lightboxBackdrop}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.lightboxClose}
        onClick={onClose}
        aria-label="Close"
      >
        <IconX size={20} />
      </button>
      <div
        className={styles.lightboxFrame}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.lightboxImagePane}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.public_url} alt="" />
          {images.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
                onClick={() =>
                  setIndex((i) => (i - 1 + images.length) % images.length)
                }
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
                onClick={() => setIndex((i) => (i + 1) % images.length)}
                aria-label="Next image"
              >
                ›
              </button>
              <div className={styles.lightboxCounter}>
                {index + 1} / {images.length}
              </div>
            </>
          )}
        </div>
        <aside className={styles.lightboxSidebar}>
          <div className={styles.lightboxAuthor}>
            <Avatar
              name={authorName(post.author)}
              avatarUrl={post.author.avatar_url ?? undefined}
              size={42}
            />
            <div style={{ minWidth: 0 }}>
              <div className={styles.postAuthor}>{authorName(post.author)}</div>
              <div className={styles.postMeta}>
                {post.published_at ? formatRelative(post.published_at) : ''}
              </div>
            </div>
          </div>
          {post.body && post.body.trim().length > 0 && (
            <div style={{ marginTop: 6 }}>
              <ExpandableBody body={post.body} />
            </div>
          )}
          <StatsBar
            reactions={post.reactions}
            commentCount={post.comment_count}
          />
          {reactionsEnabled && (
            <div className={styles.postActions}>
              <LikeButton reactions={post.reactions} onToggle={onReact} />
            </div>
          )}
          <CommentSection
            token={token}
            courseId={courseId}
            postId={post.id}
            selfName={selfName}
            selfAvatarUrl={selfAvatarUrl}
            selfEnrollmentId={selfEnrollmentId}
            mode={mode}
          />
        </aside>
      </div>
    </div>
  )
}

function PostVideo({
  media,
  onVideoElement,
}: {
  media: CommunityPostRead['media'][number]
  onVideoElement?: (el: HTMLVideoElement | null) => void
}) {
  const ready =
    media.mux_status === 'ready' &&
    (media.playback_url !== null || media.mux_playback_id !== null)
  return (
    <div className={styles.postVideo}>
      {ready ? (
        <HlsVideo
          playbackId={media.mux_playback_id}
          playbackUrl={media.playback_url}
          poster={media.thumbnail_url}
          className={styles.postVideoFrame}
          onVideoElement={onVideoElement}
        />
      ) : (
        <div className={styles.postVideoProcessing}>
          <span>
            {media.mux_status === 'errored'
              ? 'Video failed to process'
              : 'Video is still processing…'}
          </span>
        </div>
      )}
    </div>
  )
}

// Milestone — auto-generated celebration post, unchanged single-line
// layout. Sits in its own gray panel rather than the standard post
// card so the celebratory tone is visually distinct.
function MilestoneCard({
  post,
  token,
  courseId,
  reactionsEnabled,
  mode = 'customer',
}: {
  post: CommunityPostRead
  token: string
  courseId: string
  reactionsEnabled: boolean
  mode?: CommunityIOMode
}) {
  const togglePostReaction = useTogglePostReaction(token, courseId, mode)
  const author =
    post.author.name ??
    (post.author.kind === 'instructor' ? 'Instructor' : 'Member')
  const clap = post.reactions.find((r) => r.emoji === 'clap')
  const mineClapped = clap?.mine ?? false

  const onCongrats = () => {
    if (!reactionsEnabled) return
    togglePostReaction.mutate({ postId: post.id, emoji: 'clap' })
  }

  return (
    <div className={styles.milestone} id={`post-${post.id}`}>
      <Avatar
        name={author}
        avatarUrl={post.author.avatar_url ?? undefined}
        size={42}
      />
      <div className={styles.milestoneText}>
        <div>
          <strong>{author}</strong> {post.body}
        </div>
        <div className={styles.milestoneSub}>
          {post.published_at ? formatRelative(post.published_at) : ''}
          {clap && clap.count > 0 ? ` · ${clap.count} 👏` : ''}
          {' · Auto-generated'}
        </div>
      </div>
      {reactionsEnabled && (
        <button
          type="button"
          className={styles.milestoneCta}
          onClick={onCongrats}
          aria-pressed={mineClapped}
        >
          {mineClapped ? 'Congrats sent' : 'Say congrats'}
        </button>
      )}
    </div>
  )
}

export function PostCard(props: PostCardProps) {
  if (props.post.tag?.slug === 'milestone') {
    return (
      <MilestoneCard
        post={props.post}
        token={props.token}
        courseId={props.courseId}
        reactionsEnabled={props.reactionsEnabled}
        mode={props.mode}
      />
    )
  }
  return <RegularPostCard {...props} />
}

function RegularPostCard({
  post,
  token,
  courseId,
  selfName,
  selfAvatarUrl,
  selfEnrollmentId,
  selfUserId,
  reactionsEnabled,
  onLessonChipClick,
  onShareToast,
  onOpenActivity,
  mode = 'customer',
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxImages = useMemo(
    () =>
      post.media
        .filter((m) => m.media_type === 'image' && m.public_url)
        .slice(0, 4)
        .sort((a, b) => a.position - b.position)
        .map((m) => ({ id: m.id, public_url: m.public_url! })),
    [post.media],
  )

  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const handleVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoElementRef.current = el
  }, [])

  const togglePostReaction = useTogglePostReaction(token, courseId, mode)
  const deletePost = useDeleteCommunityPost(token, courseId, mode)

  const onToggleReaction = (emoji: CommunityReactionEmoji) => {
    togglePostReaction.mutate({ postId: post.id, emoji })
  }

  const onShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      onShareToast?.('Link copied')
    } catch {
      onShareToast?.('Could not copy link')
    }
  }

  const onDelete = () => {
    if (window.confirm('Delete this post? This cannot be undone.')) {
      deletePost.mutate(post.id)
    }
  }

  const ownPost = useMemo(() => {
    if (
      selfEnrollmentId &&
      post.author.kind === 'student' &&
      post.author.enrollment_id === selfEnrollmentId
    ) {
      return true
    }
    if (
      selfUserId &&
      post.author.kind === 'instructor' &&
      post.author.user_id === selfUserId
    ) {
      return true
    }
    // In creator mode the admin can moderate anyone's post anyway, so
    // surface the menu for every card. The backend's moderator-delete
    // endpoint enforces course ownership.
    if (mode === 'creator') return true
    return false
  }, [post.author, selfEnrollmentId, selfUserId, mode])

  const isPinned = !!post.pinned_at
  const isInstr = isInstructor(post.author)

  return (
    <article className={styles.post} id={`post-${post.id}`}>
      <div className={styles.postHead}>
        <Avatar
          name={authorName(post.author)}
          avatarUrl={post.author.avatar_url ?? undefined}
          size={42}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.postAuthorRow}>
            <span className={styles.postAuthor}>{authorName(post.author)}</span>
            {isInstr && (
              <span className={`${styles.roleChip} ${styles.roleChipInstr}`}>
                Instructor
              </span>
            )}
            {isPinned && (
              <span className={styles.pinIndicator} title="Pinned">
                <IconPin size={11} />
              </span>
            )}
          </div>
          <div className={styles.postMeta}>
            <span>
              {post.published_at ? formatRelative(post.published_at) : 'Draft'}
            </span>
            {post.lesson && (
              <>
                <span className={styles.metaSep}>·</span>
                <span>{post.lesson.lesson_title}</span>
              </>
            )}
            {!post.lesson && post.module && (
              <>
                <span className={styles.metaSep}>·</span>
                <span>{post.module.module_title ?? 'Module'}</span>
              </>
            )}
            <span className={styles.metaSep}>·</span>
            <IconGlobe size={11} />
          </div>
        </div>
        {post.tag && (
          <span
            className={`${styles.tagPill} ${tagPillClass(post.tag.slug)}`}
            style={tagPillStyle(post.tag.slug)}
          >
            {post.tag.label}
          </span>
        )}
        {ownPost && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={styles.postMore}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Post menu"
            >
              <IconDots size={15} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className={styles.postMoreMenu}
                onMouseLeave={() => setMenuOpen(false)}
                onClick={(e) => {
                  // Stop the menu's clicks from bubbling to the card's
                  // open-handler — otherwise picking "Delete" would
                  // also navigate into the post.
                  e.stopPropagation()
                }}
              >
                <button
                  role="menuitem"
                  type="button"
                  className={styles.postMoreMenuItem}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.postBodyWrap}>
        {post.title && <h3 className={styles.postTitle}>{post.title}</h3>}
        {post.body && post.body.trim().length > 0 && (
          <ExpandableBody body={post.body} />
        )}
      </div>

      {post.pin_type === 'activity' && post.activity_id && onOpenActivity && (
        <button
          type="button"
          onClick={() => onOpenActivity(post.activity_id!)}
          style={{
            marginTop: 12,
            alignSelf: 'flex-start',
            height: 34,
            padding: '0 16px',
            borderRadius: 999,
            background: 'var(--c-ink)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Open activity →
        </button>
      )}

      {post.lesson && (
        <button
          type="button"
          className={styles.lessonChip}
          onClick={() => onLessonChipClick?.(post.lesson!.lesson_id)}
        >
          <IconBook size={11} /> re: {post.lesson.lesson_title}
        </button>
      )}

      {/* Module-scoped activity pins use a module chip instead of a
          lesson chip — they have no lesson context. */}
      {!post.lesson && post.module && (
        <span className={styles.lessonChip}>
          <IconBook size={11} /> re: {post.module.module_title ?? 'Module'}
        </span>
      )}

      <PostMediaGrid
        media={post.media}
        onVideoElement={post.type === 'video' ? handleVideoElement : undefined}
        onOpenLightbox={(idx) => setLightboxIndex(idx)}
      />

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <PostImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          post={post}
          token={token}
          courseId={courseId}
          selfName={selfName}
          selfAvatarUrl={selfAvatarUrl}
          selfEnrollmentId={selfEnrollmentId}
          reactionsEnabled={reactionsEnabled}
          mode={mode}
        />
      )}

      <StatsBar
        reactions={post.reactions}
        commentCount={post.comment_count}
        onCommentsClick={() => setCommentsOpen((v) => !v)}
      />

      <div className={styles.postActions}>
        {reactionsEnabled ? (
          <LikeButton reactions={post.reactions} onToggle={onToggleReaction} />
        ) : (
          <button type="button" className={styles.postAction} disabled>
            <IconThumbsUp size={16} /> Like
          </button>
        )}
        <button
          type="button"
          className={styles.postAction}
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
        >
          <IconChat size={16} />
          Comment
        </button>
        <button type="button" className={styles.postAction} onClick={onShare}>
          <IconRepeat size={16} />
          Share
        </button>
        <button type="button" className={styles.postAction} onClick={onShare}>
          <IconSend size={16} />
          Send
        </button>
      </div>

      {commentsOpen && (
        <CommentSection
          token={token}
          courseId={courseId}
          postId={post.id}
          selfName={selfName}
          selfAvatarUrl={selfAvatarUrl}
          selfEnrollmentId={selfEnrollmentId}
          isVideoPost={post.type === 'video'}
          videoElementRef={videoElementRef}
          mode={mode}
        />
      )}
    </article>
  )
}
