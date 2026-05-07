import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type MeetingProvider =
  | 'zoom'
  | 'google_meet'
  | 'whereby'
  | 'riverside'
  | 'other'

export type CoachingEventStatus = 'scheduled' | 'cancelled'

export type CoachingEventRead = {
  id: string
  course_id: string
  title: string
  description: string | null
  agenda: Record<string, unknown> | null
  starts_at: string
  duration_minutes: number
  timezone: string | null
  meeting_url: string | null
  meeting_provider: MeetingProvider | null
  status: CoachingEventStatus
  recording_mux_upload_id: string | null
  recording_mux_asset_id: string | null
  recording_mux_playback_id: string | null
  recording_mux_status: string | null
  recording_released_at: string | null
  created_at: string
  modified_at: string | null
}

export type CoachingEventCreate = {
  course_id: string
  title: string
  description?: string | null
  agenda?: Record<string, unknown> | null
  starts_at: string
  duration_minutes?: number
  timezone?: string | null
  meeting_url?: string | null
  meeting_provider?: MeetingProvider | null
}

export type CoachingEventUpdate = {
  title?: string
  description?: string | null
  agenda?: Record<string, unknown> | null
  starts_at?: string
  duration_minutes?: number
  timezone?: string | null
  meeting_url?: string | null
  meeting_provider?: MeetingProvider | null
  status?: CoachingEventStatus
}

async function coachingFetch<T>(
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

export const useCoachingEvents = (courseId: string | undefined) =>
  useQuery<CoachingEventRead[]>({
    queryKey: ['coaching-events', { courseId }],
    queryFn: () =>
      coachingFetch<CoachingEventRead[]>(
        `/v1/coaching/events?course_id=${courseId}`,
      ),
    enabled: !!courseId,
  })

export const useCreateCoachingEvent = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CoachingEventCreate) =>
      coachingFetch<CoachingEventRead>('/v1/coaching/events', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-events', { courseId }] })
    },
  })
}

export const useUpdateCoachingEvent = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      body,
    }: {
      eventId: string
      body: CoachingEventUpdate
    }) =>
      coachingFetch<CoachingEventRead>(`/v1/coaching/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-events', { courseId }] })
    },
  })
}

export const useDeleteCoachingEvent = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) =>
      coachingFetch<void>(`/v1/coaching/events/${eventId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-events', { courseId }] })
    },
  })
}

export const useCreateCoachingRecordingUpload = () =>
  useMutation({
    mutationFn: (eventId: string) =>
      coachingFetch<{ upload_id: string; upload_url: string }>(
        `/v1/coaching/events/${eventId}/recording-upload`,
        { method: 'POST' },
      ),
  })
