import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------
// Types — mirror polar/course_assistant/schemas.py. Inlined (not imported
// from @spaire/client) so the dev cycle doesn't need `pnpm generate` for
// every backend tweak — same convention as hooks/queries/community.ts.
// ---------------------------------------------------------------------

export type CourseAssistantStatus =
  | 'building'
  | 'ready_for_review'
  | 'live'
  | 'failed'
  | 'disabled'

export interface CourseAssistantSample {
  id: string
  question: string
  answer: string
  citation: string | null
  scope: string | null
  approved: boolean
  edited_answer: string | null
}

export interface CourseAssistantManage {
  course_id: string
  status: CourseAssistantStatus
  configured: boolean
  live: boolean
  is_answerable: boolean
  has_pending_review: boolean
  display_name: string | null
  disclaimer: string | null
  model: string | null
  error: string | null
  sample_questions: CourseAssistantSample[] | null
  draft_lesson_count: number | null
  draft_tokens: number | null
  draft_built_at: string | null
  approved_at: string | null
  approved_lesson_count: number | null
}

// ---------------------------------------------------------------------

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

const assistantKey = (courseId: string) =>
  ['course-assistant', courseId] as const

const base = (courseId: string) => `/v1/course-assistant/${courseId}`

// Stash the server-returned manage view so the tab doesn't blink between the
// mutation and the refetch, then invalidate to stay consistent.
function cacheManage(courseId: string, data: CourseAssistantManage) {
  const qc = getQueryClient()
  qc.setQueryData(assistantKey(courseId), data)
  qc.invalidateQueries({ queryKey: assistantKey(courseId) })
}

export const useCourseAssistant = (courseId: string | undefined) =>
  useQuery<CourseAssistantManage>({
    queryKey: assistantKey(courseId ?? ''),
    queryFn: () =>
      creatorFetch<CourseAssistantManage>(`${base(courseId!)}/manage`),
    enabled: !!courseId,
    // While building, poll so the tab flips to Review on its own.
    refetchInterval: (query) =>
      query.state.data?.status === 'building' ? 5000 : false,
  })

export const useApproveAssistant = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (payload: {
      display_name?: string | null
      disclaimer?: string | null
    }) =>
      creatorFetch<CourseAssistantManage>(`${base(courseId!)}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => courseId && cacheManage(courseId, data),
  })

export const useRegenerateAssistant = (courseId: string | undefined) =>
  useMutation({
    mutationFn: () =>
      creatorFetch<CourseAssistantManage>(`${base(courseId!)}/regenerate`, {
        method: 'POST',
      }),
    onSuccess: (data) => courseId && cacheManage(courseId, data),
  })

export const useSetAssistantLive = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (live: boolean) =>
      creatorFetch<CourseAssistantManage>(`${base(courseId!)}/live`, {
        method: 'POST',
        body: JSON.stringify({ live }),
      }),
    onSuccess: (data) => courseId && cacheManage(courseId, data),
  })

export const useUpdateAssistantSettings = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (payload: {
      display_name?: string | null
      disclaimer?: string | null
    }) =>
      creatorFetch<CourseAssistantManage>(`${base(courseId!)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => courseId && cacheManage(courseId, data),
  })

export const useUpdateAssistantSample = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (args: {
      sampleId: string
      answer?: string | null
      approved?: boolean | null
    }) =>
      creatorFetch<CourseAssistantManage>(
        `${base(courseId!)}/samples/${args.sampleId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            answer: args.answer,
            approved: args.approved,
          }),
        },
      ),
    onSuccess: (data) => courseId && cacheManage(courseId, data),
  })
