'use client'

import {
  CoachingPostRead,
  CoachingThreadRead,
  useCoachingPosts,
  useCreateCoachingPostAsCreator,
  useDeleteCoachingPostAsCreator,
  useModerateCoachingPost,
} from '@/hooks/queries/coaching'
import { CourseRead, useUpdateCourse } from '@/hooks/queries/courses'
import { useState } from 'react'
import { toast } from '../../Toast/use-toast'

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

export function CommunityTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: threads = [], isLoading } = useCoachingPosts(courseId)
  const createPost = useCreateCoachingPostAsCreator(courseId)
  const moderate = useModerateCoachingPost(courseId)
  const remove = useDeleteCoachingPostAsCreator(courseId)
  const updateCourse = useUpdateCourse()

  const [draft, setDraft] = useState('')

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
      await createPost.mutateAsync({ content })
      setDraft('')
    } catch (e) {
      toast({
        title: 'Could not post',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Community
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            A program-wide discussion board your members can post to.
            Coach-authored posts are visually distinct in the portal.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={course.community_enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
            disabled={updateCourse.isPending}
          />
          Community {course.community_enabled ? 'enabled' : 'disabled'}
        </label>
      </header>

      {!course.community_enabled && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          Community is disabled. Members won&apos;t see the discussion tab in
          their portal until you turn it on.
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
          Post as the coach
        </h2>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share an announcement, prompt, or update with the cohort…"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={!draft.trim() || createPost.isPending}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPost.isPending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
          Threads ({threads.length})
        </h2>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ) : threads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            No threads yet. Members will start posting as the program kicks off.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onPin={(pinned) =>
                  moderate.mutate({ postId: thread.id, pinned })
                }
                onHide={(hidden) =>
                  moderate.mutate({ postId: thread.id, hidden })
                }
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ThreadCard({
  thread,
  onPin,
  onHide,
  onDelete,
}: {
  thread: CoachingThreadRead
  onPin: (pinned: boolean) => void
  onHide: (hidden: boolean) => void
  onDelete: (postId: string) => void
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${thread.pinned ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'}`}
    >
      <PostBody post={thread} onDelete={onDelete} onHide={onHide} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPin(!thread.pinned)}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {thread.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          onClick={() => onHide(!thread.hidden)}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {thread.hidden ? 'Unhide' : 'Hide'}
        </button>
        <button
          onClick={() => onDelete(thread.id)}
          className="rounded-full px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
      {thread.replies.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-l-2 border-gray-100 pl-4">
          {thread.replies.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              onHide={(hidden) => onHide(hidden)}
              onDelete={(id) => onDelete(id)}
            />
          ))}
        </div>
      )}
    </article>
  )
}

function ReplyCard({
  reply,
  onHide,
  onDelete,
}: {
  reply: CoachingPostRead
  onHide: (hidden: boolean) => void
  onDelete: (postId: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <PostBody post={reply} onDelete={onDelete} onHide={onHide} />
      <div className="flex items-center gap-2">
        <button
          onClick={() => onHide(!reply.hidden)}
          className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
        >
          {reply.hidden ? 'Unhide' : 'Hide'}
        </button>
        <button
          onClick={() => onDelete(reply.id)}
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function PostBody({
  post,
  onDelete,
  onHide,
}: {
  post: CoachingPostRead
  onDelete: (postId: string) => void
  onHide: (hidden: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <header className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-gray-900">
          {post.is_creator ? 'Coach' : post.author.name || 'Member'}
        </span>
        {post.is_creator && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium tracking-wider text-blue-700 uppercase">
            Coach
          </span>
        )}
        {post.pinned && (
          <span className="text-[10px] font-medium tracking-wider text-gray-500 uppercase">
            Pinned
          </span>
        )}
        {post.hidden && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-amber-700 uppercase">
            Hidden
          </span>
        )}
        <span className="text-gray-500">· {fmtTime(post.created_at)}</span>
      </header>
      <p className="text-sm whitespace-pre-wrap text-gray-800">{post.content}</p>
    </div>
  )
}
