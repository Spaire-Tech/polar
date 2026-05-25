'use client'

import {
  type CommunityAuthor,
  type CommunityCommentRead,
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
import { useCallback, useMemo, useRef, useState } from 'react'
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
} from './icons'

type ReactionDef = {
  id: CommunityReactionEmoji
  emoji: string
  label: string
}

const REACTIONS: ReactionDef[] = [
  { id: 'clap', emoji: '👏', label: 'Celebrate' },
  { id: 'heart', emoji: '❤️', label: 'Love' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'idea', emoji: '💡', label: 'Insightful' },
  { id: 'pray', emoji: '🙏', label: 'Support' },
]

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

// ---------------------------------------------------------------------
// Like button — collapsed default + hover-reveal reaction picker.
// Replaces the old always-visible inline emoji row. The stats bar above
// the action row carries the aggregate count.
// ---------------------------------------------------------------------

function LikeButton({
  reactions,
  onToggle,
  disabled,
}: {
  reactions: CommunityPostRead['reactions']
  onToggle: (emoji: CommunityReactionEmoji) => void
  disabled?: boolean
}) {
  const mine = useMemo(() => reactions.find((r) => r.mine), [reactions])
  const active = mine ? REACTION_BY_ID[mine.emoji] : null
  const [burst, setBurst] = useState(false)

  const choose = (id: CommunityReactionEmoji) => {
    if (disabled) return
    setBurst(true)
    setTimeout(() => setBurst(false), 400)
    onToggle(id)
  }

  // Tapping the button itself (no hover) toggles the default "Like"
  // reaction — we map that to clap since the backend doesn't ship a
  // thumbs-up emoji.
  const onPrimary = () => choose(active ? active.id : 'clap')

  return (
    <div className={styles.likeWrap}>
      {!disabled && (
        <div className={styles.reactionPicker}>
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={styles.rx}
              onClick={() => choose(r.id)}
              aria-label={r.label}
            >
              <span className={styles.rxLabel}>{r.label}</span>
              {r.emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`${styles.postAction} ${active ? styles.reacted : ''}`}
        onClick={onPrimary}
        disabled={disabled}
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
      {commentCount > 0 && (
        <button
          type="button"
          className={styles.statsRight}
          onClick={onCommentsClick}
        >
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </button>
      )}
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
  isVideoPost = false,
  videoElementRef,
}: {
  token: string
  courseId: string
  postId: string
  selfName?: string | null
  selfEnrollmentId?: string | null
  isVideoPost?: boolean
  videoElementRef?: React.MutableRefObject<HTMLVideoElement | null>
}) {
  const { data: comments = [], isLoading } = useCommunityPostComments(
    token,
    courseId,
    postId,
  )
  const create = useCreateCommunityComment(token, courseId, postId)
  const del = useDeleteCommunityComment(token, courseId, postId)
  const reactComment = useToggleCommentReaction(token, courseId, postId)

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
        <Avatar name={selfName ?? 'You'} size={32} />
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
  selfEnrollmentId?: string | null
  reactionsEnabled: boolean
  onLessonChipClick?: (lessonId: string) => void
  onShareToast?: (msg: string) => void
  previewMode?: boolean
}

function PostMediaGrid({
  media,
  onVideoElement,
}: {
  media: CommunityPostRead['media']
  onVideoElement?: (el: HTMLVideoElement | null) => void
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
  return (
    <div className={styles.postMediaGrid} data-count={images.length}>
      {images.map((m) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={m.id}
          src={m.public_url!}
          alt=""
          loading="lazy"
          className={styles.postMediaImage}
        />
      ))}
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
  previewMode,
}: {
  post: CommunityPostRead
  token: string
  courseId: string
  reactionsEnabled: boolean
  previewMode?: boolean
}) {
  const togglePostReaction = useTogglePostReaction(token, courseId)
  const author =
    post.author.name ??
    (post.author.kind === 'instructor' ? 'Instructor' : 'Member')
  const clap = post.reactions.find((r) => r.emoji === 'clap')
  const mineClapped = clap?.mine ?? false

  const onCongrats = () => {
    if (!reactionsEnabled || previewMode) return
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
          disabled={previewMode}
          style={previewMode ? { cursor: 'default', opacity: 0.7 } : undefined}
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
        previewMode={props.previewMode}
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
  selfEnrollmentId,
  reactionsEnabled,
  onLessonChipClick,
  onShareToast,
  previewMode,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const handleVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoElementRef.current = el
  }, [])

  const togglePostReaction = useTogglePostReaction(token, courseId)
  const deletePost = useDeleteCommunityPost(token, courseId)

  const onToggleReaction = (emoji: CommunityReactionEmoji) => {
    if (previewMode) return
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
    if (!selfEnrollmentId) return false
    return (
      post.author.kind === 'student' &&
      post.author.enrollment_id === selfEnrollmentId
    )
  }, [post.author, selfEnrollmentId])

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
            <span className={styles.metaSep}>·</span>
            <IconGlobe size={11} />
          </div>
        </div>
        {ownPost && !previewMode && (
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
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 32,
                  background: '#fff',
                  border: '1px solid var(--c-hair)',
                  borderRadius: 10,
                  padding: 4,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
                  zIndex: 5,
                  minWidth: 120,
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  role="menuitem"
                  type="button"
                  className={styles.commentActionBtn}
                  style={{
                    padding: '6px 10px',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onClick={() => {
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
          <p className={styles.postBody}>{post.body}</p>
        )}
      </div>

      {post.lesson && (
        <button
          type="button"
          className={styles.lessonChip}
          onClick={() => onLessonChipClick?.(post.lesson!.lesson_id)}
        >
          <IconBook size={11} /> re: {post.lesson.lesson_title}
        </button>
      )}

      <PostMediaGrid
        media={post.media}
        onVideoElement={post.type === 'video' ? handleVideoElement : undefined}
      />

      <StatsBar
        reactions={post.reactions}
        commentCount={post.comment_count}
        onCommentsClick={
          previewMode ? undefined : () => setCommentsOpen((v) => !v)
        }
      />

      <div className={styles.postActions}>
        {reactionsEnabled ? (
          <LikeButton
            reactions={post.reactions}
            onToggle={onToggleReaction}
            disabled={previewMode}
          />
        ) : (
          <button type="button" className={styles.postAction} disabled>
            <IconThumbsUp size={16} /> Like
          </button>
        )}
        <button
          type="button"
          className={styles.postAction}
          onClick={previewMode ? undefined : () => setCommentsOpen((v) => !v)}
          aria-expanded={previewMode ? undefined : commentsOpen}
          disabled={previewMode}
        >
          <IconChat size={16} />
          Comment
        </button>
        <button
          type="button"
          className={styles.postAction}
          onClick={previewMode ? undefined : onShare}
          disabled={previewMode}
        >
          <IconRepeat size={16} />
          Share
        </button>
        <button
          type="button"
          className={styles.postAction}
          onClick={previewMode ? undefined : onShare}
          disabled={previewMode}
        >
          <IconSend size={16} />
          Send
        </button>
      </div>

      {!previewMode && commentsOpen && (
        <CommentSection
          token={token}
          courseId={courseId}
          postId={post.id}
          selfName={selfName}
          selfEnrollmentId={selfEnrollmentId}
          isVideoPost={post.type === 'video'}
          videoElementRef={videoElementRef}
        />
      )}
    </article>
  )
}
