'use client'

// Creator-side hooks for Phase 3 course broadcasts.
//
// Path conventions match server/polar/course_broadcast/endpoints.py
// exactly. Student-facing reads (the community feed) live in
// hooks/queries/courses.ts alongside the rest of the customer portal
// shape, and are wired up on Day 3.

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

export type BroadcastRead = {
  id: string
  course_id: string
  created_by_user_id: string | null
  title: string
  body: string
  image_url: string | null
  week_number: number | null
  notify_on_publish: boolean
  scheduled_at: string | null
  published_at: string | null
  author_display_name: string | null
  created_at: string
  modified_at: string | null
}

export type BroadcastCreateInput = {
  title: string
  body?: string
  image_url?: string | null
  week_number?: number | null
  notify_on_publish?: boolean
  publish?: boolean
}

export type BroadcastUpdateInput = {
  title?: string
  body?: string
  image_url?: string | null
  week_number?: number | null
  notify_on_publish?: boolean
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Image upload helper ────────────────────────────────────────────────

/** Single-shot S3 PUT for the optional broadcast cover image. Returns
 *  the public URL the creator persists via PATCH /broadcasts/{id}. */
export async function uploadBroadcastImage(file: File): Promise<string> {
  const MAX_BYTES = 10 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    throw new Error('Image is larger than 10MB.')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.')
  }
  const presigned = await fetchJson<{
    upload_url: string
    public_url: string
  }>('/v1/courses/broadcasts/image-uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type,
      content_length: file.size,
    }),
  })
  const putRes = await fetch(presigned.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!putRes.ok) {
    throw new Error(`Upload failed (S3 ${putRes.status})`)
  }
  return presigned.public_url
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useCourseBroadcasts(courseId: string | undefined) {
  return useQuery<BroadcastRead[]>({
    queryKey: ['course-broadcasts', courseId],
    queryFn: () => fetchJson(`/v1/courses/${courseId}/broadcasts`),
    enabled: !!courseId,
  })
}

export function useCreateBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<BroadcastRead, Error, BroadcastCreateInput>({
    mutationFn: (input) =>
      fetchJson(`/v1/courses/${courseId}/broadcasts`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}

export function useUpdateBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<
    BroadcastRead,
    Error,
    { id: string; input: BroadcastUpdateInput }
  >({
    mutationFn: ({ id, input }) =>
      fetchJson(`/v1/courses/broadcasts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}

export function usePublishBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<BroadcastRead, Error, string>({
    mutationFn: (id) =>
      fetchJson(`/v1/courses/broadcasts/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}

export function useUnpublishBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<BroadcastRead, Error, string>({
    mutationFn: (id) =>
      fetchJson(`/v1/courses/broadcasts/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}

export function useScheduleBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<
    BroadcastRead,
    Error,
    { id: string; scheduledAt: string }
  >({
    mutationFn: ({ id, scheduledAt }) =>
      fetchJson(`/v1/courses/broadcasts/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_at: scheduledAt }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}

export function useDeleteBroadcast(courseId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      fetchJson(`/v1/courses/broadcasts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-broadcasts', courseId] })
    },
  })
}
