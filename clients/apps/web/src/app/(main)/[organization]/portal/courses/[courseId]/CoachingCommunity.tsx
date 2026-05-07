'use client'

import {
  CoachingPostRead,
  CoachingThreadRead,
  useCustomerCommunity,
  useCustomerCreatePost,
  useCustomerDeletePost,
} from '@/hooks/queries/coaching'
import { useState } from 'react'

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"
const C = {
  bg: '#ffffff',
  bg2: 'oklch(0.975 0.002 280)',
  line: 'oklch(0.92 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  fg1: 'oklch(0.32 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  accent: 'oklch(0.55 0.20 265)',
  accentSoft: 'oklch(0.97 0.04 265)',
}

const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function CoachingCommunity({ courseId }: { courseId: string }) {
  const { data, isLoading } = useCustomerCommunity(courseId)
  const create = useCustomerCreatePost(courseId)
  const remove = useCustomerDeletePost(courseId)

  const [draft, setDraft] = useState('')

  if (isLoading || !data) {
    return (
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto 16px',
          padding: '0 32px',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            height: 96,
            background: C.bg2,
            borderRadius: 20,
          }}
        />
      </section>
    )
  }

  if (!data.enabled) return null

  const handlePost = async () => {
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ content })
      setDraft('')
    } catch (e) {
      console.warn('community.post failed', e)
    }
  }

  return (
    <section
      style={{
        maxWidth: 1320,
        margin: '0 auto 16px',
        padding: '0 32px',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: 24,
          padding: 24,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: C.fg0,
            }}
          >
            Community
          </h2>
          <span style={{ fontSize: 12, color: C.fg3 }}>
            {data.threads.length}{' '}
            {data.threads.length === 1 ? 'thread' : 'threads'}
          </span>
        </header>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share a question or update with the cohort…"
            style={{
              fontFamily: FONT,
              fontSize: 14,
              padding: '12px 14px',
              borderRadius: 14,
              border: `1px solid ${C.line}`,
              background: C.bg2,
              color: C.fg0,
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handlePost}
              disabled={!draft.trim() || create.isPending}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 999,
                background: C.accent,
                border: 'none',
                cursor:
                  !draft.trim() || create.isPending ? 'not-allowed' : 'pointer',
                opacity: !draft.trim() || create.isPending ? 0.5 : 1,
              }}
            >
              {create.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>

        {data.threads.length === 0 ? (
          <p
            style={{
              padding: '32px 0',
              textAlign: 'center',
              fontSize: 13,
              color: C.fg3,
            }}
          >
            Be the first to start a discussion.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.threads.map((thread) => (
              <Thread
                key={thread.id}
                thread={thread}
                courseId={courseId}
                ownEnrollmentId={data.enrollment_id ?? null}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Thread({
  thread,
  courseId,
  ownEnrollmentId,
  onDelete,
}: {
  thread: CoachingThreadRead
  courseId: string
  ownEnrollmentId: string | null
  onDelete: (postId: string) => void
}) {
  const [replyDraft, setReplyDraft] = useState('')
  const [showReply, setShowReply] = useState(false)
  const create = useCustomerCreatePost(courseId)

  const handleReply = async () => {
    const content = replyDraft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ content, parent_id: thread.id })
      setReplyDraft('')
      setShowReply(false)
    } catch (e) {
      console.warn('community.reply failed', e)
    }
  }

  return (
    <article
      style={{
        background: thread.pinned ? C.accentSoft : C.bg2,
        border: thread.pinned ? `1px solid oklch(0.86 0.07 265)` : 'none',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <PostBody
        post={thread}
        ownEnrollmentId={ownEnrollmentId}
        onDelete={onDelete}
      />
      {thread.replies.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingLeft: 16,
            borderLeft: `2px solid ${C.line}`,
          }}
        >
          {thread.replies.map((reply) => (
            <PostBody
              key={reply.id}
              post={reply}
              ownEnrollmentId={ownEnrollmentId}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
      {showReply ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            rows={2}
            autoFocus
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Reply…"
            style={{
              fontFamily: FONT,
              fontSize: 13,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${C.line}`,
              background: C.bg,
              color: C.fg0,
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => {
                setShowReply(false)
                setReplyDraft('')
              }}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: C.fg2,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleReply}
              disabled={!replyDraft.trim() || create.isPending}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 999,
                background: C.accent,
                border: 'none',
                cursor: !replyDraft.trim() ? 'not-allowed' : 'pointer',
                opacity: !replyDraft.trim() ? 0.5 : 1,
              }}
            >
              {create.isPending ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowReply(true)}
          style={{
            alignSelf: 'flex-start',
            fontSize: 12,
            fontWeight: 500,
            color: C.fg2,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reply
        </button>
      )}
    </article>
  )
}

function PostBody({
  post,
  ownEnrollmentId,
  onDelete,
}: {
  post: CoachingPostRead
  ownEnrollmentId: string | null
  onDelete: (postId: string) => void
}) {
  const isOwn =
    !!ownEnrollmentId &&
    !!post.author.enrollment_id &&
    post.author.enrollment_id === ownEnrollmentId
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.fg0 }}>
            {post.is_creator
              ? 'Coach'
              : post.author.name || 'Member'}
          </span>
          {post.is_creator && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: C.accent,
                padding: '1px 8px',
                borderRadius: 999,
                background: C.accentSoft,
              }}
            >
              Coach
            </span>
          )}
          {post.pinned && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: C.fg2,
              }}
            >
              Pinned
            </span>
          )}
          <span style={{ fontSize: 11, color: C.fg3 }}>
            · {fmtTime(post.created_at)}
          </span>
        </div>
        {isOwn && (
          <button
            onClick={() => onDelete(post.id)}
            style={{
              fontSize: 11,
              color: C.fg3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
      </header>
      <p
        style={{
          fontSize: 14,
          color: C.fg1,
          margin: 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}
      >
        {post.content}
      </p>
    </div>
  )
}
