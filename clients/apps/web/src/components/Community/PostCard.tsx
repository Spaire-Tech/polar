'use client'

import { useMemo, useState } from 'react'
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
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconBook, IconChat, IconDots, IconShare, IconTrash } from './icons'

const EMOJI_GLYPH: Record<CommunityReactionEmoji, string> = {
  clap: '👏',
  heart: '❤️',
  fire: '🔥',
  idea: '💡',
  pray: '🙏',
}
const EMOJI_ORDER: CommunityReactionEmoji[] = [
  'clap',
  'heart',
  'fire',
  'idea',
  'pray',
]

const formatRelative = (iso: string): string => {
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const authorName = (a: CommunityAuthor): string =>
  a.name ?? (a.kind === 'instructor' ? 'Instructor' : 'Member')

const isInstructor = (a: CommunityAuthor): boolean => a.kind === 'instructor'

// ---------------------------------------------------------------------
// Reactions row
// ---------------------------------------------------------------------

function ReactionsRow({
  reactions,
  onToggle,
  reactionsEnabled,
}: {
  reactions: CommunityPostRead['reactions']
  onToggle: (emoji: CommunityReactionEmoji) => void
  reactionsEnabled: boolean
}) {
  if (!reactionsEnabled) return null
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r]))
  return (
    <div className={styles.reactions}>
      {EMOJI_ORDER.map((emoji) => {
        const r = byEmoji.get(emoji)
        const count = r?.count ?? 0
        const mine = r?.mine ?? false
        // Hide zero-count rows so the row stays compact, but keep
        // at least one so the user can click to add a first reaction.
        if (count === 0 && !mine) {
          return null
        }
        return (
          <button
            key={emoji}
            type="button"
            className={`${styles.reaction} ${mine ? styles.active : ''}`}
            onClick={() => onToggle(emoji)}
            aria-label={`${mine ? 'Remove' : 'Add'} ${emoji} reaction`}
          >
            <span className={styles.reactionEmoji}>{EMOJI_GLYPH[emoji]}</span>
            {count > 0 ? count : ''}
          </button>
        )
      })}
      {/* Always-visible "react" affordance — falls back to clap when
          no reactions exist yet, so users don't have to discover the
          row via hover. */}
      {reactions.every((r) => r.count === 0) && (
        <button
          type="button"
          className={styles.reaction}
          onClick={() => onToggle('clap')}
          aria-label="Add reaction"
        >
          <span className={styles.reactionEmoji}>{EMOJI_GLYPH.clap}</span>
          React
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
  selfEnrollmentId,
  onReply,
  onDelete,
  onReact,
  composingId,
  setComposingId,
  replyDraft,
  setReplyDraft,
  submitReply,
  isSubmittingReply,
}: {
  comment: CommentNode<CommunityCommentRead>
  depth: number
  selfEnrollmentId?: string | null
  onReply: () => void
  onDelete: (id: string) => void
  onReact: (id: string, emoji: CommunityReactionEmoji) => void
  composingId: string | null
  setComposingId: (id: string | null) => void
  replyDraft: string
  setReplyDraft: (s: string) => void
  submitReply: () => void
  isSubmittingReply: boolean
}) {
  const isComposing = composingId === comment.id
  return (
    <>
      <div className={`${styles.commentRow} ${depth > 0 ? styles.indent : ''}`}>
        <Avatar
          name={comment.deleted ? null : authorName(comment.author)}
          avatarUrl={comment.author.avatar_url ?? undefined}
          size={28}
        />
        <div className={styles.commentBody}>
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
          </div>
          <div
            className={`${styles.commentContent} ${comment.deleted ? styles.deleted : ''}`}
          >
            {comment.deleted ? 'This comment was deleted.' : comment.content}
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
                {EMOJI_GLYPH.heart}
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
            <div className={styles.replyComposer}>
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
          selfEnrollmentId={selfEnrollmentId}
          onReply={onReply}
          onDelete={onDelete}
          onReact={onReact}
          composingId={composingId}
          setComposingId={setComposingId}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          submitReply={submitReply}
          isSubmittingReply={isSubmittingReply}
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
  selfEnrollmentId,
}: {
  token: string
  courseId: string
  postId: string
  selfName?: string | null
  selfEnrollmentId?: string | null
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

  const submitTopLevel = async () => {
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ content })
      setDraft('')
    } catch {
      /* surface via mutation state */
    }
  }

  const submitReply = async () => {
    const content = replyDraft.trim()
    if (!content || !composingId) return
    try {
      await create.mutateAsync({ content, parent_id: composingId })
      setReplyDraft('')
      setComposingId(null)
    } catch {
      /* keep composer open so the draft survives */
    }
  }

  return (
    <div className={styles.comments}>
      {/* Top-level composer */}
      <div className={styles.replyComposer}>
        <Avatar name={selfName ?? 'You'} size={28} />
        <textarea
          className={styles.replyInput}
          placeholder="Write a comment"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submitTopLevel()
            }
          }}
        />
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
        <div className={styles.commentMeta} style={{ marginLeft: 40 }}>
          Loading comments…
        </div>
      )}
      {!isLoading && tree.length === 0 && (
        <div className={styles.commentMeta} style={{ marginLeft: 40 }}>
          No comments yet — be the first to reply.
        </div>
      )}
      {tree.map((c) => (
        <CommentNodeView
          key={c.id}
          comment={c}
          depth={0}
          selfEnrollmentId={selfEnrollmentId}
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
}

// ---------------------------------------------------------------------
// Image grid — 1, 2, 3, or 4-up. Renders only image media (video is
// Phase 3). Aspect-ratio differs per count so 1 image gets a full
// 16:9 frame and 2-4 collapse to a square grid.
// ---------------------------------------------------------------------

function PostMediaGrid({ media }: { media: CommunityPostRead['media'] }) {
  const images = useMemo(
    () =>
      media
        .filter((m) => m.media_type === 'image' && m.public_url)
        .slice(0, 4)
        .sort((a, b) => a.position - b.position),
    [media],
  )
  if (images.length === 0) return null
  return (
    <div
      className={styles.postMediaGrid}
      data-count={images.length}
    >
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

// ---------------------------------------------------------------------
// Milestone variant — auto-generated "X just finished Module 2"
// posts rendered as a single-line celebration card. The author name
// gets prepended into the body so it reads in third person.
// Distinct from the regular PostCard layout: gray panel background,
// inline avatar+text, single "Say congrats" CTA that toggles 👏.
// ---------------------------------------------------------------------

function MilestoneCard({
  post,
  token,
  courseId,
  reactionsEnabled,
}: {
  post: CommunityPostRead
  token: string
  courseId: string
  reactionsEnabled: boolean
}) {
  const togglePostReaction = useTogglePostReaction(token, courseId)
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
  // Milestone-tagged posts get a dedicated celebratory render that
  // doesn't carry a composer / reactions row / comment thread.
  // Dispatch happens outside any hooks so the underlying components
  // keep their hook ordering stable across renders (Rules of Hooks).
  if (props.post.tag?.slug === 'milestone') {
    return (
      <MilestoneCard
        post={props.post}
        token={props.token}
        courseId={props.courseId}
        reactionsEnabled={props.reactionsEnabled}
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
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const togglePostReaction = useTogglePostReaction(token, courseId)
  const deletePost = useDeleteCommunityPost(token, courseId)

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

  // Detect whether the viewer owns this post.
  const ownPost = useMemo(() => {
    if (!selfEnrollmentId) return false
    return (
      post.author.kind === 'student' &&
      post.author.enrollment_id === selfEnrollmentId
    )
  }, [post.author, selfEnrollmentId])

  return (
    <article className={styles.post} id={`post-${post.id}`}>
      <div className={styles.postHead}>
        <Avatar
          name={authorName(post.author)}
          avatarUrl={post.author.avatar_url ?? undefined}
          size={38}
        />
        <div>
          <div className={styles.postAuthorRow}>
            <span className={styles.postAuthor}>{authorName(post.author)}</span>
            {isInstructor(post.author) && (
              <span className={`${styles.roleChip} ${styles.roleChipInstr}`}>
                Instructor
              </span>
            )}
            {post.tag && (
              <span className={styles.tagPill}>{post.tag.label}</span>
            )}
          </div>
          <div className={styles.postMeta}>
            {post.published_at
              ? formatRelative(post.published_at)
              : 'Draft'}
          </div>
        </div>
        {ownPost && (
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
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
                  style={{ padding: '6px 10px', width: '100%', textAlign: 'left' }}
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

      {post.lesson && (
        <button
          type="button"
          className={styles.lessonChip}
          onClick={() => onLessonChipClick?.(post.lesson!.lesson_id)}
        >
          <IconBook size={12} /> re: {post.lesson.lesson_title}
        </button>
      )}

      {post.title && <h3 className={styles.postTitle}>{post.title}</h3>}
      {post.body && post.body.trim().length > 0 && (
        <p className={styles.postBody}>{post.body}</p>
      )}

      <PostMediaGrid media={post.media} />

      <ReactionsRow
        reactions={post.reactions}
        onToggle={onToggleReaction}
        reactionsEnabled={reactionsEnabled}
      />

      <div className={styles.postActions}>
        <button
          type="button"
          className={styles.postAction}
          onClick={() => setCommentsOpen((v) => !v)}
          aria-expanded={commentsOpen}
        >
          <IconChat size={14} />
          {post.comment_count}{' '}
          {post.comment_count === 1 ? 'comment' : 'comments'}
        </button>
        <button
          type="button"
          className={styles.postAction}
          onClick={onShare}
        >
          <IconShare size={14} /> Share
        </button>
      </div>

      {commentsOpen && (
        <CommentSection
          token={token}
          courseId={courseId}
          postId={post.id}
          selfName={selfName}
          selfEnrollmentId={selfEnrollmentId}
        />
      )}
    </article>
  )
}
