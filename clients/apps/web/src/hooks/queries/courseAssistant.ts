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

// ---------------------------------------------------------------------
// Phase 5 — "What students are asking": creator-facing question insights.
// Aggregated server-side (grouped by normalized text); see the backend
// CourseAssistantQuestionsRead schema.
// ---------------------------------------------------------------------

export interface CourseAssistantQuestionItem {
  question: string
  count: number
  asker_count: number
  refused_count: number
  last_asked_at: string
}

export interface CourseAssistantQuestions {
  total_questions: number
  asker_count: number
  refused_count: number
  items: CourseAssistantQuestionItem[]
}

export const useCourseAssistantQuestions = (courseId: string | undefined) =>
  useQuery<CourseAssistantQuestions>({
    queryKey: ['course-assistant-questions', courseId],
    queryFn: () =>
      creatorFetch<CourseAssistantQuestions>(`${base(courseId!)}/questions`),
    enabled: !!courseId,
    staleTime: 30_000,
  })

// ---------------------------------------------------------------------
// Student side (Phase 4) — the "Ask {name}" chat in the course player.
// Authenticated with the customer-session token (Bearer), same as the
// rest of the portal.
// ---------------------------------------------------------------------

export interface CourseAssistantStudentStatus {
  available: boolean
  display_name: string | null
  instructor_name: string | null
  disclaimer: string | null
  example_question: string | null
}

export interface AskCitation {
  cited_text: string | null
  document_title: string | null
  start_char_index: number | null
  end_char_index: number | null
}

export const useCourseAssistantStatus = (
  courseId: string | undefined,
  token: string | null | undefined,
) =>
  useQuery<CourseAssistantStudentStatus>({
    queryKey: ['course-assistant-status', token, courseId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${base(courseId!)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) return { available: false } as CourseAssistantStudentStatus
      return res.json()
    },
    enabled: !!courseId && !!token,
    staleTime: 60_000,
  })

export interface AskHandlers {
  onText: (chunk: string) => void
  onCitations: (citations: AskCitation[]) => void
  onRefusal: (message: string) => void
  onError: (message: string) => void
  onDone: () => void
}

/**
 * Stream a grounded answer from the assistant over SSE. EventSource can't do
 * POST + auth header, so we POST and parse the SSE frames off the fetch body.
 * Returns an AbortController so the caller can cancel an in-flight answer.
 */
export function streamAsk(
  courseId: string,
  token: string,
  question: string,
  handlers: AskHandlers,
): AbortController {
  const controller = new AbortController()
  ;(async () => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      handlers.onDone()
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${base(courseId)}/ask`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        },
      )
      if (!res.ok || !res.body) {
        handlers.onError('The assistant is temporarily unavailable.')
        finish()
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          let event = 'message'
          let data = ''
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          let payload: {
            text?: string
            citations?: AskCitation[]
            message?: string
          }
          try {
            payload = JSON.parse(data)
          } catch {
            continue
          }
          if (event === 'text') handlers.onText(payload.text ?? '')
          else if (event === 'citations')
            handlers.onCitations(payload.citations ?? [])
          else if (event === 'refusal')
            handlers.onRefusal(payload.message ?? '')
          else if (event === 'error')
            handlers.onError(payload.message ?? 'Something went wrong.')
          else if (event === 'done') finish()
        }
      }
      finish()
    } catch {
      if (!controller.signal.aborted) {
        handlers.onError('The assistant is temporarily unavailable.')
      }
      finish()
    }
  })()
  return controller
}
