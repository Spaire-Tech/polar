import { getQueryClient } from '@/utils/api/query'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------
// Types — mirror polar/community/schemas.py. Inlined (not imported from
// @spaire/client) so the dev cycle doesn't need `pnpm generate` to run
// for every backend tweak.
// ---------------------------------------------------------------------

export type CommunityReactionEmoji =
  | 'thumbsup'
  | 'clap'
  | 'heart'
  | 'fire'
  | 'idea'
  | 'pray'
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
export type CommunityAuthor = CommunityAuthorInstructor | CommunityAuthorStudent

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
  playback_url: string | null
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

export interface CommunityMemberRead {
  id: string
  kind: 'instructor' | 'student'
  name: string | null
  avatar_url: string | null
  joined_at: string | null
}

export interface CommunityPostVideoUploadResult {
  upload_id: string
  upload_url: string
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

const feedKey = (token: string, courseId: string, filters: FeedFilters) =>
  ['community-feed', token, courseId, filters] as const

const commentsKey = (token: string, courseId: string, postId: string) =>
  ['community-comments', token, courseId, postId] as const

const membersKey = (token: string, courseId: string) =>
  ['community-members', token, courseId] as const

// Discriminator threaded through every customer-portal hook so the
// same component (PostCard, Composer, CommentSection) can be reused
// from the course editor's preview pane. 'creator' swaps the URL
// prefix from /customer-portal/community → /community and uses the
// dashboard session cookie instead of a customer session token.
export type CommunityIOMode = 'customer' | 'creator'

const communityBase = (mode: CommunityIOMode, courseId: string) =>
  mode === 'creator'
    ? `/v1/community/${courseId}`
    : `/v1/customer-portal/community/${courseId}`

async function communityFetch<T>(
  mode: CommunityIOMode,
  token: string | null | undefined,
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (mode === 'creator') return creatorFetch<T>(path, options)
  return portalFetch<T>(path, token!, options)
}

// Invalidate the per-(token, courseId) feed AND any creator-side
// preview feed so a mutation from the editor pane propagates to both
// the live customer view (next session) and the preview itself.
const invalidateAllFeeds = (
  mode: CommunityIOMode,
  token: string | null | undefined,
  courseId: string,
) => {
  if (mode === 'customer' && token) {
    getQueryClient().invalidateQueries({
      queryKey: ['community-feed', token, courseId],
    })
  } else {
    getQueryClient().invalidateQueries({
      queryKey: ['creator-community-feed', courseId],
    })
  }
}

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

export const useCommunityEnrolledCourses = (token: string | null | undefined) =>
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

export const useCommunityMembers = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useQuery<CommunityMemberRead[]>({
    queryKey: membersKey(token ?? '', courseId ?? ''),
    queryFn: () =>
      portalFetch<CommunityMemberRead[]>(
        `/v1/customer-portal/community/${courseId}/members`,
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
  // Image branch: composer uploads via /media/upload, passes file_id.
  // Video branch (Phase 3A): composer creates an upload via
  // /media/mux-upload, PUTs bytes to Mux, then passes mux_upload_id.
  media_type?: 'image' | 'video'
  file_id?: string
  mux_upload_id?: string
  position?: number
}

export interface CommunityPostCreateBody {
  // Phase 3A: 'video' posts carry exactly one video entry in media[].
  type?: 'text' | 'video'
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
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (body: CommunityPostCreateBody) =>
      communityFetch<CommunityPostRead>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/posts`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (courseId) invalidateAllFeeds(mode, token, courseId)
    },
  })

// Server-proxied image upload. Posts FormData (not JSON) so portalFetch's
// JSON content-type would break it — multipart needs the browser to set
// the boundary header, which means *no* Content-Type override.
async function uploadPostImage(
  mode: CommunityIOMode,
  courseId: string,
  token: string | null | undefined,
  file: File,
): Promise<CommunityPostImageUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const url = `${process.env.NEXT_PUBLIC_API_URL}${
    mode === 'creator'
      ? `/v1/community/${courseId}/media/image-upload`
      : `/v1/customer-portal/community/${courseId}/media/upload`
  }`
  const headers: HeadersInit =
    mode === 'creator' ? {} : { Authorization: `Bearer ${token!}` }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    credentials: mode === 'creator' ? 'include' : 'same-origin',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upload ${res.status}: ${text}`)
  }
  return res.json()
}

export const useUploadPostImage = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (file: File) => uploadPostImage(mode, courseId!, token, file),
  })

// Phase 3A video upload — two-step:
//   1. POST /media/mux-upload → {upload_id, upload_url}
//   2. Browser PUTs the file bytes directly to upload_url (Mux storage)
// The returned upload_id is what the composer passes in the post-create
// payload's media[]. The webhook then flips the media row to 'ready'
// asynchronously.
export interface UploadPostVideoResult {
  upload_id: string
}

async function uploadPostVideo(
  mode: CommunityIOMode,
  courseId: string,
  token: string | null | undefined,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadPostVideoResult> {
  const ticket = await communityFetch<CommunityPostVideoUploadResult>(
    mode,
    token,
    `${communityBase(mode, courseId)}/media/mux-upload`,
    { method: 'POST', body: JSON.stringify({}) },
  )

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', ticket.upload_url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Mux upload ${xhr.status}: ${xhr.statusText}`))
    }
    xhr.onerror = () => reject(new Error('Mux upload network error'))
    xhr.send(file)
  })

  return { upload_id: ticket.upload_id }
}

export const useUploadPostVideo = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (args: { file: File; onProgress?: (f: number) => void }) =>
      uploadPostVideo(mode, courseId!, token, args.file, args.onProgress),
  })

export const useDeleteCommunityPost = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (postId: string) =>
      communityFetch<void>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/posts/${postId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (courseId) invalidateAllFeeds(mode, token, courseId)
    },
  })

// ---------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------

export const useCommunityPostComments = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | null | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useQuery<CommunityCommentRead[]>({
    queryKey: commentsKey(token ?? mode, courseId ?? '', postId ?? ''),
    queryFn: () =>
      communityFetch<CommunityCommentRead[]>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/posts/${postId}/comments`,
      ),
    enabled: !!courseId && !!postId && (mode === 'creator' || !!token),
  })

export const useCreateCommunityComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (body: {
      content: string
      parent_id?: string | null
      timestamp_seconds?: number | null
    }) =>
      communityFetch<CommunityCommentRead>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/posts/${postId}/comments`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token ?? mode, courseId, postId),
        })
        // Comment counters on the post card live on the feed payload —
        // refresh those too so the count chip stays accurate.
        invalidateAllFeeds(mode, token, courseId)
      }
    },
  })

export const useDeleteCommunityComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  postId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: (commentId: string) =>
      communityFetch<void>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/comments/${commentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token ?? mode, courseId, postId),
        })
        invalidateAllFeeds(mode, token, courseId)
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
  mode: CommunityIOMode = 'customer',
) => {
  // The optimistic-snapshot path keys by query name, which differs
  // between the customer feed and the creator-side preview feed. Pick
  // the one that matches this hook's mode so updates land on the
  // surface the user is actually looking at.
  const feedQueryKey =
    mode === 'creator'
      ? (['creator-community-feed', courseId] as const)
      : (['community-feed', token, courseId] as const)

  return useMutation({
    mutationFn: ({
      postId,
      emoji,
    }: {
      postId: string
      emoji: CommunityReactionEmoji
    }) =>
      communityFetch<CommunityReactionToggleResult>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/posts/${postId}/react`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      ),
    onMutate: async ({ postId, emoji }) => {
      if (!courseId) return
      const queryClient = getQueryClient()
      const snapshots = queryClient.getQueriesData<CommunityFeedPage>({
        queryKey: feedQueryKey,
      })
      for (const [key, page] of snapshots) {
        if (!page) continue
        const items = page.items.map((p) => {
          if (p.id !== postId) return p
          const existing = p.reactions.find((r) => r.emoji === emoji)
          const willBeActive = !(existing?.mine ?? false)
          const nextCount = (existing?.count ?? 0) + (willBeActive ? 1 : -1)
          return applyReactionDelta(
            p,
            emoji,
            willBeActive,
            Math.max(nextCount, 0),
          )
        })
        queryClient.setQueryData(key, { ...page, items })
      }
      return { snapshots }
    },
    onError: (_err, _vars, ctx) => {
      const queryClient = getQueryClient()
      ctx?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSuccess: (result, { postId }) => {
      if (!courseId) return
      const queryClient = getQueryClient()
      const snapshots = queryClient.getQueriesData<CommunityFeedPage>({
        queryKey: feedQueryKey,
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
}

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

const creatorMembersKey = (courseId: string) =>
  ['creator-community-members', courseId] as const

export const useCreatorCommunityTags = (courseId: string | undefined) =>
  useQuery<CommunityTagRead[]>({
    queryKey: creatorTagsKey(courseId ?? ''),
    queryFn: () =>
      creatorFetch<CommunityTagRead[]>(`/v1/community/${courseId}/tags`),
    enabled: !!courseId,
  })

export const useCreatorCommunityMembers = (courseId: string | undefined) =>
  useQuery<CommunityMemberRead[]>({
    queryKey: creatorMembersKey(courseId ?? ''),
    queryFn: () =>
      creatorFetch<CommunityMemberRead[]>(`/v1/community/${courseId}/members`),
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
  mode: CommunityIOMode = 'customer',
) =>
  useMutation({
    mutationFn: ({
      commentId,
      emoji,
    }: {
      commentId: string
      emoji: CommunityReactionEmoji
    }) =>
      communityFetch<CommunityReactionToggleResult>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/comments/${commentId}/react`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      ),
    onSuccess: () => {
      if (courseId && postId) {
        getQueryClient().invalidateQueries({
          queryKey: commentsKey(token ?? mode, courseId, postId),
        })
      }
    },
  })

// =====================================================================
// Creator's identity in the community context — used by the editor to
// seed the composer avatar/selfName without stitching together the
// session's user with course.instructor_name client-side.
// =====================================================================

export const useCreatorCommunityIdentity = (courseId: string | undefined) =>
  useQuery<CommunityAuthor>({
    queryKey: ['creator-community-identity', courseId],
    queryFn: () =>
      creatorFetch<CommunityAuthor>(`/v1/community/${courseId}/me`),
    enabled: !!courseId,
  })

// =====================================================================
// Events — community_event + community_event_rsvp
// =====================================================================

export type CommunityEventType = 'workshop' | 'office' | 'cohort' | 'guest'

export interface CommunityEventHostRead {
  user_id: string
  name: string
  avatar_url: string | null
}

export interface CommunityEventRead {
  id: string
  course_id: string
  title: string
  type: CommunityEventType
  description: string | null
  start_at: string // ISO timestamp (UTC)
  timezone: string // IANA tz the host scheduled in
  duration_minutes: number
  meeting_url: string | null
  location: string | null
  replay_url: string | null
  cover_url: string | null
  recurring_weekly: boolean
  notify_on_publish: boolean
  rsvp_count: number
  host: CommunityEventHostRead
  going: boolean
  live: boolean
  past: boolean
  created_at: string
  modified_at: string | null
}

export interface CommunityEventCreateBody {
  title: string
  type: CommunityEventType
  description?: string | null
  start_at: string
  timezone?: string
  duration_minutes: number
  meeting_url?: string | null
  location?: string | null
  cover_url?: string | null
  recurring_weekly?: boolean
  notify_on_publish?: boolean
}

export interface CommunityEventUpdateBody {
  title?: string
  type?: CommunityEventType
  description?: string | null
  start_at?: string
  duration_minutes?: number
  meeting_url?: string | null
  location?: string | null
  replay_url?: string | null
  cover_url?: string | null
  recurring_weekly?: boolean
}

export interface CommunityEventRsvpResult {
  going: boolean
  rsvp_count: number
}

const eventsKey = (mode: CommunityIOMode, token: string, courseId: string) =>
  ['community-events', mode, token, courseId] as const

const invalidateEvents = (
  mode: CommunityIOMode,
  token: string | null | undefined,
  courseId: string,
) => {
  getQueryClient().invalidateQueries({
    queryKey: ['community-events', mode, token ?? mode, courseId],
  })
}

export const useCommunityEvents = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'customer',
) =>
  useQuery<CommunityEventRead[]>({
    queryKey: eventsKey(mode, token ?? mode, courseId ?? ''),
    queryFn: () =>
      communityFetch<CommunityEventRead[]>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/events`,
      ),
    enabled: !!courseId && (mode === 'creator' || !!token),
  })

export const useCreateCommunityEvent = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'creator',
) =>
  useMutation({
    mutationFn: (body: CommunityEventCreateBody) =>
      communityFetch<CommunityEventRead>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/events`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (courseId) invalidateEvents(mode, token, courseId)
    },
  })

export const useUpdateCommunityEvent = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'creator',
) =>
  useMutation({
    mutationFn: ({
      eventId,
      body,
    }: {
      eventId: string
      body: CommunityEventUpdateBody
    }) =>
      communityFetch<CommunityEventRead>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/events/${eventId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      if (courseId) invalidateEvents(mode, token, courseId)
    },
  })

export const useDeleteCommunityEvent = (
  token: string | null | undefined,
  courseId: string | undefined,
  mode: CommunityIOMode = 'creator',
) =>
  useMutation({
    mutationFn: (eventId: string) =>
      communityFetch<void>(
        mode,
        token,
        `${communityBase(mode, courseId!)}/events/${eventId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (courseId) invalidateEvents(mode, token, courseId)
    },
  })

export const useRsvpCommunityEvent = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: ({ eventId, going }: { eventId: string; going: boolean }) =>
      communityFetch<CommunityEventRsvpResult>(
        'customer',
        token,
        `${communityBase('customer', courseId!)}/events/${eventId}/rsvp`,
        { method: going ? 'POST' : 'DELETE' },
      ),
    onSuccess: () => {
      if (courseId) invalidateEvents('customer', token, courseId)
    },
  })

// =====================================================================
// Customer-portal notifications (the bell)
// =====================================================================

export interface CustomerNotificationRead {
  id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
  modified_at: string | null
}

export const useCustomerNotifications = (token: string | null | undefined) =>
  useQuery<CustomerNotificationRead[]>({
    queryKey: ['customer-notifications', token ?? ''],
    queryFn: () =>
      portalFetch<CustomerNotificationRead[]>(
        `/v1/customer-portal/notifications/`,
        token!,
      ),
    enabled: !!token,
  })

export const useCustomerNotificationUnreadCount = (
  token: string | null | undefined,
) =>
  useQuery<{ unread: number }>({
    queryKey: ['customer-notifications-unread', token ?? ''],
    queryFn: () =>
      portalFetch<{ unread: number }>(
        `/v1/customer-portal/notifications/unread-count`,
        token!,
      ),
    enabled: !!token,
    refetchInterval: 60_000,
  })

export const useMarkCustomerNotificationRead = (
  token: string | null | undefined,
) =>
  useMutation({
    mutationFn: (notificationId: string) =>
      portalFetch<void>(
        `/v1/customer-portal/notifications/${notificationId}/read`,
        token!,
        { method: 'POST' },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customer-notifications', token ?? ''],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['customer-notifications-unread', token ?? ''],
      })
    },
  })

export const useMarkAllCustomerNotificationsRead = (
  token: string | null | undefined,
) =>
  useMutation({
    mutationFn: () =>
      portalFetch<void>(`/v1/customer-portal/notifications/read-all`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customer-notifications', token ?? ''],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['customer-notifications-unread', token ?? ''],
      })
    },
  })
