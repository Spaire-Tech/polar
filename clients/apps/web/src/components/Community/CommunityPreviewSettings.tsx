'use client'

// Lifted out of `Courses/editor/CommunityTab.tsx` so the community
// editor can live in the LeftRail's `settings` view rather than in
// a split-screen pane next to the live preview. Renders the
// full settings/tags/moderation form for a course's community —
// the host is the only one who ever sees it (gated by `canCreate`
// on CommunityPreview).
//
// This file is a literal lift of the previous left-column form.
// Behaviour is unchanged; the only difference is it now stands
// alone as a route-level component fed by `courseId`.

import { toast } from '@/components/Toast/use-toast'
import {
  type CommunityPostRead,
  type CommunitySettingsRead,
  type CommunityTagRead,
  useCreateCommunityTag,
  useCreatorCommunityPosts,
  useCreatorCommunitySettings,
  useCreatorCommunityTags,
  useCreatorDeletePost,
  useDeleteCommunityTag,
  usePinPost,
  useUnpinPost,
  useUpdateCommunitySettings,
} from '@/hooks/queries/community'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import Switch from '@spaire/ui/components/atoms/Switch'
import type { FocusEvent } from 'react'
import { useMemo, useState } from 'react'

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

export function CommunityPreviewSettings({ courseId }: { courseId: string }) {
  const settingsQ = useCreatorCommunitySettings(courseId)
  const postsQ = useCreatorCommunityPosts(courseId)
  const update = useUpdateCommunitySettings(courseId)
  const deletePost = useCreatorDeletePost(courseId)
  const pinPost = usePinPost(courseId)
  const unpinPost = useUnpinPost(courseId)

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
      setDraft({})
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
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (settingsQ.isError || !current) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="rounded-xl bg-red-50 p-4 text-red-600">
          Couldn’t load community settings.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-lg font-medium text-gray-900">
          Community settings
        </h1>
        <p className="mt-1 text-gray-500">
          A per-course feed students can post in, comment on, and react to.
        </p>
      </div>

      {/* Status — note: the Community enabled toggle is intentionally
          duplicated next to the Settings tab in the LeftRail for
          quick access. Both write to the same setting. */}
      <ShadowBox>
        <h2 className="text-base font-medium text-gray-900">Status</h2>
        <p className="mt-1 text-sm text-gray-500">
          When community is off, the tab is hidden from the customer portal and
          the route returns a disabled banner.
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
                const v = e.target.value as 'visible' | 'hidden' | 'locked'
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

      <ShadowBox>
        <h2 className="text-base font-medium text-gray-900">Header</h2>
        <p className="mt-1 text-sm text-gray-500">
          Text shown at the top of the feed. Defaults to the course title + a
          generic blurb when blank.
        </p>
        <div className="mt-5 flex flex-col gap-4">
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
              Subtitle override
            </label>
            <Input
              className="mt-1.5"
              placeholder="e.g. Discussions, wins, and questions for the cohort"
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

      <TagsSection courseId={courseId} />

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
          {/* Presence blurb is set by the weekly cron and stored on the
              settings row, but the LeftRail consumer that renders it
              hasn't shipped yet. Hiding the manual override here keeps
              the settings UI honest — bring it back once the rail
              displays the value. */}
        </div>
      </ShadowBox>

      <ShadowBox>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900">Moderation</h2>
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
            No posts yet. Open the community as a student to write the first
            one.
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
                        description: e instanceof Error ? e.message : undefined,
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
  const isPromptOfWeek = post.id === promptOfWeekId
  const isPinned = !!post.pinned_at

  return (
    <li className="flex items-start justify-between gap-3 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{author}</span>
          {post.author.kind === 'instructor' && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
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
            {post.published_at ? formatRelative(post.published_at) : 'Draft'}
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

function TagsSection({ courseId }: { courseId: string }) {
  const tagsQ = useCreatorCommunityTags(courseId)
  const create = useCreateCommunityTag(courseId)
  const del = useDeleteCommunityTag(courseId)
  const [newLabel, setNewLabel] = useState('')

  const tags = tagsQ.data ?? []

  const onAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    try {
      await create.mutateAsync({ label })
      setNewLabel('')
    } catch (e) {
      toast({
        title: 'Couldn’t add tag',
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const onDelete = (tag: CommunityTagRead) => {
    if (!window.confirm(`Remove the "${tag.label}" tag?`)) return
    del.mutate(tag.id, {
      onError: (e) =>
        toast({
          title: 'Couldn’t remove tag',
          description: e instanceof Error ? e.message : undefined,
        }),
    })
  }

  return (
    <ShadowBox>
      <h2 className="text-base font-medium text-gray-900">Tags</h2>
      <p className="mt-1 text-sm text-gray-500">
        Filter chips on the feed. Students pick one when they post.
      </p>

      {tagsQ.isLoading ? (
        <div className="mt-4 h-10 animate-pulse rounded-lg bg-gray-100" />
      ) : tags.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-gray-500">
          No tags yet. Add one below.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {tag.label}
                </div>
                <div className="text-xs text-gray-500">{tag.slug}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(tag)}
                disabled={del.isPending}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Input
          className="flex-1"
          placeholder="New tag label (e.g. Recipe)"
          value={newLabel}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNewLabel(e.currentTarget.value)
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
        />
        <Button onClick={onAdd} disabled={!newLabel.trim() || create.isPending}>
          Add
        </Button>
      </div>
    </ShadowBox>
  )
}
