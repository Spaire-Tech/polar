'use client'

import {
  useCreateLessonComment,
  useDeleteLessonComment,
  useLessonComments,
  type LessonCommentRead,
} from '@/hooks/queries/courses'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ReplyOutlined from '@mui/icons-material/ReplyOutlined'
import { twMerge } from 'tailwind-merge'
import { useMemo, useState } from 'react'

type CommentNode = LessonCommentRead & { replies: CommentNode[] }

function buildTree(comments: LessonCommentRead[]): CommentNode[] {
  const byId = new Map<string, CommentNode>()
  comments.forEach((c) => byId.set(c.id, { ...c, replies: [] }))
  const roots: CommentNode[] = []
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.replies.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

function formatRelative(iso: string): string {
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

export function CommentThread({
  token,
  courseId,
  lessonId,
}: {
  token: string
  courseId: string
  lessonId: string
}) {
  const { data: comments = [], isLoading } = useLessonComments(
    token,
    courseId,
    lessonId,
  )
  const tree = useMemo(() => buildTree(comments), [comments])
  const create = useCreateLessonComment(token, courseId, lessonId)
  const del = useDeleteLessonComment(token, courseId, lessonId)

  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const submitTopLevel = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    await create.mutateAsync({ content: trimmed })
    setDraft('')
  }

  const submitReply = async (parentId: string) => {
    const trimmed = replyDraft.trim()
    if (!trimmed) return
    await create.mutateAsync({ content: trimmed, parent_id: parentId })
    setReplyDraft('')
    setReplyTo(null)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-900">
        Discussion
        {comments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-400">
            {comments.length}
          </span>
        )}
      </h3>

      <div className="mb-6 flex gap-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="flex-1 resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
        <button
          onClick={submitTopLevel}
          disabled={create.isPending || !draft.trim()}
          className="self-start rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {create.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400">Loading comments…</div>
      ) : tree.length === 0 ? (
        <div className="text-sm text-gray-400">
          No comments yet. Be the first to start the discussion.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              depth={0}
              onReply={(id) => {
                setReplyTo(id === replyTo ? null : id)
                setReplyDraft('')
              }}
              activeReplyId={replyTo}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              onSubmitReply={submitReply}
              onDelete={(id) => del.mutate(id)}
              isPosting={create.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentItem({
  comment,
  depth,
  onReply,
  activeReplyId,
  replyDraft,
  setReplyDraft,
  onSubmitReply,
  onDelete,
  isPosting,
}: {
  comment: CommentNode
  depth: number
  onReply: (id: string) => void
  activeReplyId: string | null
  replyDraft: string
  setReplyDraft: (s: string) => void
  onSubmitReply: (parentId: string) => void
  onDelete: (id: string) => void
  isPosting: boolean
}) {
  const showReplyBox = activeReplyId === comment.id
  return (
    <div
      className={twMerge(depth > 0 && 'ml-4 border-l-2 border-gray-100 pl-4')}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
          {(comment.author.name ?? '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-900">
              {comment.author.name ?? 'Student'}
            </span>
            <span className="text-xs text-gray-400">
              {formatRelative(comment.created_at)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            {depth < 2 && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 hover:text-gray-900"
              >
                <ReplyOutlined sx={{ fontSize: 14 }} />
                Reply
              </button>
            )}
            {comment.is_own && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 hover:text-red-600"
              >
                <DeleteOutlined sx={{ fontSize: 14 }} />
                Delete
              </button>
            )}
          </div>

          {showReplyBox && (
            <div className="mt-3 flex gap-2">
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={`Reply to ${comment.author.name ?? 'Student'}…`}
                rows={2}
                autoFocus
                className="flex-1 resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
              <button
                onClick={() => onSubmitReply(comment.id)}
                disabled={isPosting || !replyDraft.trim()}
                className="self-start rounded-full bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isPosting ? 'Posting…' : 'Post'}
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              onReply={onReply}
              activeReplyId={activeReplyId}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              isPosting={isPosting}
            />
          ))}
        </div>
      )}
    </div>
  )
}
