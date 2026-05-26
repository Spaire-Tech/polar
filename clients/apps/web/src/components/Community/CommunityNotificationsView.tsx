'use client'

// Recent-activity view for the host inside the community editor. v1
// just surfaces the latest posts + a count badge — it answers
// "anything new since I last looked?" without needing a brand-new
// notification stream on the org-side. When org-side instructor
// notifications get their own surface, swap the data source here.

import {
  type CommunityPostRead,
  useCreatorCommunityPosts,
} from '@/hooks/queries/community'
import { useMemo } from 'react'

const formatRelative = (iso: string): string => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function CommunityNotificationsView({ courseId }: { courseId: string }) {
  const postsQ = useCreatorCommunityPosts(courseId)
  const posts: CommunityPostRead[] = useMemo(
    () => postsQ.data?.pages.flatMap((p) => p.items) ?? [],
    [postsQ.data],
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-lg font-medium text-gray-900">Notifications</h1>
        <p className="mt-1 text-gray-500">
          Recent activity in your community — new posts, comments, and
          submissions land here as they happen.
        </p>
      </div>

      {postsQ.isLoading ? (
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          You&apos;re all caught up. New posts from your cohort will show up
          here.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {posts.map((p) => {
            const who =
              p.author.name ??
              (p.author.kind === 'instructor' ? 'Instructor' : 'Member')
            const when = p.published_at
              ? formatRelative(p.published_at)
              : 'draft'
            const tagLabel = p.tag?.label
            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-900">{who}</span>
                    {p.author.kind === 'instructor' && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
                        Instructor
                      </span>
                    )}
                    <span>posted</span>
                    {tagLabel && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 uppercase">
                        {tagLabel}
                      </span>
                    )}
                    <span>·</span>
                    <span>{when}</span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-gray-900">
                    {p.title ?? p.body.slice(0, 120)}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {p.comment_count}{' '}
                      {p.comment_count === 1 ? 'comment' : 'comments'}
                    </span>
                    <span>
                      {p.reaction_count}{' '}
                      {p.reaction_count === 1 ? 'reaction' : 'reactions'}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
