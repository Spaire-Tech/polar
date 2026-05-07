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

// ── Cohorts ──────────────────────────────────────────────────────────────

export type CoachingCohortRead = {
  id: string
  course_id: string
  name: string
  starts_at: string | null
  ends_at: string | null
  capacity: number | null
  enrollment_open: boolean
  is_default: boolean
  member_count: number
  created_at: string
  modified_at: string | null
}

export type CoachingCohortCreate = {
  course_id: string
  name: string
  starts_at?: string | null
  ends_at?: string | null
  capacity?: number | null
  enrollment_open?: boolean
}

export type CoachingCohortUpdate = {
  name?: string
  starts_at?: string | null
  ends_at?: string | null
  capacity?: number | null
  enrollment_open?: boolean
}

export const useCoachingCohorts = (courseId: string | undefined) =>
  useQuery<CoachingCohortRead[]>({
    queryKey: ['coaching-cohorts', { courseId }],
    queryFn: () =>
      coachingFetch<CoachingCohortRead[]>(
        `/v1/coaching/cohorts?course_id=${courseId}`,
      ),
    enabled: !!courseId,
  })

export const useCreateCoachingCohort = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CoachingCohortCreate) =>
      coachingFetch<CoachingCohortRead>('/v1/coaching/cohorts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-cohorts', { courseId }] })
      qc.invalidateQueries({ queryKey: ['coaching-members', { courseId }] })
    },
  })
}

export const useUpdateCoachingCohort = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      cohortId,
      body,
    }: {
      cohortId: string
      body: CoachingCohortUpdate
    }) =>
      coachingFetch<CoachingCohortRead>(`/v1/coaching/cohorts/${cohortId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-cohorts', { courseId }] })
    },
  })
}

export const useDeleteCoachingCohort = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cohortId: string) =>
      coachingFetch<void>(`/v1/coaching/cohorts/${cohortId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-cohorts', { courseId }] })
      qc.invalidateQueries({ queryKey: ['coaching-members', { courseId }] })
    },
  })
}

// ── Members ──────────────────────────────────────────────────────────────

export type CoachingMemberRead = {
  enrollment_id: string
  enrolled_at: string
  cohort_id: string | null
  cohort_name: string | null
  customer: {
    id: string
    email: string | null
    name: string | null
    avatar_url: string | null
  }
  completed_lessons: number
  total_lessons: number
}

export const useCoachingMembers = (courseId: string | undefined) =>
  useQuery<CoachingMemberRead[]>({
    queryKey: ['coaching-members', { courseId }],
    queryFn: () =>
      coachingFetch<CoachingMemberRead[]>(
        `/v1/coaching/members?course_id=${courseId}`,
      ),
    enabled: !!courseId,
  })

export const useAssignMemberCohort = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      enrollmentId,
      cohortId,
    }: {
      enrollmentId: string
      cohortId: string
    }) =>
      coachingFetch<CoachingMemberRead>(
        `/v1/coaching/members/${enrollmentId}/cohort`,
        {
          method: 'POST',
          body: JSON.stringify({ cohort_id: cohortId }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching-members', { courseId }] })
      qc.invalidateQueries({ queryKey: ['coaching-cohorts', { courseId }] })
    },
  })
}

// ── Intake forms ─────────────────────────────────────────────────────────

export type IntakeFieldType =
  | 'short_text'
  | 'long_text'
  | 'select'
  | 'multiselect'
  | 'email'

export type IntakeField = {
  id: string
  type: IntakeFieldType
  label: string
  placeholder?: string | null
  required: boolean
  options?: string[] | null
}

export type IntakeSchema = { fields: IntakeField[] }

export type CoachingIntakeFormRead = {
  id: string
  course_id: string
  title: string | null
  description: string | null
  schema_json: IntakeSchema
  required_for_access: boolean
  created_at: string
  modified_at: string | null
}

export type CoachingIntakeFormUpsert = {
  course_id: string
  title?: string | null
  description?: string | null
  schema_json: IntakeSchema
  required_for_access: boolean
}

export type CoachingIntakeResponseRead = {
  id: string
  form_id: string
  customer_id: string
  enrollment_id: string | null
  answers: Record<string, unknown>
  submitted_at: string
  customer_email: string | null
  customer_name: string | null
  created_at: string
  modified_at: string | null
}

export const useCoachingIntakeForm = (courseId: string | undefined) =>
  useQuery<CoachingIntakeFormRead | null>({
    queryKey: ['coaching-intake-form', { courseId }],
    queryFn: () =>
      coachingFetch<CoachingIntakeFormRead | null>(
        `/v1/coaching/intake-forms?course_id=${courseId}`,
      ),
    enabled: !!courseId,
  })

export const useUpsertCoachingIntakeForm = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CoachingIntakeFormUpsert) =>
      coachingFetch<CoachingIntakeFormRead>('/v1/coaching/intake-forms', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['coaching-intake-form', { courseId }],
      })
    },
  })
}

export const useDeleteCoachingIntakeForm = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formId: string) =>
      coachingFetch<void>(`/v1/coaching/intake-forms/${formId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['coaching-intake-form', { courseId }],
      })
      qc.invalidateQueries({
        queryKey: ['coaching-intake-responses', { courseId }],
      })
    },
  })
}

export const useCoachingIntakeResponses = (courseId: string | undefined) =>
  useQuery<CoachingIntakeResponseRead[]>({
    queryKey: ['coaching-intake-responses', { courseId }],
    queryFn: () =>
      coachingFetch<CoachingIntakeResponseRead[]>(
        `/v1/coaching/intake-responses?course_id=${courseId}`,
      ),
    enabled: !!courseId,
  })

// ── Customer-portal intake form (separate endpoint base) ────────────────

export type CustomerIntakeFormResponse = {
  form: {
    id: string
    title: string | null
    description: string | null
    schema_json: IntakeSchema
    required_for_access: boolean
  } | null
  response: {
    id: string
    answers: Record<string, unknown>
    submitted_at: string
  } | null
}

export const useCustomerIntakeForm = (courseId: string | undefined) =>
  useQuery<CustomerIntakeFormResponse>({
    queryKey: ['customer-intake-form', { courseId }],
    queryFn: () =>
      coachingFetch<CustomerIntakeFormResponse>(
        `/v1/customer-portal/coaching/${courseId}/intake-form`,
      ),
    enabled: !!courseId,
  })

export const useSubmitCustomerIntakeForm = (courseId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (answers: Record<string, unknown>) =>
      coachingFetch<{
        id: string
        answers: Record<string, unknown>
        submitted_at: string
      }>(`/v1/customer-portal/coaching/${courseId}/intake-form/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['customer-intake-form', { courseId }],
      })
    },
  })
}
