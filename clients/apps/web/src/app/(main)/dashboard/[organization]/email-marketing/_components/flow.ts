// Sequence flow document — the canonical client-side representation of a
// sequence's authored content. We persist this whole tree via
// `trigger_config.flow_doc` on the EmailSequence row, and additionally
// materialize email steps as real `EmailSequenceStep` rows so the worker
// (which today walks linear email steps with a delay_hours) keeps working.
//
// The full set of step types — wait / branch / action / goal — is rendered
// and authored in the UI but interpreted today as visual-only structure;
// the worker will gain branch/action/goal handling in a follow-up.

export type StepId = string

export type EmailStepValue = {
  subject: string
  preview: string
  fromName: string
  fromEmail: string
  template: 'blank' | 'plain' | 'announcement' | 'product' | 'digest'
  abTest: boolean
  trackClicks: boolean
  // Mirror of authored block content (optional; if present we render it via
  // the email worker, otherwise fall back to a plain wrapper).
  content_html?: string | null
  content_json?: Record<string, unknown> | null
}

export type WaitStepValue = {
  mode: 'duration' | 'until-time' | 'until-event'
  amount: number
  unit: 'min' | 'hour' | 'day' | 'week'
  dayOffset?: 'next' | '+2' | '+3' | '+7'
  time?: string
  event?: string
}

export type BranchStepValue = {
  field:
    | 'opened-prev'
    | 'clicked-prev'
    | 'has-tag'
    | 'product-bought'
    | 'engagement'
  tag?: string
  product?: string
  op?: 'gte' | 'lte' | 'eq'
  threshold?: number
}

export type ActionStepValue = {
  action:
    | 'add-tag'
    | 'remove-tag'
    | 'update-field'
    | 'enroll'
    | 'webhook'
    | 'notify'
  tag?: string
  sequence?: string
  url?: string
  // update-field key/value pair, persisted on the subscriber's
  // custom_fields. Empty key is treated as a no-op by the worker.
  key?: string
  value?: string
}

export type GoalStepValue = {
  event: string
}

export type StepNode =
  | { id: StepId; type: 'email'; value: EmailStepValue }
  | { id: StepId; type: 'wait'; value: WaitStepValue }
  | { id: StepId; type: 'branch'; value: BranchStepValue }
  | { id: StepId; type: 'action'; value: ActionStepValue }
  | { id: StepId; type: 'goal'; value: GoalStepValue }

export type FlowDoc = {
  version: 1
  category: string
  audience: AudienceConfig
  goal: { event: string; window: '7' | '14' | '30' | 'forever' }
  send: {
    window: 'anytime' | 'daily' | 'weekdays' | 'custom'
    start: string
    end: string
    respectTimezone: boolean
    pauseOnUnsub: boolean
    skipIfInOther: boolean
    frequencyCap: boolean
  }
  steps: StepNode[]
}

export type AudienceConfig = {
  mode: 'all' | 'filtered'
  // Filter row id is opaque; new rows mint a UUID so two clicks within the
  // same millisecond don't collide (audit issue #12 — `Date.now()` keys
  // could produce duplicates and break React reconciliation).
  filters: { id: string; field: string; op: string; value: string }[]
  excludeTags: string[]
}

export const newId = (): StepId =>
  `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const DEFAULT_STEP_VALUES = {
  email: (): EmailStepValue => ({
    subject: 'Welcome — you’re in',
    preview: 'A quick note about what to expect over the next few days.',
    fromName: 'Spaire',
    fromEmail: 'hello@yoursite.com',
    template: 'plain',
    abTest: false,
    trackClicks: true,
  }),
  wait: (): WaitStepValue => ({
    mode: 'duration',
    amount: 1,
    unit: 'day',
    dayOffset: 'next',
    time: '09:00',
    event: 'module-1-started',
  }),
  branch: (): BranchStepValue => ({ field: 'opened-prev' }),
  action: (): ActionStepValue => ({
    action: 'add-tag',
    tag: 'sequence-completed',
  }),
  goal: (): GoalStepValue => ({ event: 'module-1-started' }),
}

export const DEFAULT_FLOW_DOC = (): FlowDoc => ({
  version: 1,
  category: 'onboarding',
  audience: {
    mode: 'all',
    filters: [],
    excludeTags: [],
  },
  goal: { event: 'none', window: '14' },
  send: {
    window: 'weekdays',
    start: '09:00',
    end: '17:00',
    respectTimezone: true,
    pauseOnUnsub: true,
    skipIfInOther: true,
    frequencyCap: true,
  },
  steps: [],
})

export const stepTitle = (step: StepNode): string => {
  if (step.type === 'email') return step.value.subject || 'Untitled email'
  if (step.type === 'wait') {
    const v = step.value
    if (v.mode === 'duration')
      return `Wait ${v.amount} ${v.unit}${v.amount > 1 ? 's' : ''}`
    if (v.mode === 'until-time') return `Wait until ${v.time ?? '09:00'}`
    return 'Wait until event'
  }
  if (step.type === 'branch') {
    return `If ${BRANCH_FIELD_LABEL[step.value.field] ?? step.value.field}`
  }
  if (step.type === 'action') {
    return ACTION_LABEL[step.value.action] ?? 'Action'
  }
  return `Goal: ${step.value.event}`
}

export const stepSummary = (step: StepNode): string => {
  if (step.type === 'email') return step.value.template
  if (step.type === 'wait' && step.value.mode === 'duration')
    return `${step.value.amount} ${step.value.unit}`
  return ''
}

export const BRANCH_FIELD_LABEL: Record<string, string> = {
  'opened-prev': 'opened previous email',
  'clicked-prev': 'clicked previous email',
  'has-tag': 'has tag',
  'product-bought': 'bought product',
  engagement: 'engagement score',
}

export const ACTION_LABEL: Record<string, string> = {
  'add-tag': 'Add tag',
  'remove-tag': 'Remove tag',
  'update-field': 'Update custom field',
  enroll: 'Enrol in another sequence',
  webhook: 'Send webhook',
  notify: 'Notify team via Slack',
}

// Convert wait amount/unit to hours for materialized EmailSequenceStep rows.
export const waitToHours = (v: WaitStepValue): number => {
  if (v.mode !== 'duration') return 0
  const amount = Number.isFinite(v.amount) ? Math.max(0, Number(v.amount)) : 0
  switch (v.unit) {
    case 'min':
      return Math.round((amount / 60) * 100) / 100
    case 'hour':
      return amount
    case 'day':
      return amount * 24
    case 'week':
      return amount * 24 * 7
  }
}

// Roll up wait steps preceding each email into the email's delay_hours.
// Branch/action/goal entries don't contribute time today; the worker walks
// emails in order so this is the closest faithful mapping.
export type MaterializedEmail = {
  index: number // 0-based among emails
  step: Extract<StepNode, { type: 'email' }>
  delayHours: number
}

export const materializeEmailsFromFlow = (
  steps: StepNode[],
): MaterializedEmail[] => {
  const out: MaterializedEmail[] = []
  let pending = 0
  let emailIdx = 0
  for (const node of steps) {
    if (node.type === 'wait') {
      pending += waitToHours(node.value)
      continue
    }
    if (node.type === 'email') {
      out.push({ index: emailIdx, step: node, delayHours: pending })
      pending = 0
      emailIdx += 1
    }
    // branch/action/goal don't contribute to wait time today
  }
  return out
}

export const estimateDays = (steps: StepNode[]): number => {
  const total = steps.reduce(
    (acc, s) => (s.type === 'wait' ? acc + waitToHours(s.value) : acc),
    0,
  )
  return Math.max(1, Math.round(total / 24))
}

export const isFlowDoc = (raw: unknown): raw is FlowDoc => {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return r.version === 1 && Array.isArray(r.steps)
}

export const adoptFlowDoc = (raw: unknown): FlowDoc | null => {
  if (!isFlowDoc(raw)) return null
  // Trust shape; defensively backfill missing keys so older docs don't crash.
  const fallback = DEFAULT_FLOW_DOC()
  return {
    version: 1,
    category:
      typeof raw.category === 'string' ? raw.category : fallback.category,
    audience: {
      mode: raw.audience?.mode === 'filtered' ? 'filtered' : 'all',
      filters: Array.isArray(raw.audience?.filters)
        ? (raw.audience.filters as AudienceConfig['filters'])
        : [],
      excludeTags: Array.isArray(raw.audience?.excludeTags)
        ? (raw.audience.excludeTags as string[])
        : [],
    },
    goal: {
      event: raw.goal?.event ?? 'none',
      window: (raw.goal?.window as FlowDoc['goal']['window']) ?? '14',
    },
    send: { ...fallback.send, ...(raw.send ?? {}) },
    steps: raw.steps as StepNode[],
  }
}
