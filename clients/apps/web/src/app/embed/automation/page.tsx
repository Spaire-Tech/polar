'use client'

// Render-only harness for AutomationSequenceBuilder. No organizationId, so
// it runs purely local (no network). ?seeded=1 preloads a branching tree so
// the connectors / branch split / node tools can be verified.

import {
  AutomationSequenceBuilder,
  type Step,
} from '@/components/Courses/automation/AutomationSequenceBuilder'
import { useEffect, useState } from 'react'

const SEEDED: Step[] = [
  { id: 's1', type: 'email', name: 'Welcome — start here' },
  { id: 's2', type: 'wait', dur: '2 days' },
  {
    id: 's3',
    type: 'branch',
    cond: 'Opened the last email',
    yes: [{ id: 's4', type: 'email', name: 'You’re on a roll' }],
    no: [{ id: 's5', type: 'action', what: 'Add tag “at-risk”' }],
  },
  { id: 's6', type: 'goal', what: 'Completes the course' },
]

export default function AutomationEmbed() {
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => setParams(new URLSearchParams(window.location.search)), [])
  if (!params) return null
  const seeded = params.get('seeded') === '1'
  return (
    <AutomationSequenceBuilder
      courseId={params.get('course') ? 'c1' : undefined}
      initial={seeded ? { name: 'Onboarding drip', steps: SEEDED } : undefined}
    />
  )
}
