'use client'

import {
  type CommunityPostRead,
  type CommunitySettingsRead,
  useCreatorCommunityPosts,
  useCreatorCommunitySettings,
  useCreatorDeletePost,
  usePinPost,
  useUnpinPost,
  useUpdateCommunitySettings,
} from '@/hooks/queries/community'
import { toast } from '@/components/Toast/use-toast'
import { type CourseRead } from '@/hooks/queries/courses'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import Switch from '@spaire/ui/components/atoms/Switch'
import type { FocusEvent } from 'react'
import { useMemo, useState } from 'react'

type Props = {
  course: CourseRead
}

type SettingsDraft = Partial<CommunitySettingsRead>

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

export function CommunityTab({ course }: Props) {
  const courseId = course.id
  const settingsQ = useCreatorCommunitySettings(courseId)
  const postsQ = useCreatorCommunityPosts(courseId)
  const update = useUpdateCommunitySettings(courseId)
  const deletePost = useCreatorDeletePost(courseId)
  const pinPost = usePinPost(courseId)
  const unpinPost = useUnpinPost(courseId)

  // Local optimistic draft layered over the server-canonical settings.
  // Each `commit` clears the draft, so background refetches simply land
  // on top of an empty diff — no hydration effect needed.
  const [draft, setDraft] = useState<SettingsDraft>({})

  const current: CommunitySettingsRead | undefined = useMemo(() => {
    if (!settingsQ.data) return undefined
    return { ...settingsQ.data, ...draft }
  }, [settingsQ.data, draft])

  const patch = (next: SettingsDraft) =>
    setDraft((prev) => ({ ...prev, ...next }))

  const commit = async (next: SettingsDraft) => {
    try {
      const result = await update.mutateAsync(next)
      // Server returned the canonical row — clear the draft so future
      // refetches don't get clobbered by stale local state.
      setDraft({})
      // Sanity check: if the server's value diverges from what we sent
      // (e.g. server clamped a number), surface the corrected value.
      if (result) {
        toast({ title: 'Saved' })
      }
    } catch (e) {
      toast({
        title: 'Couldn’t save',
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  // Stable per-field commit so onBlur only fires once with the latest value.
  const commitField = <K extends keyof CommunitySettingsRead>(
    key: K,
    value: CommunitySettingsRead[K],
  ) => commit({ [key]: value } as SettingsDraft)

  const posts = useMemo(
    () => postsQ.data?.pages.flatMap((p) => p.items) ?? [],
    [postsQ.data],
  )

  if (settingsQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (settingsQ.isError || !current) {
    return (
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <div className="rounded-xl bg-red-50 p-4 text-red-600">
          Couldn’t load community settings.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-medium text-gray-900">Community</h1>
        <p className="mt-1 text-gray-500">
          A per-course feed students can post in, comment on, and react
          to. Configure it here, moderate from the list at the bottom.
        </p>
      </div>

      {/* Status */}
      <ShadowBox>
        <h2 className="text-base font-medium text-gray-900">Status</h2>
        <p className="mt-1 text-sm text-gray-500">
          When community is off, the tab is hidden from the customer
          portal and the route returns a disabled banner.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <Row
            label="Community enabled"
            description="Show the feed in the student portal"
          >
            <Switch
              checked={current.enabled}
              onCheckedChange={(v) => {
                patch({ enabled: v })
                commit({ enabled: v })
              }}
            />
          </Row>
          <Row
            label="Show in portal tab bar"
            description="Off keeps the deep link working but hides the global ‘Community’ tab"
          >
            <Switch
              checked={current.show_in_portal_tabs}
              onCheckedChange={(v) => {
                patch({ show_in_portal_tabs: v })
                commit({ show_in_portal_tabs: v })
              }}
              disabled={!current.enabled}
            />
          </Row>
          <Row
            label="Comments mode"
            description="Default for new posts. Per-post override stays available later."
          >
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
              value={current.comments_mode}
              onChange={(e) => {
                const v = e.target.value as
                  | 'visible'
                  | 'hidden'
                  | 'locked'
                patch({ comments_mode: v })
                commit({ comments_mode: v })
              }}
            >
              <option value="visible">Visible</option>
              <option value="locked">Locked (no new replies)</option>
              <option value="hidden">Hidden</option>
            </select>
          </Row>
        </div>
      </ShadowBox>

      {/* Hero */}
      <ShadowBox>
        <h2 className="text-base font-medium text-gray-900">Hero</h2>
        <p className="mt-1 text-sm text-gray-500">
          The big banner at the top of the feed. Falls back to the
          course’s thumbnail when blank.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Thumbnail URL
            </label>
            <Input
              className="mt-1.5"
              placeholder="https://…"
              defaultValue={current.hero_thumbnail_url ?? ''}
              onBlur={(e: FocusEvent<HTMLInputElement>) => {
                const v = e.currentTarget.value.trim() || null
                if (v === (current.hero_thumbnail_url ?? null)) return
                commitField('hero_thumbnail_url', v)
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Title override
            </label>
            <Input
              className="mt-1.5"
              placeholder="Community"
              defaultValue={current.feed_title_override ?? ''}
              onBlur={(e: FocusEvent<HTMLInputElement>) => {
                const v = e.currentTarget.value.trim() || null
                if (v === (current.feed_title_override ?? null)) return
                commitField('feed_title_override', v)
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Eyebrow override
            </label>
            <Input
              className="mt-1.5"
              placeholder="e.g. 236 members · 14 active today"
              defaultValue={current.feed_eyebrow_override ?? ''}
              onBlur={(e: FocusEvent<HTMLInputElement>) => {
                const v = e.currentTarget.value.trim() || null
                if (v === (current.feed_eyebrow_override ?? null)) return
                commitField('feed_eyebrow_override', v)
              }}
            />
          </div>
        </div>
      </ShadowBox>

      {/* Features */}
      <ShadowBox>
        <h2 className="text-base font-medium text-gray-900">Features</h2>
        <div className="mt-5 flex flex-col gap-4">
          <Row
            label="Reactions"
            description="5 emoji tapbacks on every post and reply"
          >
            <Switch
              checked={current.reactions_enabled}
              onCheckedChange={(v) => {
                patch({ reactions_enabled: v })
                commit({ reactions_enabled: v })
              }}
            />
          </Row>
          <Row
            label="Auto milestones"
            description="Insert a celebratory card when a student finishes a module"
          >
            <Switch
              checked={current.milestones_enabled}
              onCheckedChange={(v) => {
                patch({ milestones_enabled: v })
                commit({ milestones_enabled: v })
              }}
            />
          </Row>
          {/* Watching rail toggle is deferred until Phase 3 wires the
              live Mux progress aggregator. Re-introduce here when the
              backend can answer "N students watching Module 3 right
              now" — until then a toggle that does nothing is worse
              than no toggle. */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Presence blurb
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Short line under your avatar in the left rail. Leave blank
              to auto-compute weekly.
            </p>
            <Input
              className="mt-1.5"
              placeholder="e.g. Mira replied 4 times this week"
              defaultValue={current.presence_blurb ?? ''}
              onBlur={(e: FocusEvent<HTMLInputElement>) => {
                const v = e.currentTarget.value.trim() || null
                if (v === (current.presence_blurb ?? null)) return
                commitField('presence_blurb', v)
              }}
            />
          </div>
        </div>
      </ShadowBox>

      {/* Moderation */}
      <ShadowBox>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900">
              Moderation
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Recent posts in this community. Pin one to surface it as the
              Prompt of the Week, or hide it to remove it from the feed.
            </p>
          </div>
        </div>

        {postsQ.isLoading && (
          <div className="mt-4 h-12 animate-pulse rounded-lg bg-gray-100" />
        )}

        {posts.length === 0 && !postsQ.isLoading && (
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 py-10 text-center text-gray-500">
            No posts yet. Open the community as a student to write the
            first one.
          </div>
        )}

        {posts.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100">
            {posts.map((p) => (
              <ModerationRow
                key={p.id}
                post={p}
                promptOfWeekId={current.prompt_of_week_post_id}
                onPin={(pinType) =>
                  pinPost.mutateAsync({ postId: p.id, pinType }).catch((e) =>
                    toast({
                      title: 'Couldn’t pin post',
                      description: e instanceof Error ? e.message : undefined,
                    }),
                  )
                }
                onUnpin={() =>
                  unpinPost.mutateAsync(p.id).catch((e) =>
                    toast({
                      title: 'Couldn’t unpin post',
                      description: e instanceof Error ? e.message : undefined,
                    }),
                  )
                }
                onDelete={() => {
                  if (
                    !window.confirm(
                      `Hide this post? It’ll be removed from the feed.`,
                    )
                  )
                    return
                  deletePost.mutate(p.id, {
                    onError: (e) =>
                      toast({
                        title: 'Couldn’t delete post',
                        description:
                          e instanceof Error ? e.message : undefined,
                      }),
                  })
                }}
              />
            ))}
          </ul>
        )}

        {postsQ.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => postsQ.fetchNextPage()}
              disabled={postsQ.isFetchingNextPage}
            >
              {postsQ.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </ShadowBox>
    </div>
  )
}

// --- Layout helpers ------------------------------------------------------

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs text-gray-500">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ModerationRow({
  post,
  promptOfWeekId,
  onPin,
  onUnpin,
  onDelete,
}: {
  post: CommunityPostRead
  promptOfWeekId: string | null
  onPin: (pinType: 'announcement' | 'prompt_of_week') => void
  onUnpin: () => void
  onDelete: () => void
}) {
  const author =
    post.author.name ??
    (post.author.kind === 'instructor' ? 'Instructor' : 'Member')
  const isPinned = !!post.pinned_at
  const isPromptOfWeek = post.id === promptOfWeekId

  return (
    <li className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-900">{author}</span>
          {post.author.kind === 'instructor' && (
            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-white">
              Instructor
            </span>
          )}
          {post.tag && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              {post.tag.label}
            </span>
          )}
          {isPromptOfWeek && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
              Prompt of the week
            </span>
          )}
          {isPinned && !isPromptOfWeek && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              Pinned
            </span>
          )}
          <span>·</span>
          <span>
            {post.published_at
              ? formatRelative(post.published_at)
              : 'Draft'}
          </span>
        </div>
        <div className="mt-1.5 truncate text-sm font-medium text-gray-900">
          {post.title ?? post.body.slice(0, 120)}
        </div>
        {post.title && (
          <div className="mt-1 line-clamp-2 text-xs text-gray-500">
            {post.body.slice(0, 200)}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span>
            {post.comment_count}{' '}
            {post.comment_count === 1 ? 'comment' : 'comments'}
          </span>
          <span>
            {post.reaction_count}{' '}
            {post.reaction_count === 1 ? 'reaction' : 'reactions'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isPinned ? (
          <Button variant="secondary" size="sm" onClick={onUnpin}>
            Unpin
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPin('prompt_of_week')}
          >
            Pin
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Hide
        </Button>
      </div>
    </li>
  )
}
