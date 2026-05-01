// Embeds an AI-generated landing-page JSON payload inside a course's
// `description` field using a sentinel marker. This avoids a backend schema
// change while keeping the human description readable above the marker.
//
// Format on disk:
//   <human description>
//
//   <!--SPAIRE_LANDING_V1-->
//   {...json...}

import type { CourseLanding } from './schemas'

const MARKER = '<!--SPAIRE_LANDING_V1-->'

export type StoredLanding = Partial<CourseLanding> & {
  editable?: {
    instructorName?: string | null
    courseTitle?: string | null
    description?: string | null
  } | null
}

export function joinLanding(
  humanDescription: string | null | undefined,
  landing: StoredLanding | null | undefined,
): string {
  const human = (humanDescription ?? '').trim()
  if (!landing) return human
  const json = JSON.stringify(landing)
  return human ? `${human}\n\n${MARKER}\n${json}` : `${MARKER}\n${json}`
}

export function splitLanding(description: string | null | undefined): {
  humanDescription: string | null
  landing: StoredLanding | null
} {
  if (!description) return { humanDescription: null, landing: null }
  const idx = description.indexOf(MARKER)
  if (idx < 0) return { humanDescription: description, landing: null }
  const human = description.slice(0, idx).trim() || null
  const tail = description.slice(idx + MARKER.length).trim()
  if (!tail) return { humanDescription: human, landing: null }
  try {
    const parsed = JSON.parse(tail) as StoredLanding
    return { humanDescription: human, landing: parsed }
  } catch {
    return { humanDescription: human, landing: null }
  }
}
