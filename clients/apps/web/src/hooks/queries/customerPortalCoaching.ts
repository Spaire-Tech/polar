import { useQuery } from '@tanstack/react-query'

export type CustomerCoachingEvent = {
  id: string
  title: string
  description: string | null
  agenda: Record<string, unknown> | null
  starts_at: string
  duration_minutes: number
  timezone: string | null
  meeting_url: string | null
  meeting_provider: string | null
  status: 'scheduled' | 'cancelled'
  is_past: boolean
  recording: {
    playback_id: string | null
    status: string | null
    released_at: string | null
  } | null
}

export type CustomerCoachingScheduleResponse = {
  course_id: string
  events: CustomerCoachingEvent[]
}

async function customerPortalFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

export const useCustomerCoachingEvents = (
  courseId: string | undefined,
  opts: { enabled?: boolean } = {},
) =>
  useQuery<CustomerCoachingScheduleResponse>({
    queryKey: ['customer-coaching-events', { courseId }],
    queryFn: () =>
      customerPortalFetch<CustomerCoachingScheduleResponse>(
        `/v1/customer-portal/coaching/${courseId}/events`,
      ),
    enabled: !!courseId && opts.enabled !== false,
  })

export function icsDownloadUrl(courseId: string, eventId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/coaching/${courseId}/events/${eventId}/ics`
}
