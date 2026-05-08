'use client'

// Community tab — ported from community.jsx in the design handoff.
// Wires to /v1/coaching/posts.

import {
  useCoachingPosts,
  useCreateCoachingPostAsCreator,
  useDeleteCoachingPostAsCreator,
  useModerateCoachingPost,
  type CoachingPostRead,
  type CoachingThreadRead,
} from '@/hooks/queries/coaching'
import { useUpdateCourse, type CourseRead } from '@/hooks/queries/courses'
import { useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Avatar, Btn, SectionHead, Toggle } from '../ui'

const fmtTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

type ThreadFilter = 'all' | 'pinned' | 'hidden'

export function CommunityTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: threads = [] } = useCoachingPosts(courseId)
  const create = useCreateCoachingPostAsCreator(courseId)
  const moderate = useModerateCoachingPost(courseId)
  const remove = useDeleteCoachingPostAsCreator(courseId)
  const updateCourse = useUpdateCourse()

  const [filter, setFilter] = useState<ThreadFilter>('all')
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState('')

  const filtered = threads.filter((t) => {
    if (filter === 'pinned') return t.pinned
    if (filter === 'hidden') return t.hidden
    return !t.hidden
  })

  const handleToggleEnabled = async (next: boolean) => {
    try {
      await updateCourse.mutateAsync({
        courseId,
        body: { community_enabled: next },
      })
    } catch (e) {
      toast({
        title: 'Could not update setting',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handlePost = async () => {
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ content })
      setDraft('')
      setPosting(false)
    } catch (e) {
      toast({
        title: 'Could not post',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <>
      <SectionHead
        title="Community"
        subtitle="Threaded discussion — one reply deep, on purpose. Calmer than chat."
        actions={
          <span
            className="ce-row"
            style={{ gap: 10, color: 'var(--ink-3)', fontSize: 13 }}
          >
            {course.community_enabled ? 'Enabled' : 'Disabled'}
            <Toggle
              on={course.community_enabled}
              onChange={handleToggleEnabled}
            />
          </span>
        }
      />

      {!course.community_enabled && (
        <div
          className="ce-card ce-card-pad"
          style={{ background: 'var(--bg-muted)', color: 'var(--ink-3)' }}
        >
          Community is disabled. Members won&apos;t see the discussion tab in
          their portal until you turn it on.
        </div>
      )}

      {course.community_enabled && (
        <>
          <div
            className="ce-card"
            style={{ marginBottom: 16, padding: '14px 16px' }}
          >
            <div className="ce-row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Avatar name="Coach" size={32} />
              <div style={{ flex: 1 }}>
                {posting ? (
                  <>
                    <textarea
                      className="ce-textarea"
                      placeholder="Post a thread to your cohort…"
                      rows={3}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div
                      className="ce-row"
                      style={{ marginTop: 8, justifyContent: 'flex-end', gap: 6 }}
                    >
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPosting(false)
                          setDraft('')
                        }}
                      >
                        Cancel
                      </Btn>
                      <Btn
                        variant="primary"
                        size="sm"
                        onClick={handlePost}
                        disabled={!draft.trim() || create.isPending}
                      >
                        {create.isPending ? 'Posting…' : 'Post as coach'}
                      </Btn>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setPosting(true)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 11px',
                      border: '1px solid var(--line-strong)',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--bg)',
                      color: 'var(--ink-4)',
                      fontSize: 13.5,
                      cursor: 'pointer',
                    }}
                  >
                    Post a thread to your cohort…
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className="ce-row"
            style={{ marginBottom: 12, gap: 4 }}
          >
            {(
              [
                { id: 'all', label: 'All threads', count: threads.filter((t) => !t.hidden).length },
                { id: 'pinned', label: 'Pinned', count: threads.filter((t) => t.pinned).length },
                { id: 'hidden', label: 'Hidden', count: threads.filter((t) => t.hidden).length },
              ] as { id: ThreadFilter; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={
                  'ce-btn ce-btn-sm ' + (filter === f.id ? 'ce-btn-primary' : 'ce-btn-ghost')
                }
              >
                {f.label}{' '}
                <span style={{ opacity: 0.6, marginLeft: 2 }}>{f.count}</span>
              </button>
            ))}
          </div>

          <div className="ce-card">
            {filtered.length === 0 ? (
              <div className="ce-empty" style={{ borderRadius: 0 }}>
                <div className="glyph">
                  <Ic.Users size={20} />
                </div>
                <h3>Quiet so far</h3>
                <p>
                  Once your cohort starts posting, threads land here. Post the
                  first one to break the ice.
                </p>
              </div>
            ) : (
              filtered.map((t) => (
                <Thread
                  key={t.id}
                  thread={t}
                  onPin={() =>
                    moderate.mutate({ postId: t.id, pinned: !t.pinned })
                  }
                  onHide={() =>
                    moderate.mutate({ postId: t.id, hidden: !t.hidden })
                  }
                  onDelete={() => remove.mutate(t.id)}
                  onReply={async (content) => {
                    try {
                      await create.mutateAsync({
                        content,
                        parent_id: t.id,
                      })
                    } catch (e) {
                      toast({
                        title: 'Could not post reply',
                        description:
                          e instanceof Error ? e.message : 'Unknown error',
                      })
                      throw e
                    }
                  }}
                  replying={create.isPending}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  )
}

function Thread({
  thread,
  onPin,
  onHide,
  onDelete,
  onReply,
  replying,
}: {
  thread: CoachingThreadRead
  onPin: () => void
  onHide: () => void
  onDelete: () => void
  onReply: (content: string) => Promise<void>
  replying: boolean
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const submitReply = async () => {
    const content = replyDraft.trim()
    if (!content) return
    try {
      await onReply(content)
      setReplyDraft('')
      setShowReply(false)
    } catch {
      // toast handled upstream
    }
  }
  return (
    <div className="ce-thread">
      {thread.pinned && (
        <div className="ce-pinned-tag">
          <Ic.Pin size={11} /> Pinned by coach
        </div>
      )}
      <div className="ce-thread-head">
        <Avatar name={thread.is_creator ? 'Coach' : thread.author.name || 'M'} size={32} />
        <div style={{ flex: 1 }}>
          <div>
            <span className="ce-thread-author">
              {thread.is_creator ? 'Coach' : thread.author.name || 'Member'}
            </span>
            {thread.is_creator && (
              <span className="ce-coach-badge">COACH</span>
            )}
            <span
              className="ce-muted ce-tiny"
              style={{ marginLeft: 8 }}
            >
              · {fmtTime(thread.created_at)}
            </span>
          </div>
          <div className="ce-thread-body">{thread.content}</div>
          <div className="ce-thread-actions">
            <button
              className="ce-thread-action"
              onClick={() => setShowReply((v) => !v)}
            >
              <Ic.Reply size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              {thread.reply_count} repl{thread.reply_count === 1 ? 'y' : 'ies'}
            </button>
            <span style={{ color: 'var(--ink-5)' }}>·</span>
            <button className="ce-thread-action" onClick={onPin}>
              <Ic.Pin size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              {thread.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="ce-thread-action" onClick={onHide}>
              <Ic.Hide size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              {thread.hidden ? 'Unhide' : 'Hide'}
            </button>
            <button className="ce-thread-action" onClick={onDelete}>
              <Ic.Trash size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              Delete
            </button>
          </div>
        </div>
      </div>
      {thread.replies.map((r: CoachingPostRead) => (
        <div className="ce-reply" key={r.id}>
          <div className="ce-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Avatar
              name={r.is_creator ? 'Coach' : r.author.name || 'M'}
              size={24}
            />
            <div style={{ flex: 1 }}>
              <div>
                <span
                  className="ce-thread-author"
                  style={{ fontSize: 13 }}
                >
                  {r.is_creator ? 'Coach' : r.author.name || 'Member'}
                </span>
                {r.is_creator && (
                  <span className="ce-coach-badge">COACH</span>
                )}
                <span
                  className="ce-muted ce-tiny"
                  style={{ marginLeft: 8 }}
                >
                  · {fmtTime(r.created_at)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  marginTop: 4,
                  color: 'var(--ink-2)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {r.content}
              </div>
            </div>
          </div>
        </div>
      ))}
      {showReply && (
        <div className="ce-reply" style={{ background: 'var(--bg)' }}>
          <div className="ce-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <Avatar name="Coach" size={24} />
            <div style={{ flex: 1 }}>
              <textarea
                className="ce-textarea"
                rows={2}
                autoFocus
                placeholder="Reply as coach…"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
              />
              <div
                className="ce-row"
                style={{
                  marginTop: 8,
                  justifyContent: 'flex-end',
                  gap: 6,
                }}
              >
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReply(false)
                    setReplyDraft('')
                  }}
                >
                  Cancel
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={submitReply}
                  disabled={!replyDraft.trim() || replying}
                >
                  {replying ? 'Posting…' : 'Reply as coach'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
