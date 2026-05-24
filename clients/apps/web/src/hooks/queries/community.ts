import { getQueryClient } from '@/utils/api/query'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------
// Types — mirror polar/community/schemas.py. Inlined (not imported from
// @spaire/client) so the dev cycle doesn't need `pnpm generate` to run
// for every backend tweak.
// ---------------------------------------------------------------------

export type CommunityReactionEmoji = 'clap' | 'heart' | 'fire' | 'idea' | 'pray'
export type CommentsMode = 'visible' | 'hidden' | 'locked'
export type CommunitySortProperty = 'recent' | 'top_week' | 'unanswered'
export type CommunityPinType = 'announcement' | 'prompt_of_week'

export interface CommunityAuthorInstructor {
  kind: 'instructor'
  user_id: string
  name: string | null
  avatar_url: string | null
}
export interface CommunityAuthorStudent {
  kind: 'student'
  enrollment_id: string
  name: string | null
  avatar_url: string | null
}
export type CommunityAuthor =
  | CommunityAuthorInstructor
  | CommunityAuthorStudent

export interface CommunityTagRead {
  id: string
  course_id: string
  slug: string
  label: string
  position: number
  created_at: string
  modified_at: string | null
}

export interface CommunityReactionSummaryEntry {
  emoji: CommunityReactionEmoji
  count: number
  mine: boolean
}

export interface CommunityLessonChip {
  lesson_id: string
  lesson_title: string
  module_id: string | null
  module_title: string | null
}

export interface CommunityPostMediaRead {
  id: string
  media_type: 'image' | 'video'
  position: number
  file_id: string | null
  public_url: string | null
  mux_playback_id: string | null
  mux_status: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
}

export interface CommunityPostRead {
  id: string
  course_id: string
  type: 'text' | 'video'
  title: string | null
  body: string
  body_format: 'markdown' | 'plain'
  author: CommunityAuthor
  lesson: CommunityLessonChip | null
  tag: CommunityTagRead | null
  media: CommunityPostMediaRead[]
  published_at: string | null
  pinned_at: string | null
  pin_type: CommunityPinType | null
  pin_expires_at: string | null
  comments_mode: CommentsMode | null
  reaction_count: number
  comment_count: number
  reactions: CommunityReactionSummaryEntry[]
  created_at: string
  modified_at: string | null
}

export interface CommunityCommentRead {
  id: string
  post_id: string
  parent_id: string | null
  author: CommunityAuthor
  content: string
  timestamp_seconds: number | null
  deleted: boolean
  is_own: boolean
  reactions: CommunityReactionSummaryEntry[]
  created_at: string
  modified_at: string | null
}

export interface CommunitySettingsRead {
  id: string
  course_id: string
  enabled: boolean
  show_in_portal_tabs: boolean
  comments_mode: CommentsMode
  hero_thumbnail_url: string | null
  hero_thumbnail_object_position: string | null
  feed_title_override: string | null
  feed_eyebrow_override: string | null
  module_label_overrides: Record<string, string> | null
  module_order: string[] | null
  reactions_enabled: boolean
  milestones_enabled: boolean
  watching_rail_enabled: boolean
  watching_rail_threshold: number
  presence_blurb: string | null
  prompt_of_week_post_id: string | null
  created_at: string
  modified_at: string | null
}

export interface CommunityFeedPage {
  items: CommunityPostRead[]
  pagination: { has_next_page: boolean }
}

export interface CommunityReactionToggleResult {
  emoji: CommunityReactionEmoji
  active: boolean
  count: number
}

export interface CommunityCourseSummary {
  course_id: string
  course_title: string | null
  course_thumbnail_url: string | null
  course_thumbnail_object_position: string | null
  community_enabled: boolean
}

export interface CommunityPostImageUploadResult {
  file_id: string
  public_url: string
  size: number
  mime_type: string
}

// ---------------------------------------------------------------------
// Fetch wrapper — same shape as portalApiFetch in courses.ts, lifted
// here so community hooks don't depend on a non-exported helper.
// ---------------------------------------------------------------------

async function portalFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ---------------------------------------------------------------------
// Query keys — keyed by token so a session swap forces a refetch.
// ---------------------------------------------------------------------

const settingsKey = (token: string, courseId: string) =>
  ['community-settings', token, courseId] as const

const tagsKey = (token: string, courseId: string) =>
  ['community-tags', token, courseId] as const

const feedKey = (
  token: string,
  courseId: string,
  filters: FeedFilters,
) => ['community-feed', token, courseId, filters] as const

const commentsKey = (token: string, courseId: string, postId: string) =>
  ['community-comments', token, courseId, postId] as const

// ---------------------------------------------------------------------
// Feed filters — match the customer-portal query params
// ---------------------------------------------------------------------

export interface FeedFilters {
  sort: CommunitySortProperty
  module_id: string | null
  lesson_id: string | null
  tag_id: string | null
}

const buildFeedQS = (filters: FeedFilters, cursor: string | null) => {
  const params = new URLSearchParams()
  params.set('sort', filters.sort)
  if (filters.module_id) params.set('module_id', filters.module_id)
  if (filters.lesson_id) params.set('lesson_id', filters.lesson_id)
  if (filters.tag_id) params.set('tag_id', filters.tag_id)
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

// ---------------------------------------------------------------------
// Settings + tags
// ---------------------------------------------------------------------

export const useCommunitySettings = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useQuery<CommunitySettingsRead>({
    queryKey: settingsKey(token ?? '', courseId ?? ''),
    queryFn: () =>
      portalFetch<CommunitySettingsRead>(
        `/v1/customer-portal/community/${courseId}/settings`,
        token!,
      ),
    enabled: !!token && !!courseId,
  })

export const useCommunityEnrolledCourses = (
  token: string | null | undefined,
) =>
  useQuery<CommunityCourseSummary[]>({
    queryKey: ['community-enrolled-courses', token],
    queryFn: () =>
      portalFetch<CommunityCourseSummary[]>(
        '/v1/customer-portal/community/courses',
        token!,
      ),
    enabled: !!token,
  })

export const useCommunityTags = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useQuery<CommunityTagRead[]>({
    queryKey: tagsKey(token ?? '', courseId ?? ''),
    queryFn: () =>
      portalFetch<CommunityTagRead[]>(
        `/v1/customer-portal/community/${courseId}/tags`,
        token!,
      ),
    enabled: !!token && !!courseId,
  })

// ---------------------------------------------------------------------
// Feed (cursor-paginated) — Phase 1 keeps "Load more" manual, no
// auto-infinite scroll. Returns one page per query.
// ---------------------------------------------------------------------

// Build the cursor for the *next* page from the tail of the current page.
// Mirrors the server-side encoding: `${pinned_at|published_at}__${id}`.
const nextCursorFromPage = (page: CommunityFeedPage): string | null => {
  if (!page.pagination.has_next_page) return null
  const last = page.items[page.items.length - 1]
  if (!last) return null
  const ts = last.pinned_at ?? last.published_at
  if (!ts) return null
  return `${ts}__${last.id}`
}

export const useCommunityFeed = (
  token: string | null | undefined,
  courseId: string | undefined,
  filters: FeedFilters,
) =>
  useInfiniteQuery<
    CommunityFeedPage,
    Error,
    { pages: CommunityFeedPage[]; pageParams: (string | null)[] },
    readonly unknown[],
    string | null
  >({
    queryKey: feedKey(token ?? '', courseId ?? '', filters),
    queryFn: ({ pageParam }) =>
      portalFetch<CommunityFeedPage>(
        `/v1/customer-portal/community/${courseId}/feed?${buildFeedQS(filters, pageParam)}`,
        token!,
      ),
    initialPageParam: null,
    getNextPageParam: (lastPage) => nextCursorFromPage(lastPage),
    enabled: !!token && !!courseId,
  })

// ---------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------

export interface CommunityPostMediaCreateBody {
  // media_type is fixed to "image" for Phase 2 — video lands in Phase 3.
  media_type?: 'image'
  file_id: string
  position?: number
}

export interface CommunityPostCreateBody {
  body: string
  title?: string | null
  body_format?: 'markdown' | 'plain'
  lesson_id?: string | null
  tag_id?: string | null
  media?: CommunityPostMediaCreateBody[]
}

const invalidateFeed = (token: string, courseId: string) => {
  getQueryClient().invalidateQueries({
    queryKey: ['community-feed', token, courseId],
  })
}

export const useCreateCommunityPost = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: (body: CommunityPostCreateBody) =>
      portalFetch<CommunityPostRead>(
        `/v1/customer-portal/community/${courseId}/posts`,
        token!,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (token && courseId) invalidateFeed(token, courseId)
    },
  })

// Server-proxied image upload. Posts FormData (not JSON) so portalFetch's
// JSON content-type would break it — multipart needs the browser to set
// the boundary header, which means *no* Content-Type override.
async function uploadPostImage(
  courseId: string,
  token: string,
  file: File,
): Promise<CommunityPostImageUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/community/${courseId}/media/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upload ${res.status}: ${text}`)
  }
  return res.json()
}

export const useUploadPostImage = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: (file: File) => uploadPostImage(courseId!, token!, file),
  })

export const useDeleteCommunityPost = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: (postId: string) =>
      portalFetch<void>(
        `/v1/customer-portal/community/${courseId}/posts/${postId}`,
        token!,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (token && courseId) invalidateFeed(token, courseId)
    },
  })

// ---------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------

export const useCommunityPostComments = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | null | undefined,
) =>
  useQuery<CommunityCommentRead[]>({
    queryKey: commentsKey(token ?? '', courseId ?? '', postId ?? ''),
    queryFn: () =>
      portalFetch<CommunityCommentRead[]>(
        `/v1/customer-portal/community/${courseId}/posts/${postId}/comments`,
        token!,
      ),
    enabled: !!token && !!courseId && !!postId,
  })

export const useCreateCommunityComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | undefined,
) =>
  useMutation({
    mutationFn: (body: {
      content: string
      parent_id?: string | null
      timestamp_seconds?: number | null
    }) =>
      portalFetch<CommunityCommentRead>(
        `/v1/customer-portal/community/${courseId}/posts/${postId}/comments`,
        token!,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (token && courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token, courseId, postId),
        })
        // Comment counters on the post card live on the feed payload —
        // refresh those too so the count chip stays accurate.
        invalidateFeed(token, courseId)
      }
    },
  })

export const useDeleteCommunityComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | undefined,
) =>
  useMutation({
    mutationFn: (commentId: string) =>
      portalFetch<void>(
        `/v1/customer-portal/community/${courseId}/comments/${commentId}`,
        token!,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (token && courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token, courseId, postId),
        })
        invalidateFeed(token, courseId)
      }
    },
  })

// ---------------------------------------------------------------------
// Reactions — optimistic toggle; mutate the cached feed in place so
// the post card updates immediately. On error we roll back.
// ---------------------------------------------------------------------

const applyReactionDelta = (
  post: CommunityPostRead,
  emoji: CommunityReactionEmoji,
  active: boolean,
  count: number,
): CommunityPostRead => {
  const reactions = [...post.reactions]
  const idx = reactions.findIndex((r) => r.emoji === emoji)
  if (idx >= 0) {
    reactions[idx] = { ...reactions[idx], count, mine: active }
  } else if (count > 0) {
    reactions.push({ emoji, count, mine: active })
  }
  // Total reaction_count from the server is authoritative; reuse it.
  const total = reactions.reduce((acc, r) => acc + r.count, 0)
  return { ...post, reactions, reaction_count: total }
}

export const useTogglePostReaction = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: ({
      postId,
      emoji,
    }: {
      postId: string
      emoji: CommunityReactionEmoji
    }) =>
      portalFetch<CommunityReactionToggleResult>(
        `/v1/customer-portal/community/${courseId}/posts/${postId}/react`,
        token!,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      ),
    onMutate: async ({ postId, emoji }) => {
      if (!token || !courseId) return
      // Snapshot every active feed page so we can roll back on error.
      const queryClient = getQueryClient()
      const snapshots = queryClient.getQueriesData<CommunityFeedPage>({
        queryKey: ['community-feed', token, courseId],
      })
      // Optimistic: flip `mine` on the existing entry and bump count by ±1.
      for (const [key, page] of snapshots) {
        if (!page) continue
        const items = page.items.map((p) => {
          if (p.id !== postId) return p
          const existing = p.reactions.find((r) => r.emoji === emoji)
          const willBeActive = !(existing?.mine ?? false)
          const nextCount =
            (existing?.count ?? 0) + (willBeActive ? 1 : -1)
          return applyReactionDelta(p, emoji, willBeActive, Math.max(nextCount, 0))
        })
        queryClient.setQueryData(key, { ...page, items })
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      // Roll back to the snapshots we took in onMutate.
      const queryClient = getQueryClient()
      ctx?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSuccess: (result, { postId }) => {
      // Server-confirmed count: settle the optimistic state.
      if (!token || !courseId) return
      const queryClient = getQueryClient()
      const snapshots = queryClient.getQueriesData<CommunityFeedPage>({
        queryKey: ['community-feed', token, courseId],
      })
      for (const [key, page] of snapshots) {
        if (!page) continue
        const items = page.items.map((p) =>
          p.id === postId
            ? applyReactionDelta(p, result.emoji, result.active, result.count)
            : p,
        )
        queryClient.setQueryData(key, { ...page, items })
      }
    },
  })

// =====================================================================
// CREATOR-SIDE (course editor) — same module, dashboard auth.
// These calls go through the standard logged-in dashboard session, not
// the customer-portal token, so they use a different fetch helper.
// =====================================================================

async function creatorFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const creatorSettingsKey = (courseId: string) =>
  ['creator-community-settings', courseId] as const

const creatorPostsKey = (courseId: string) =>
  ['creator-community-posts', courseId] as const

export const useCreatorCommunitySettings = (courseId: string | undefined) =>
  useQuery<CommunitySettingsRead>({
    queryKey: creatorSettingsKey(courseId ?? ''),
    queryFn: () =>
      creatorFetch<CommunitySettingsRead>(`/v1/community/${courseId}/settings`),
    enabled: !!courseId,
  })

export const useUpdateCommunitySettings = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (payload: Partial<CommunitySettingsRead>) =>
      creatorFetch<CommunitySettingsRead>(
        `/v1/community/${courseId}/settings`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
    onSuccess: (data) => {
      if (!courseId) return
      // Optimistic-style: stash the server-returned settings so the form
      // doesn't blink while the GET re-fires.
      getQueryClient().setQueryData(creatorSettingsKey(courseId), data)
      getQueryClient().invalidateQueries({
        queryKey: creatorSettingsKey(courseId),
      })
    },
  })

// ----- Creator tag editor -----

const creatorTagsKey = (courseId: string) =>
  ['creator-community-tags', courseId] as const

export const useCreatorCommunityTags = (courseId: string | undefined) =>
  useQuery<CommunityTagRead[]>({
    queryKey: creatorTagsKey(courseId ?? ''),
    queryFn: () =>
      creatorFetch<CommunityTagRead[]>(`/v1/community/${courseId}/tags`),
    enabled: !!courseId,
  })

export const useCreateCommunityTag = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (body: { label: string; slug?: string | null }) =>
      creatorFetch<CommunityTagRead>(`/v1/community/${courseId}/tags`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (courseId)
        getQueryClient().invalidateQueries({
          queryKey: creatorTagsKey(courseId),
        })
    },
  })

export const useUpdateCommunityTag = (courseId: string | undefined) =>
  useMutation({
    mutationFn: ({
      tagId,
      label,
      position,
    }: {
      tagId: string
      label?: string | null
      position?: number | null
    }) =>
      creatorFetch<CommunityTagRead>(
        `/v1/community/${courseId}/tags/${tagId}`,
        { method: 'PATCH', body: JSON.stringify({ label, position }) },
      ),
    onSuccess: () => {
      if (courseId)
        getQueryClient().invalidateQueries({
          queryKey: creatorTagsKey(courseId),
        })
    },
  })

export const useDeleteCommunityTag = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (tagId: string) =>
      creatorFetch<void>(`/v1/community/${courseId}/tags/${tagId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      if (!courseId) return
      getQueryClient().invalidateQueries({
        queryKey: creatorTagsKey(courseId),
      })
      // Posts may have lost their tag chips — refresh the moderation
      // list so the creator sees the cleared state.
      getQueryClient().invalidateQueries({
        queryKey: creatorPostsKey(courseId),
      })
    },
  })

export const useReorderCommunityTags = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (orderedIds: string[]) =>
      creatorFetch<CommunityTagRead[]>(
        `/v1/community/${courseId}/tags/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({ ordered_ids: orderedIds }),
        },
      ),
    onSuccess: (data) => {
      if (!courseId) return
      // Server returns the canonical order — write straight in so the
      // optimistic UI settles without an extra refetch round-trip.
      getQueryClient().setQueryData(creatorTagsKey(courseId), data)
    },
  })

export const useCreatorCommunityPosts = (courseId: string | undefined) =>
  useInfiniteQuery<
    CommunityFeedPage,
    Error,
    { pages: CommunityFeedPage[]; pageParams: (string | null)[] },
    readonly unknown[],
    string | null
  >({
    queryKey: creatorPostsKey(courseId ?? ''),
    queryFn: ({ pageParam }) => {
      const qs = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''
      return creatorFetch<CommunityFeedPage>(
        `/v1/community/${courseId}/posts${qs}`,
      )
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      // Moderation cursor uses created_at (the encode_moderation_cursor
      // method on the service side). Re-build it from the last item.
      if (!lastPage.pagination.has_next_page) return null
      const last = lastPage.items[lastPage.items.length - 1]
      if (!last) return null
      return `${last.created_at}__${last.id}`
    },
    enabled: !!courseId,
  })

// Read-only feed for the course-editor preview pane. Same shape as
// useCommunityFeed (useInfiniteQuery, FeedFilters) but uses
// creatorFetch (dashboard session cookie) and hits the creator-side
// preview endpoint, so the creator doesn't need a customer session
// token to render what students would see.
const creatorPreviewKey = (courseId: string, filters: FeedFilters) =>
  ['creator-community-preview', courseId, filters] as const

export const useCreatorCommunityFeed = (
  courseId: string | undefined,
  filters: FeedFilters,
) =>
  useInfiniteQuery<
    CommunityFeedPage,
    Error,
    { pages: CommunityFeedPage[]; pageParams: (string | null)[] },
    readonly unknown[],
    string | null
  >({
    queryKey: creatorPreviewKey(courseId ?? '', filters),
    queryFn: ({ pageParam }) => {
      const qs = buildFeedQS(filters, pageParam)
      return creatorFetch<CommunityFeedPage>(
        `/v1/community/${courseId}/preview?${qs}`,
      )
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => nextCursorFromPage(lastPage),
    enabled: !!courseId,
  })

export const useCreatorDeletePost = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (postId: string) =>
      creatorFetch<void>(`/v1/community/${courseId}/posts/${postId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      if (!courseId) return
      getQueryClient().invalidateQueries({
        queryKey: creatorPostsKey(courseId),
      })
    },
  })

export const useCreatorDeleteComment = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (commentId: string) =>
      creatorFetch<void>(`/v1/community/${courseId}/comments/${commentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      if (!courseId) return
      getQueryClient().invalidateQueries({
        queryKey: creatorPostsKey(courseId),
      })
    },
  })

export const usePinPost = (courseId: string | undefined) =>
  useMutation({
    mutationFn: ({
      postId,
      pinType,
      expiresAt,
    }: {
      postId: string
      pinType: CommunityPinType
      expiresAt?: string | null
    }) =>
      creatorFetch<CommunityPostRead>(
        `/v1/community/${courseId}/posts/${postId}/pin`,
        {
          method: 'POST',
          body: JSON.stringify({
            pin_type: pinType,
            expires_at: expiresAt ?? null,
          }),
        },
      ),
    onSuccess: () => {
      if (!courseId) return
      getQueryClient().invalidateQueries({
        queryKey: creatorPostsKey(courseId),
      })
      // Settings holds prompt_of_week_post_id — refresh so the editor
      // shows the new pin in its preview.
      getQueryClient().invalidateQueries({
        queryKey: creatorSettingsKey(courseId),
      })
    },
  })

export const useUnpinPost = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (postId: string) =>
      creatorFetch<CommunityPostRead>(
        `/v1/community/${courseId}/posts/${postId}/pin`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (!courseId) return
      getQueryClient().invalidateQueries({
        queryKey: creatorPostsKey(courseId),
      })
      getQueryClient().invalidateQueries({
        queryKey: creatorSettingsKey(courseId),
      })
    },
  })

export const useToggleCommentReaction = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | undefined,
) =>
  useMutation({
    mutationFn: ({
      commentId,
      emoji,
    }: {
      commentId: string
      emoji: CommunityReactionEmoji
    }) =>
      portalFetch<CommunityReactionToggleResult>(
        `/v1/customer-portal/community/${courseId}/comments/${commentId}/react`,
        token!,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      ),
    onSuccess: () => {
      if (token && courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token, courseId, postId),
        })
      }
    },
  })
