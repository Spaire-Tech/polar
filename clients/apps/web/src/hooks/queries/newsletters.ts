import { getServerURL } from '@/utils/api'
import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Mirrors the raw-fetch pattern used by `hooks/queries/emailMarketing.ts`.
// The generated `@spaire/client` API client predates the /v1/newsletters
// routes (Phase 0); regenerating it via `pnpm generate` against a live
// dev server will fill in proper types, after which these hooks can
// switch to `api.GET("/v1/newsletters/...")` style if desired.

const fetchApi = async <T>(path: string): Promise<T> => {
  const res = await fetch(getServerURL(path), { credentials: 'include' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

const fetchApiWrite = async <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> => {
  const res = await fetch(getServerURL(path), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Row types (mirror server schemas) ─────────────────────────────────

export type NewsletterRow = {
  id: string
  organization_id: string
  product_id: string | null
  name: string
  slug: string
  masthead: string
  description: string | null
  cover_url: string | null
  default_sender_name: string | null
  default_sender_email: string | null
  default_reply_to_email: string | null
  theme: Record<string, unknown>
  created_at: string
  modified_at: string | null
}

export type NewsletterPostRow = {
  id: string
  newsletter_id: string
  organization_id: string
  title: string
  subtitle: string | null
  slug: string
  cover_url: string | null
  cover_visible: boolean
  tags: string[]
  content_json: Record<string, unknown> | null
  content_html: string | null
  theme_overrides: Record<string, unknown> | null
  channel: 'email_and_web' | 'email_only' | 'web_only'
  send_mode: 'send_now' | 'smart_time' | 'scheduled' | 'drip_tz'
  scheduled_at: string | null
  audience_tier: 'all' | 'paid'
  audience_segment_id: string | null
  audience_filter_rules: Record<string, unknown> | null
  subject_override: string | null
  preview_text_override: string | null
  show_socials: boolean
  show_likes_comments: boolean
  custom_read_online_url: string | null
  audio_enabled: boolean
  audio_url: string | null
  web_thumbnail_url: string | null
  web_thumbnail_on_top: boolean
  seo_meta_title: string | null
  seo_meta_description: string | null
  status:
    | 'draft'
    | 'scheduled'
    | 'sending'
    | 'published'
    | 'failed'
    | 'archived'
  published_at: string | null
  broadcast_id: string | null
  created_at: string
  modified_at: string | null
}

export type NewsletterPostWritePayload = Partial<
  Omit<
    NewsletterPostRow,
    | 'id'
    | 'newsletter_id'
    | 'organization_id'
    | 'status'
    | 'published_at'
    | 'broadcast_id'
    | 'created_at'
    | 'modified_at'
    | 'content_html'
  >
>

// ── Newsletters ──────────────────────────────────────────────────────

export const useNewsletters = (organizationId: string) =>
  useQuery({
    queryKey: ['newsletters', organizationId],
    queryFn: () =>
      fetchApi<NewsletterRow[]>(
        `/v1/newsletters/organization/${organizationId}`,
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useNewsletter = (newsletterId: string | null | undefined) =>
  useQuery({
    queryKey: ['newsletter', newsletterId],
    queryFn: () =>
      fetchApi<NewsletterRow>(`/v1/newsletters/${newsletterId}`),
    retry: defaultRetry,
    enabled: !!newsletterId,
  })

export const useCreateNewsletter = () =>
  useMutation({
    mutationFn: (body: {
      organization_id: string
      name: string
      slug: string
      masthead?: string
      description?: string | null
      cover_url?: string | null
      default_sender_name?: string | null
      default_sender_email?: string | null
      default_reply_to_email?: string | null
      theme?: Record<string, unknown>
      product_id?: string | null
    }) => fetchApiWrite<NewsletterRow>(`/v1/newsletters/`, 'POST', body),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['newsletters'] })
    },
  })

export const useUpdateNewsletter = () =>
  useMutation({
    mutationFn: ({
      newsletterId,
      body,
    }: {
      newsletterId: string
      body: Partial<NewsletterRow>
    }) =>
      fetchApiWrite<NewsletterRow>(
        `/v1/newsletters/${newsletterId}`,
        'PATCH',
        body,
      ),
    onSuccess: (_d, { newsletterId }) => {
      getQueryClient().invalidateQueries({ queryKey: ['newsletters'] })
      getQueryClient().invalidateQueries({ queryKey: ['newsletter', newsletterId] })
    },
  })

export const useDeleteNewsletter = () =>
  useMutation({
    mutationFn: ({ newsletterId }: { newsletterId: string }) =>
      fetchApiWrite<void>(`/v1/newsletters/${newsletterId}`, 'DELETE'),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['newsletters'] })
    },
  })

// ── Posts ────────────────────────────────────────────────────────────

export const useNewsletterPosts = (newsletterId: string | null | undefined) =>
  useQuery({
    queryKey: ['newsletter_posts', newsletterId],
    queryFn: () =>
      fetchApi<NewsletterPostRow[]>(
        `/v1/newsletters/${newsletterId}/posts`,
      ),
    retry: defaultRetry,
    enabled: !!newsletterId,
  })

export const useNewsletterPost = (postId: string | null | undefined) =>
  useQuery({
    queryKey: ['newsletter_post', postId],
    queryFn: () =>
      fetchApi<NewsletterPostRow>(`/v1/newsletters/posts/${postId}`),
    retry: defaultRetry,
    enabled: !!postId,
  })

export const useCreateNewsletterPost = () =>
  useMutation({
    mutationFn: (
      body: NewsletterPostWritePayload & {
        newsletter_id: string
        slug: string
      },
    ) =>
      fetchApiWrite<NewsletterPostRow>(`/v1/newsletters/posts`, 'POST', body),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['newsletter_posts', data.newsletter_id],
      })
    },
  })

export const useUpdateNewsletterPost = () =>
  useMutation({
    mutationFn: ({
      postId,
      body,
    }: {
      postId: string
      body: NewsletterPostWritePayload
    }) =>
      fetchApiWrite<NewsletterPostRow>(
        `/v1/newsletters/posts/${postId}`,
        'PATCH',
        body,
      ),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['newsletter_post', data.id],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['newsletter_posts', data.newsletter_id],
      })
    },
  })

export const useDeleteNewsletterPost = () =>
  useMutation({
    mutationFn: ({ postId }: { postId: string }) =>
      fetchApiWrite<void>(`/v1/newsletters/posts/${postId}`, 'DELETE'),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['newsletter_posts'] })
      getQueryClient().invalidateQueries({ queryKey: ['newsletter_post'] })
    },
  })

export const usePublishNewsletterPost = () =>
  useMutation({
    mutationFn: ({ postId }: { postId: string }) =>
      fetchApiWrite<NewsletterPostRow>(
        `/v1/newsletters/posts/${postId}/publish`,
        'POST',
      ),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['newsletter_post', data.id],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['newsletter_posts', data.newsletter_id],
      })
    },
  })

export const useTestSendNewsletterPost = () =>
  useMutation({
    mutationFn: ({ postId, email }: { postId: string; email: string }) =>
      fetchApiWrite<void>(
        `/v1/newsletters/posts/${postId}/test-send`,
        'POST',
        { email },
      ),
  })

// ── Public archive ────────────────────────────────────────────────────

export type PublicNewsletterPost = {
  id: string
  organization_id: string
  organization_slug: string
  organization_name: string
  newsletter_id: string
  newsletter_name: string
  newsletter_masthead: string
  title: string
  subtitle: string | null
  slug: string
  cover_url: string | null
  cover_visible: boolean
  tags: string[]
  content_html: string
  published_at: string | null
  web_thumbnail_url: string | null
  web_thumbnail_on_top: boolean
  seo_meta_title: string | null
  seo_meta_description: string | null
  audio_enabled: boolean
  audio_url: string | null
  gated: boolean
  theme: Record<string, unknown>
}

// Anonymous fetch — no credentials so the public archive can be
// rendered from a logged-out browser session without exposing cookies
// to the cross-origin request.
const fetchPublic = async <T>(path: string): Promise<T> => {
  const res = await fetch(getServerURL(path), { credentials: 'omit' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const usePublicNewsletterPost = (
  organizationSlug: string,
  postSlug: string,
) =>
  useQuery({
    queryKey: ['public_newsletter_post', organizationSlug, postSlug],
    queryFn: () =>
      fetchPublic<PublicNewsletterPost>(
        `/v1/newsletters/public/${encodeURIComponent(
          organizationSlug,
        )}/${encodeURIComponent(postSlug)}`,
      ),
    retry: defaultRetry,
    enabled: !!organizationSlug && !!postSlug,
  })

// Server-side fetch helper for the Next.js page's generateMetadata +
// SSR. Uses bare fetch (no TanStack), returns null for any failure so
// callers can call notFound() cleanly.
export const fetchPublicNewsletterPost = async (
  organizationSlug: string,
  postSlug: string,
): Promise<PublicNewsletterPost | null> => {
  try {
    const res = await fetch(
      getServerURL(
        `/v1/newsletters/public/${encodeURIComponent(
          organizationSlug,
        )}/${encodeURIComponent(postSlug)}`,
      ),
      { credentials: 'omit', cache: 'no-store' },
    )
    if (!res.ok) return null
    return (await res.json()) as PublicNewsletterPost
  } catch {
    return null
  }
}
