// Coaching API client — thin fetch wrappers around the backend coaching
// endpoints. The backend is being added in parallel; calls may 4xx until the
// migration runs. Callers should log + continue gracefully.
//
// All requests are sent with `credentials: 'include'`. On the browser we hit
// NEXT_PUBLIC_API_URL directly; on the server we go through getServerURL.

import { getServerURL } from '@/utils/api'
import type { CoachingLandingData } from './CoachingLanding.types'

export type CoachingProgram = {
  id: string
  product_id: string
  organization_id: string
  title: string | null
  slug: string | null
  format: 'self' | 'cohort' | 'hybrid' | null
  cohort_start: string | null
  cohort_end: string | null
  weeks: number | null
  description: string | null
  promise: string | null
  coach_name: string | null
  coach_bio: string | null
  coach_credentials: string | null
  coach_photo_url: string | null
  thumbnail_url: string | null
  trailer_url: string | null
  pricing_model: string | null
  access_duration: string | null
  free_preview: boolean | null
  landing_data: CoachingLandingData | null
  intake_questions: string[] | null
  session_ideas: string[] | null
  ai_generated: boolean | null
  course_id: string | null
  published_at: string | null
  created_at: string
  modified_at: string | null
}

export type CoachingProgramPatch = Partial<{
  title: string
  format: 'self' | 'cohort' | 'hybrid'
  cohort_start: string | null
  cohort_end: string | null
  weeks: number | null
  description: string | null
  promise: string | null
  coach_name: string | null
  coach_bio: string | null
  coach_credentials: string | null
  pricing_model: string | null
  access_duration: string | null
  free_preview: boolean
  landing_data: CoachingLandingData | null
  intake_questions: string[]
  session_ideas: string[]
}>

export type FinalizeAIBody = {
  modules: { title: string; lessons: { type: string; title: string }[] }[]
  landing_data: unknown
  intake_questions: string[]
  session_ideas: string[]
}

const baseURL = () => getServerURL()

const handle = async <T>(res: Response, label: string): Promise<T> => {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(
      `[coaching] ${label} failed: ${res.status} ${body.slice(0, 200)}`,
    )
    console.warn(err.message)
    throw err
  }
  return (await res.json()) as T
}

export async function createCoachingDraft(body: {
  product_id: string
  title?: string
  organization_id: string
}): Promise<CoachingProgram> {
  const res = await fetch(`${baseURL()}/v1/coaching/draft`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handle<CoachingProgram>(res, 'createCoachingDraft')
}

export async function patchCoachingProgram(
  programId: string,
  body: CoachingProgramPatch,
): Promise<CoachingProgram> {
  const res = await fetch(`${baseURL()}/v1/coaching/${programId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handle<CoachingProgram>(res, 'patchCoachingProgram')
}

export async function uploadCoachPhoto(
  programId: string,
  file: File,
): Promise<CoachingProgram> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${baseURL()}/v1/coaching/${programId}/coach-photo`,
    { method: 'POST', credentials: 'include', body: fd },
  )
  return handle<CoachingProgram>(res, 'uploadCoachPhoto')
}

export async function uploadThumbnail(
  programId: string,
  file: File,
): Promise<CoachingProgram> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${baseURL()}/v1/coaching/${programId}/thumbnail`,
    { method: 'POST', credentials: 'include', body: fd },
  )
  return handle<CoachingProgram>(res, 'uploadThumbnail')
}

export async function uploadLandingMedia(
  programId: string,
  file: File,
): Promise<{ url: string; kind: 'image' | 'video' }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(
    `${baseURL()}/v1/coaching/${programId}/landing-media`,
    { method: 'POST', credentials: 'include', body: fd },
  )
  return handle<{ url: string; kind: 'image' | 'video' }>(res, 'uploadLandingMedia')
}

export async function finalizeAI(
  programId: string,
  body: FinalizeAIBody,
): Promise<CoachingProgram> {
  const res = await fetch(
    `${baseURL()}/v1/coaching/${programId}/finalize-ai`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  return handle<CoachingProgram>(res, 'finalizeAI')
}

export async function publishCoachingProgram(
  programId: string,
): Promise<CoachingProgram> {
  const res = await fetch(`${baseURL()}/v1/coaching/${programId}/publish`, {
    method: 'POST',
    credentials: 'include',
  })
  return handle<CoachingProgram>(res, 'publishCoachingProgram')
}

export async function unpublishCoachingProgram(
  programId: string,
): Promise<CoachingProgram> {
  const res = await fetch(`${baseURL()}/v1/coaching/${programId}/unpublish`, {
    method: 'POST',
    credentials: 'include',
  })
  return handle<CoachingProgram>(res, 'unpublishCoachingProgram')
}

export async function deleteCoachingProgram(programId: string): Promise<void> {
  const res = await fetch(`${baseURL()}/v1/coaching/${programId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok && res.status !== 204) {
    console.warn('[coaching] deleteCoachingProgram failed', res.status)
  }
}

export async function getCoachingProgram(
  programId: string,
): Promise<CoachingProgram | null> {
  try {
    const res = await fetch(`${baseURL()}/v1/coaching/${programId}`, {
      method: 'GET',
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as CoachingProgram
  } catch (e) {
    console.warn('[coaching] getCoachingProgram failed', e)
    return null
  }
}

export async function getPublicCoachingProgram(
  orgSlug: string,
  slug: string,
  fetchInit?: RequestInit,
): Promise<CoachingProgram | null> {
  try {
    const res = await fetch(
      `${baseURL()}/v1/coaching/public/${encodeURIComponent(orgSlug)}/${encodeURIComponent(slug)}`,
      { method: 'GET', ...fetchInit },
    )
    if (!res.ok) return null
    return (await res.json()) as CoachingProgram
  } catch (e) {
    console.warn('[coaching] getPublicCoachingProgram failed', e)
    return null
  }
}
