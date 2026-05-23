'use client'

// Customer-portal hooks for the Phase 1 submission loop.
//
// All endpoints are gated on the customer holding an active enrollment
// — the server returns 403 otherwise, which TanStack treats as a
// failed query (no automatic retry, which is what we want; the user
// just isn't enrolled).
//
// Path conventions match server/polar/customer_portal/endpoints/
// course_submission.py exactly.

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

export type ChallengeRead = {
  id: string
  course_id: string
  module_id: string
  position: number
  title: string
  prompt: string
  accepts_media: boolean
  accepts_video: boolean
  accepts_text: boolean
  due_after_days: number | null
  published: boolean
  ai_generated: boolean
  created_at: string
  modified_at: string | null
  submission_count: number
  my_submission_id: string | null
}

export type SubmissionMediaRead = {
  id: string
  kind: 'image' | 'video'
  url: string | null
  mux_playback_id: string | null
  mux_status: string | null
  position: number
}

export type ReactionRead = {
  id: string
  actor_type: 'creator' | 'student'
  actor_user_id: string
  emoji: string
}

export type SubmissionAuthor = {
  enrollment_id: string
  display_name: string
  avatar_url: string | null
}

export type SubmissionRead = {
  id: string
  challenge_id: string
  course_id: string
  enrollment_id: string
  status: 'draft' | 'submitted' | 'hidden'
  submitted_at: string | null
  caption: string
  media: SubmissionMediaRead[]
  reactions: ReactionRead[]
  author: SubmissionAuthor
  challenge_title: string | null
  created_at: string
  modified_at: string | null
}

export type SubmissionInput = {
  caption: string
  media: Array<{ kind: 'image' | 'video'; url?: string | null; position?: number }>
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

/** Two-step thumbnail upload for a challenge cover (creator-side).
 *  Same shape as uploadSubmissionImage but hits the creator-scoped
 *  presign endpoint and a different S3 prefix. Returns the public
 *  URL the creator persists on the challenge row via PATCH. */
export async function uploadChallengeThumbnail(file: File): Promise<string> {
  const MAX_BYTES = 10 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    throw new Error('Thumbnail is larger than 10MB.')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.')
  }
  const presigned = await fetchJson<{
    upload_url: string
    public_url: string
  }>('/v1/courses/challenges/thumbnail-uploads', {
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

/** Two-step image upload for challenge submissions:
 *    1. Presign a single-shot PUT URL on the public bucket.
 *    2. PUT the file bytes to that URL with the matching content-type.
 *  The returned `public_url` is what gets persisted on the submission
 *  row's media[] array on the next upsert call.
 *
 *  Throws on either step failing — the caller surfaces a friendly
 *  message to the student via the composer state. */
export async function uploadSubmissionImage(file: File): Promise<string> {
  // Cap a little above what the server enforces (50MB) so the
  // friendly client-side error fires before we burn an upload-url
  // round-trip on something the API will reject anyway.
  const MAX_BYTES = 50 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    throw new Error('Image is larger than 50MB.')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.')
  }

  const presigned = await fetchJson<{
    upload_url: string
    public_url: string
  }>('/v1/customer-portal/courses/submission-uploads', {
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
    headers: {
      'Content-Type': file.type,
    },
  })
  if (!putRes.ok) {
    throw new Error(`Upload failed (S3 ${putRes.status})`)
  }
  return presigned.public_url
}

// ── Student reads ──────────────────────────────────────────────────────

export function useEnrolledCourseChallenges(courseId: string | undefined) {
  return useQuery<ChallengeRead[]>({
    queryKey: ['enrolled-challenges', courseId],
    queryFn: () =>
      fetchJson(`/v1/customer-portal/courses/${courseId}/challenges`),
    enabled: !!courseId,
  })
}

export function useChallengeGallery(challengeId: string | undefined) {
  return useQuery<SubmissionRead[]>({
    queryKey: ['challenge-gallery', challengeId],
    queryFn: () =>
      fetchJson(
        `/v1/customer-portal/courses/challenges/${challengeId}/submissions`,
      ),
    enabled: !!challengeId,
  })
}

export function useOwnSubmission(challengeId: string | undefined) {
  return useQuery<SubmissionRead | null>({
    queryKey: ['own-submission', challengeId],
    queryFn: () =>
      fetchJson(
        `/v1/customer-portal/courses/challenges/${challengeId}/submission/me`,
      ),
    enabled: !!challengeId,
  })
}

// ── Student mutations ─────────────────────────────────────────────────

export function useUpsertSubmission(courseId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      challengeId,
      payload,
    }: {
      challengeId: string
      payload: SubmissionInput
    }) =>
      fetchJson<SubmissionRead>(
        `/v1/customer-portal/courses/challenges/${challengeId}/submission`,
        { method: 'PUT', body: JSON.stringify(payload) },
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ['own-submission', vars.challengeId],
      })
      qc.invalidateQueries({
        queryKey: ['enrolled-challenges', courseId],
      })
    },
  })
}

export function useSubmitSubmission(
  courseId: string | undefined,
  challengeId: string | undefined,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (submissionId: string) =>
      fetchJson<SubmissionRead>(
        `/v1/customer-portal/courses/submissions/${submissionId}/submit`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['own-submission', challengeId] })
      qc.invalidateQueries({ queryKey: ['challenge-gallery', challengeId] })
      qc.invalidateQueries({ queryKey: ['enrolled-challenges', courseId] })
    },
  })
}

export function useDeleteOwnSubmission(
  courseId: string | undefined,
  challengeId: string | undefined,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (submissionId: string) =>
      fetchJson<void>(
        `/v1/customer-portal/courses/submissions/${submissionId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['own-submission', challengeId] })
      qc.invalidateQueries({ queryKey: ['challenge-gallery', challengeId] })
      qc.invalidateQueries({ queryKey: ['enrolled-challenges', courseId] })
    },
  })
}
