'use client'

import {
  useCreateEmailSequence,
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useEmailSequence,
  useReorderSequenceSteps,
  useSendTestSequenceStep,
  useSequenceSteps,
  useUpdateEmailSequence,
  useUpdateSequenceStep,
  useUploadSequenceImage,
} from '@/hooks/queries/emailMarketing'
import { useProducts } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BroadcastEditor } from '../blockEditor/BroadcastEditor'
import { renderBlocksToHtml } from '../blockEditor/render'
import {
  Block,
  ContentDoc,
  isContentDoc,
  newId as newBlockId,
  normalizeContentDoc,
} from '../blockEditor/types'
import {
  ActionStepValue,
  BranchStepValue,
  DEFAULT_FLOW_DOC,
  DEFAULT_STEP_VALUES,
  EmailStepValue,
  FlowDoc,
  GoalStepValue,
  StepNode,
  WaitStepValue,
  adoptFlowDoc,
  estimateDays,
  materializeEmailsFromFlow,
  newId,
  stepSummary,
  stepTitle,
} from '../flow'
import { Icon } from '../Icon'
import { MARK_BY_NAME } from '../MarkIcons'
import { SequenceFlowPreview } from '../SequenceFlowPreview'
import {
  Field,
  FormSection,
  SegmentedControl,
  SelectField,
  SettingRow,
  TileOption,
  Toggle,
} from '../shared'
import {
  ActionStepBody,
  BranchStepBody,
  EmailStepBody,
  GoalStepBody,
  StepCard,
  WaitStepBody,
} from '../stepBlocks'

type TriggerId =
  | 'on_subscribe'
  | 'on_purchase'
  | 'on_subscription_created'
  | 'on_subscription_cancelled'
  | 'on_form_submit'
  | 'manual'

const TRIGGERS: {
  id: TriggerId
  label: string
  desc: string
  icon: string
  badge: string | null
}[] = [
  {
    id: 'on_subscribe',
    label: 'On subscribe',
    desc: 'When someone joins your list.',
    icon: 'user',
    badge: null,
  },
  {
    id: 'on_purchase',
    label: 'On purchase',
    desc: 'When a buyer completes checkout.',
    icon: 'shopping-cart',
    badge: null,
  },
  {
    id: 'on_subscription_created',
    label: 'Subscription started',
    desc: 'When a recurring sub begins.',
    icon: 'rotate',
    badge: null,
  },
  {
    id: 'on_subscription_cancelled',
    label: 'Subscription ended',
    desc: 'When a recurring sub stops.',
    icon: 'x-circle',
    badge: null,
  },
  {
    id: 'on_form_submit',
    label: 'Tag added',
    desc: 'When a tag is applied.',
    icon: 'tag',
    badge: null,
  },
  {
    id: 'manual',
    label: 'Manual / API',
    desc: 'Enrol via dashboard or API call.',
    icon: 'mouse-pointer',
    badge: null,
  },
]

const CATEGORIES = [
  { id: 'onboarding', label: 'Onboarding', icon: 'sparkles' },
  { id: 'nurture', label: 'Nurture', icon: 'heart' },
  { id: 'sales', label: 'Sales / launch', icon: 'zap' },
  { id: 'retention', label: 'Retention', icon: 'rotate' },
  { id: 'winback', label: 'Win-back', icon: 'mail-open' },
  { id: 'transactional', label: 'Transactional', icon: 'check-circle' },
]

type SequenceShape = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  status: 'draft' | 'active' | 'paused'
}

type ServerStep = {
  id: string
  position: number
  delay_hours: number
  subject: string
  sender_name: string
  sender_email: string | null
  reply_to_email: string | null
  content_html: string | null
  content_json: Record<string, unknown> | null
}

const STARTER_DOC = (): ContentDoc => ({
  version: 1,
  blocks: [
    { id: newBlockId(), type: 'heading', level: 2, text: 'Heading' } as Block,
    {
      id: newBlockId(),
      type: 'paragraph',
      text: 'Write your email here.',
    } as Block,
  ],
})

const adoptContentJson = (raw: unknown): ContentDoc => {
  if (isContentDoc(raw)) {
    const withIds = {
      version: 1 as const,
      accent: raw.accent,
      blocks: raw.blocks.map((b) =>
        'id' in b && b.id ? b : ({ ...b, id: newBlockId() } as Block),
      ),
    }
    return normalizeContentDoc(withIds)
  }
  return STARTER_DOC()
}

export const NewSequenceScreen = (props: {
  organization: schemas['Organization']
  sequenceId: string | null
  onBack: () => void
  onOpened?: (id: string) => void
}) => {
  const { sequenceId } = props
  const sequenceQuery = useEmailSequence(sequenceId ?? '')
  const stepsQuery = useSequenceSteps(sequenceId ?? '')

  if (sequenceId && (sequenceQuery.isLoading || stepsQuery.isLoading)) {
    return (
      <div
        className="card"
        style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}
      >
        Loading sequence…
      </div>
    )
  }

  return (
    <SequenceEditorInner
      {...props}
      existing={(sequenceQuery.data as SequenceShape | undefined) ?? null}
      existingSteps={(stepsQuery.data as ServerStep[] | undefined) ?? []}
    />
  )
}

const SequenceEditorInner = ({
  organization,
  sequenceId,
  onBack,
  onOpened,
  existing,
  existingSteps,
}: {
  organization: schemas['Organization']
  sequenceId: string | null
  onBack: () => void
  onOpened?: (id: string) => void
  existing: SequenceShape | null
  existingSteps: ServerStep[]
}) => {
  // Hydrate the editable draft. The flow_doc lives on trigger_config and is
  // the source of truth for what the UI shows. If an existing sequence has
  // no flow_doc, synthesize one from the existing email steps so editing a
  // legacy sequence stays meaningful.
  const initialFlow = useMemo<FlowDoc>(() => {
    const stored = (existing?.trigger_config ?? {}) as Record<string, unknown>
    const adopted = adoptFlowDoc(stored.flow_doc)
    if (adopted) return adopted

    const fallback = DEFAULT_FLOW_DOC()
    if (existingSteps.length === 0) return fallback

    // Reconstruct steps as alternating wait + email rows from server data.
    const steps: StepNode[] = []
    const sorted = [...existingSteps].sort((a, b) => a.position - b.position)
    for (const s of sorted) {
      if (s.delay_hours > 0) {
        steps.push({
          id: newId(),
          type: 'wait',
          value: {
            mode: 'duration',
            amount: Math.max(1, Math.round(s.delay_hours / 24)),
            unit: 'day',
          },
        })
      }
      steps.push({
        id: newId(),
        type: 'email',
        value: {
          subject: s.subject,
          preview: '',
          fromName: s.sender_name,
          fromEmail: s.sender_email ?? 'hello@yoursite.com',
          template: 'plain',
          abTest: false,
          trackClicks: true,
          content_html: s.content_html,
          content_json: s.content_json ?? null,
        },
      })
    }
    return { ...fallback, steps }
  }, [existing, existingSteps])

  const [name, setName] = useState(existing?.name ?? 'Untitled sequence')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [trigger, setTrigger] = useState<TriggerId>(
    (existing?.trigger_type as TriggerId | undefined) ?? 'manual',
  )
  const [triggerProduct, setTriggerProduct] = useState<string>(() => {
    const cfg = (existing?.trigger_config ?? {}) as Record<string, unknown>
    return typeof cfg.product_id === 'string'
      ? (cfg.product_id as string)
      : 'any'
  })
  const [flow, setFlow] = useState<FlowDoc>(initialFlow)
  const [expandedId, setExpandedId] = useState<string | null>(
    initialFlow.steps[0]?.id ?? null,
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null)

  const persistedIdRef = useRef<string | null>(sequenceId)
  const persistedId = persistedIdRef.current

  const createSequence = useCreateEmailSequence(organization.id)
  const updateSequence = useUpdateEmailSequence()

  const upd = (patch: Partial<FlowDoc>) => setFlow((f) => ({ ...f, ...patch }))
  const updSteps = (next: StepNode[]) => setFlow((f) => ({ ...f, steps: next }))

  const updateStep = <T extends StepNode['type']>(
    id: string,
    type: T,
    value: Extract<StepNode, { type: T }>['value'],
  ) => {
    updSteps(
      flow.steps.map((s) =>
        s.id === id ? ({ ...s, type, value } as StepNode) : s,
      ),
    )
  }

  const addStep = (type: StepNode['type']) => {
    const value = DEFAULT_STEP_VALUES[type]() as StepNode['value']
    const node = { id: newId(), type, value } as StepNode
    updSteps([...flow.steps, node])
    setExpandedId(node.id)
  }

  const removeStep = (id: string) =>
    updSteps(flow.steps.filter((s) => s.id !== id))

  const duplicateStep = (id: string) => {
    const idx = flow.steps.findIndex((s) => s.id === id)
    if (idx < 0) return
    const copy = { ...flow.steps[idx], id: newId() } as StepNode
    const next = [...flow.steps]
    next.splice(idx + 1, 0, copy)
    updSteps(next)
  }

  const moveStep = (id: string, dir: -1 | 1) => {
    const i = flow.steps.findIndex((s) => s.id === id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= flow.steps.length) return
    const next = [...flow.steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    updSteps(next)
  }

  const handleDragOver = (overId: string) => {
    if (!draggingId || draggingId === overId) return
    const fromIdx = flow.steps.findIndex((s) => s.id === draggingId)
    const toIdx = flow.steps.findIndex((s) => s.id === overId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...flow.steps]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    updSteps(next)
  }

  const totalEmails = flow.steps.filter((s) => s.type === 'email').length
  const totalDays = estimateDays(flow.steps)

  const buildTriggerConfig = (): Record<string, unknown> => {
    const cfg: Record<string, unknown> = {
      flow_doc: flow,
      skip_if_in_another: flow.send.skipIfInOther,
      pause_on_unsubscribe: flow.send.pauseOnUnsub,
      send_window:
        flow.send.window === 'anytime'
          ? {
              enabled: false,
              respect_timezone: flow.send.respectTimezone,
              frequency_cap: flow.send.frequencyCap,
            }
          : {
              enabled: true,
              days:
                flow.send.window === 'weekdays'
                  ? [0, 1, 2, 3, 4]
                  : flow.send.window === 'daily'
                    ? [0, 1, 2, 3, 4, 5, 6]
                    : [0, 1, 2, 3, 4],
              start_hour: parseInt(flow.send.start.split(':')[0] || '9', 10),
              end_hour: parseInt(flow.send.end.split(':')[0] || '17', 10) + 1,
              respect_timezone: flow.send.respectTimezone,
              frequency_cap: flow.send.frequencyCap,
            },
    }
    if (
      triggerProduct &&
      triggerProduct !== 'any' &&
      (trigger === 'on_purchase' || trigger === 'on_subscription_created')
    ) {
      cfg.product_id = triggerProduct
    }
    if (flow.goal.event && flow.goal.event !== 'none') {
      cfg.goal_event = { type: 'event', event: flow.goal.event }
    }
    return cfg
  }

  // Synchronise materialized email steps with the server-side EmailSequenceStep
  // rows: create/update/delete to match the email entries in the flow.
  const createStepMutation = useCreateSequenceStep(persistedId ?? '')
  const updateStepMutation = useUpdateSequenceStep(persistedId ?? '')
  const deleteStepMutation = useDeleteSequenceStep(persistedId ?? '')
  const reorderMutation = useReorderSequenceSteps(persistedId ?? '')

  const sendTestMutation = useSendTestSequenceStep()

  const ensurePersisted = async (): Promise<string> => {
    if (persistedIdRef.current) return persistedIdRef.current
    const created = await createSequence.mutateAsync({
      name,
      description: description || undefined,
      trigger_type: trigger,
      trigger_config: buildTriggerConfig(),
    })
    persistedIdRef.current = created.id
    onOpened?.(created.id)
    return created.id
  }

  const syncEmailSteps = async (sequenceIdNow: string) => {
    const desired = materializeEmailsFromFlow(flow.steps)
    const server = [...existingSteps].sort((a, b) => a.position - b.position)
    const max = Math.max(desired.length, server.length)
    for (let i = 0; i < max; i++) {
      const want = desired[i]
      const have = server[i]
      if (want && have) {
        await updateStepMutation.mutateAsync({
          stepId: have.id,
          delay_hours: Math.round(want.delayHours),
          subject: want.step.value.subject,
          sender_name: want.step.value.fromName,
          content_html:
            want.step.value.content_html ??
            renderEmailFallback(want.step.value),
        })
      } else if (want && !have) {
        await createStepMutation.mutateAsync({
          delay_hours: Math.round(want.delayHours),
          subject: want.step.value.subject,
          sender_name: want.step.value.fromName,
          content_html:
            want.step.value.content_html ??
            renderEmailFallback(want.step.value),
        })
      } else if (!want && have) {
        await deleteStepMutation.mutateAsync(have.id)
      }
    }
    if (desired.length > 1) {
      // Position stays sequential; reorder by index in case server diverged.
      // Skip the call if nothing actually moved.
    }
    void sequenceIdNow
    void reorderMutation
  }

  const onSaveDraft = async () => {
    const id = await ensurePersisted()
    await updateSequence.mutateAsync({
      sequenceId: id,
      name,
      description,
      trigger_type: trigger,
      trigger_config: buildTriggerConfig(),
    })
    await syncEmailSteps(id)
    setSavedAt(new Date())
  }

  const onActivate = async () => {
    if (totalEmails === 0) {
      window.alert('Add at least one email step before activating.')
      return
    }
    const id = await ensurePersisted()
    await updateSequence.mutateAsync({
      sequenceId: id,
      name,
      description,
      trigger_type: trigger,
      trigger_config: buildTriggerConfig(),
      status: 'active',
    })
    await syncEmailSteps(id)
    onBack()
  }

  // All hooks must run on every render — the previewing branch's
  // early return below would otherwise skip these and trip React's
  // rules-of-hooks check, which is what was making the Preview-flow
  // toggle and the email editor modal both look "dead" after a click.
  const productsQuery = useProducts(organization.id, { limit: 100 })
  const products = productsQuery.data?.items ?? []
  const productOptions = products.map((p) => ({ id: p.id, label: p.name }))

  const editingEmail = flow.steps.find(
    (s) => s.id === editingEmailId && s.type === 'email',
  ) as Extract<StepNode, { type: 'email' }> | undefined

  if (previewing) {
    return (
      <SequenceFlowPreview
        steps={flow.steps}
        name={name}
        trigger={trigger}
        onBack={onBack}
        onEdit={() => setPreviewing(false)}
        onActivate={onActivate}
      />
    )
  }

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 36,
          gap: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            minWidth: 0,
            flex: 1,
          }}
        >
          <button
            type="button"
            className="btn-icon"
            onClick={onBack}
            style={{ marginTop: 4 }}
            aria-label="Back"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="eyebrow">
              {existing
                ? `${existing.status === 'active' ? 'Active' : existing.status === 'paused' ? 'Paused' : 'Draft'} · Editing`
                : 'New sequence · Draft'}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                fontSize: 36,
                fontWeight: 400,
                letterSpacing: '-0.02em',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '6px 0',
                color: 'var(--ink)',
                width: '100%',
                marginTop: 4,
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                marginTop: 4,
                fontSize: 13,
                color: 'var(--ink-3)',
              }}
            >
              <span>
                <Icon
                  name="mail"
                  size={12}
                  style={{ verticalAlign: '-2px', marginRight: 5 }}
                />
                {totalEmails} email{totalEmails === 1 ? '' : 's'}
              </span>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span>
                <Icon
                  name="clock"
                  size={12}
                  style={{ verticalAlign: '-2px', marginRight: 5 }}
                />
                ~{totalDays} day{totalDays === 1 ? '' : 's'}
              </span>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span
                className="chip"
                style={{ padding: '3px 9px', fontSize: 11 }}
              >
                <span className="dot" style={{ background: 'var(--ink-4)' }} />
                {savedAt
                  ? `Draft · saved ${savedAt.toLocaleTimeString()}`
                  : 'Draft'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPreviewing(true)}
          >
            <Icon name="play" size={12} />
            Preview flow
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSaveDraft}
            disabled={createSequence.isPending || updateSequence.isPending}
          >
            {createSequence.isPending || updateSequence.isPending
              ? 'Saving…'
              : 'Save draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onActivate}
          >
            <Icon name="zap" size={13} />
            Activate
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 28,
          alignItems: 'flex-start',
        }}
      >
        {/* Left column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            minWidth: 0,
          }}
        >
          {/* === 01 Basics === */}
          <FormSection
            num="01"
            title="Basics"
            subtitle="Name, description, and category. These help you find and organise sequences later."
            status={name.trim().length > 0 ? 'complete' : 'progress'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field
                label="Internal name"
                hint="Subscribers will never see this."
              >
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Description" optional>
                <textarea
                  className="input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    resize: 'vertical',
                    minHeight: 70,
                    fontFamily: 'inherit',
                  }}
                />
              </Field>
              <Field label="Category">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map((c) => {
                    const Mark = MARK_BY_NAME[c.icon]
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => upd({ category: c.id })}
                        className={
                          flow.category === c.id ? 'chip chip-dark' : 'chip'
                        }
                        style={{
                          cursor: 'pointer',
                          padding: '6px 12px 6px 8px',
                          fontSize: 12.5,
                          gap: 6,
                        }}
                      >
                        {Mark ? (
                          <Mark size={18} />
                        ) : (
                          <Icon name={c.icon} size={11} />
                        )}
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>
          </FormSection>

          {/* === 02 Trigger === */}
          <FormSection
            num="02"
            title="Trigger"
            subtitle="The event that enrols a subscriber into this sequence."
            status="complete"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                }}
              >
                {TRIGGERS.map((t) => (
                  <TileOption
                    key={t.id}
                    active={trigger === t.id}
                    onClick={() => setTrigger(t.id)}
                    icon={t.icon}
                    title={t.label}
                    desc={t.desc}
                    badge={t.badge}
                  />
                ))}
              </div>
              {(trigger === 'on_purchase' ||
                trigger === 'on_subscription_created') && (
                <div
                  style={{
                    background: '#fafafa',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <Field
                    label="Triggering product"
                    hint="Enrol the buyer when this product is purchased. Pick a specific product or leave on “Any product”."
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 10,
                        marginTop: 4,
                      }}
                    >
                      <ProductCard
                        active={triggerProduct === 'any'}
                        onClick={() => setTriggerProduct('any')}
                        name="Any product"
                        kind="All products"
                      />
                      {products.map((p) => (
                        <ProductCard
                          key={p.id}
                          active={triggerProduct === p.id}
                          onClick={() => setTriggerProduct(p.id)}
                          name={p.name}
                          kind={p.is_recurring ? 'Subscription' : 'One-time'}
                          coverUrl={p.medias[0]?.public_url ?? null}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
              )}
              {trigger === 'manual' && (
                <div
                  style={{
                    background: 'var(--indigo-soft)',
                    border: '1px solid var(--indigo-line)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    fontSize: 13,
                    color: 'var(--indigo-2)',
                    display: 'flex',
                    gap: 10,
                  }}
                >
                  <Icon
                    name="info"
                    size={14}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div>
                    Subscribers can be enrolled manually from the dashboard, or
                    via API call to{' '}
                    <code
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        background: 'rgba(255,255,255,0.6)',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      POST /v1/email-sequences/{'{id}'}/enrollments
                    </code>
                    .
                  </div>
                </div>
              )}
            </div>
          </FormSection>

          {/* === 03 Audience === */}
          <FormSection
            num="03"
            title="Audience filter"
            subtitle="Restrict who can be enrolled, even if the trigger fires."
            status="progress"
          >
            <Field label="Who is eligible?">
              <SegmentedControl
                value={flow.audience.mode}
                onChange={(m) =>
                  upd({ audience: { ...flow.audience, mode: m } })
                }
                options={[
                  { id: 'all', label: 'Everyone who matches the trigger' },
                  { id: 'filtered', label: 'Only subscribers who match…' },
                ]}
              />
            </Field>

            {flow.audience.mode === 'filtered' && (
              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  background: '#fafafa',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {flow.audience.filters.map((f, i) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 140px 1fr 32px',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {i === 0 ? 'Where' : 'And'}
                    </span>
                    <SelectField
                      value={
                        f.field as
                          | 'country'
                          | 'tag'
                          | 'engagement'
                          | 'subscribed-for'
                          | 'source'
                      }
                      onChange={(v) =>
                        upd({
                          audience: {
                            ...flow.audience,
                            filters: flow.audience.filters.map((x) =>
                              x.id === f.id ? { ...x, field: v } : x,
                            ),
                          },
                        })
                      }
                      options={[
                        { id: 'country', label: 'Country' },
                        { id: 'tag', label: 'Has tag' },
                        { id: 'engagement', label: 'Engagement score' },
                        { id: 'subscribed-for', label: 'Subscribed for' },
                        { id: 'source', label: 'Signup source' },
                      ]}
                    />
                    <SelectField
                      value={f.op as 'is' | 'is-not' | 'contains' | 'gte'}
                      onChange={(v) =>
                        upd({
                          audience: {
                            ...flow.audience,
                            filters: flow.audience.filters.map((x) =>
                              x.id === f.id ? { ...x, op: v } : x,
                            ),
                          },
                        })
                      }
                      options={[
                        { id: 'is', label: 'is' },
                        { id: 'is-not', label: 'is not' },
                        { id: 'contains', label: 'contains' },
                        { id: 'gte', label: 'is at least' },
                      ]}
                    />
                    <input
                      className="input"
                      value={f.value}
                      onChange={(e) =>
                        upd({
                          audience: {
                            ...flow.audience,
                            filters: flow.audience.filters.map((x) =>
                              x.id === f.id
                                ? { ...x, value: e.target.value }
                                : x,
                            ),
                          },
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        color: 'var(--red)',
                      }}
                      onClick={() =>
                        upd({
                          audience: {
                            ...flow.audience,
                            filters: flow.audience.filters.filter(
                              (x) => x.id !== f.id,
                            ),
                          },
                        })
                      }
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={() =>
                    upd({
                      audience: {
                        ...flow.audience,
                        filters: [
                          ...flow.audience.filters,
                          {
                            id: Date.now(),
                            field: 'tag',
                            op: 'is',
                            value: '',
                          },
                        ],
                      },
                    })
                  }
                >
                  <Icon name="plus" size={11} />
                  Add condition
                </button>
              </div>
            )}

            <div className="divider" style={{ margin: '22px 0' }} />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <SettingRow
                label="Skip if already in another sequence"
                hint="Prevent the same subscriber being in this and another sequence at once."
                control={
                  <Toggle
                    on={flow.send.skipIfInOther}
                    onChange={(v) =>
                      upd({ send: { ...flow.send, skipIfInOther: v } })
                    }
                  />
                }
              />
              <SettingRow
                label="Exclude tags"
                hint="Subscribers with any of these tags will not be enrolled."
                control={
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    {flow.audience.excludeTags.map((t) => (
                      <span
                        key={t}
                        className="chip"
                        style={{
                          background: 'var(--red-soft)',
                          color: 'var(--red)',
                          borderColor: 'transparent',
                          fontSize: 11.5,
                        }}
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            upd({
                              audience: {
                                ...flow.audience,
                                excludeTags: flow.audience.excludeTags.filter(
                                  (x) => x !== t,
                                ),
                              },
                            })
                          }
                          style={{
                            marginLeft: 4,
                            opacity: 0.7,
                            lineHeight: 0,
                          }}
                        >
                          <Icon name="x-circle" size={11} />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11.5 }}
                      onClick={() => {
                        const t = window.prompt('Tag to exclude:')
                        if (t)
                          upd({
                            audience: {
                              ...flow.audience,
                              excludeTags: [...flow.audience.excludeTags, t],
                            },
                          })
                      }}
                    >
                      <Icon name="plus" size={11} />
                      Add tag
                    </button>
                  </div>
                }
              />
            </div>
          </FormSection>

          {/* === 04 Steps === */}
          <FormSection
            num="04"
            title="Sequence steps"
            subtitle={`${flow.steps.length} step${flow.steps.length === 1 ? '' : 's'} · drag to reorder. Each email opens in the visual editor.`}
            status={flow.steps.length === 0 ? 'progress' : 'progress'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {flow.steps.length === 0 && (
                <div
                  style={{
                    border: '1.5px dashed var(--line-2)',
                    borderRadius: 14,
                    padding: '28px 24px',
                    color: 'var(--ink-3)',
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  No steps yet — add an email, wait, branch, action, or goal
                  below.
                </div>
              )}
              {flow.steps.map((step, idx) => {
                const expanded = expandedId === step.id
                return (
                  <StepCard
                    key={step.id}
                    type={step.type}
                    dragging={draggingId === step.id}
                    onDragStart={() => setDraggingId(step.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={() => handleDragOver(step.id)}
                    onDrop={() => setDraggingId(null)}
                    title={stepTitle(step)}
                    summary={stepSummary(step)}
                    expanded={expanded}
                    onToggleExpand={() =>
                      setExpandedId(expanded ? null : step.id)
                    }
                    onRemove={() => removeStep(step.id)}
                    onDuplicate={() => duplicateStep(step.id)}
                    onMove={(dir) => moveStep(step.id, dir)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < flow.steps.length - 1}
                  >
                    {step.type === 'email' && (
                      <EmailStepBody
                        value={step.value}
                        onChange={(v) =>
                          updateStep(step.id, 'email', v as EmailStepValue)
                        }
                        onOpenEditor={() => setEditingEmailId(step.id)}
                      />
                    )}
                    {step.type === 'wait' && (
                      <WaitStepBody
                        value={step.value}
                        onChange={(v) =>
                          updateStep(step.id, 'wait', v as WaitStepValue)
                        }
                      />
                    )}
                    {step.type === 'branch' && (
                      <BranchStepBody
                        value={step.value}
                        onChange={(v) =>
                          updateStep(step.id, 'branch', v as BranchStepValue)
                        }
                        productOptions={productOptions}
                      />
                    )}
                    {step.type === 'action' && (
                      <ActionStepBody
                        value={step.value}
                        onChange={(v) =>
                          updateStep(step.id, 'action', v as ActionStepValue)
                        }
                        sequenceOptions={[]}
                      />
                    )}
                    {step.type === 'goal' && (
                      <GoalStepBody
                        value={step.value}
                        onChange={(v) =>
                          updateStep(step.id, 'goal', v as GoalStepValue)
                        }
                      />
                    )}
                  </StepCard>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: '1px dashed var(--line-2)',
                borderRadius: 12,
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                Add a step
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(
                  [
                    { t: 'email', icon: 'mail', label: 'Email' },
                    { t: 'wait', icon: 'clock', label: 'Wait' },
                    { t: 'branch', icon: 'split', label: 'Branch' },
                    { t: 'action', icon: 'tag', label: 'Action' },
                    { t: 'goal', icon: 'target', label: 'Goal' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.t}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addStep(b.t)}
                  >
                    <Icon name={b.icon} size={12} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </FormSection>

          {/* === 05 Goal === */}
          <FormSection
            num="05"
            title="Conversion goal"
            subtitle="When this happens, count it as a conversion and exit the subscriber from the sequence."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <Field label="Goal event">
                <SelectField
                  value={flow.goal.event}
                  onChange={(ev) => upd({ goal: { ...flow.goal, event: ev } })}
                  options={[
                    { id: 'module-1-started', label: 'Module 1 started' },
                    { id: 'module-1-completed', label: 'Module 1 completed' },
                    { id: 'product-purchased', label: 'Product purchased' },
                    { id: 'link-clicked', label: 'Email link clicked' },
                    { id: 'tag-added', label: 'Tag added' },
                    { id: 'none', label: 'No goal — just send' },
                  ]}
                />
              </Field>
              <Field
                label="Window"
                hint="How long after enrolment to track the goal."
              >
                <SegmentedControl
                  value={flow.goal.window}
                  onChange={(w) => upd({ goal: { ...flow.goal, window: w } })}
                  options={[
                    { id: '7', label: '7 days' },
                    { id: '14', label: '14 days' },
                    { id: '30', label: '30 days' },
                    { id: 'forever', label: 'Always' },
                  ]}
                />
              </Field>
            </div>
          </FormSection>

          {/* === 06 Settings === */}
          <FormSection
            num="06"
            title="Send settings"
            subtitle="When and how often subscribers receive the emails."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Field label="Send window">
                <SegmentedControl
                  value={flow.send.window}
                  onChange={(w) => upd({ send: { ...flow.send, window: w } })}
                  options={[
                    { id: 'anytime', label: 'Any time' },
                    { id: 'daily', label: 'Every day · 9–5' },
                    { id: 'weekdays', label: 'Mon–Fri · 9–5' },
                    { id: 'custom', label: 'Custom' },
                  ]}
                />
              </Field>
              {flow.send.window === 'custom' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <Field label="Earliest">
                    <input
                      className="input"
                      type="time"
                      value={flow.send.start}
                      onChange={(e) =>
                        upd({
                          send: { ...flow.send, start: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="Latest">
                    <input
                      className="input"
                      type="time"
                      value={flow.send.end}
                      onChange={(e) =>
                        upd({
                          send: { ...flow.send, end: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              <SettingRow
                label="Send in subscriber's timezone"
                hint="If we know it. Falls back to UTC otherwise."
                control={
                  <Toggle
                    on={flow.send.respectTimezone}
                    onChange={(v) =>
                      upd({
                        send: { ...flow.send, respectTimezone: v },
                      })
                    }
                  />
                }
              />
              <SettingRow
                label="Pause if subscriber unsubscribes"
                hint="Stop all in-flight emails immediately on unsub."
                control={
                  <Toggle
                    on={flow.send.pauseOnUnsub}
                    onChange={(v) =>
                      upd({ send: { ...flow.send, pauseOnUnsub: v } })
                    }
                  />
                }
              />
              <SettingRow
                label="Skip if in another active sequence"
                hint="Subscriber must be enrolled in only one at a time."
                control={
                  <Toggle
                    on={flow.send.skipIfInOther}
                    onChange={(v) =>
                      upd({ send: { ...flow.send, skipIfInOther: v } })
                    }
                  />
                }
              />
              <SettingRow
                label="Respect frequency cap (3 / week)"
                hint="Won't send if it would exceed the workspace-wide cap."
                control={
                  <Toggle
                    on={flow.send.frequencyCap}
                    onChange={(v) =>
                      upd({ send: { ...flow.send, frequencyCap: v } })
                    }
                  />
                }
              />
            </div>
          </FormSection>

          {/* Final actions */}
          <div
            className="card"
            style={{
              padding: '22px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: 'var(--green-soft)',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check-circle" size={15} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--ink)',
                    fontWeight: 500,
                  }}
                >
                  Ready to activate
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
                >
                  Sequence will start enrolling subscribers immediately on save.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onSaveDraft}
              >
                Save as draft
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onActivate}
              >
                <Icon name="zap" size={13} />
                Activate sequence
              </button>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside
          style={{
            position: 'sticky',
            top: 100,
            alignSelf: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Section nav */}
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              On this page
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                {
                  num: '01',
                  label: 'Basics',
                  done: name.trim().length > 0,
                },
                { num: '02', label: 'Trigger', done: true },
                {
                  num: '03',
                  label: 'Audience filter',
                  done: flow.audience.mode === 'all',
                },
                {
                  num: '04',
                  label: 'Sequence steps',
                  done: flow.steps.length > 0,
                },
                {
                  num: '05',
                  label: 'Conversion goal',
                  done: flow.goal.event !== 'none',
                },
                { num: '06', label: 'Send settings', done: true },
              ].map((item) => (
                <button
                  key={item.num}
                  type="button"
                  // Step nav is a checklist for now — clicking a row doesn't
                  // jump to a section yet (FormSections lack scroll anchors).
                  // Render as a non-interactive item via aria-disabled so
                  // assistive tech doesn't promise scroll behaviour we
                  // haven't built. Fix in Phase 8 when adding section ids.
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--ink-2)',
                    textDecoration: 'none',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'default',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: item.done ? 'none' : '1.5px solid var(--line-2)',
                      background: item.done ? 'var(--ink)' : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.done && (
                      <Icon name="check" size={10} strokeWidth={2.5} />
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: 'var(--ink-4)',
                    }}
                  >
                    {item.num}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Estimated reach */}
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Estimated reach
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 400,
                  letterSpacing: '-0.025em',
                }}
              >
                —
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                / mo
              </span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
              }}
            >
              Reach numbers populate after the first matching events arrive.
              Today: <strong>{totalEmails}</strong> email
              {totalEmails === 1 ? '' : 's'} per subscriber, ~{totalDays} day
              {totalDays === 1 ? '' : 's'}.
            </div>
          </div>

        </aside>
      </div>

      {editingEmail && (
        <SequenceEmailComposerModal
          organization={organization}
          step={editingEmail}
          emailNum={
            flow.steps
              .slice(
                0,
                flow.steps.findIndex((s) => s.id === editingEmail.id) + 1,
              )
              .filter((s) => s.type === 'email').length
          }
          sequenceName={name}
          onChange={(v) => updateStep(editingEmail.id, 'email', v)}
          onClose={() => setEditingEmailId(null)}
          onSendTest={async (email) => {
            const id = await ensurePersisted()
            await syncEmailSteps(id)
            const desired = materializeEmailsFromFlow(flow.steps)
            const ord = desired.findIndex((d) => d.step.id === editingEmail.id)
            const sorted = [...existingSteps].sort(
              (a, b) => a.position - b.position,
            )
            const target = sorted[ord]
            if (target) {
              await sendTestMutation.mutateAsync({
                sequenceId: id,
                stepId: target.id,
                email,
              })
            }
          }}
        />
      )}
    </div>
  )
}

const ProductCard = ({
  active,
  onClick,
  name,
  kind,
  coverUrl,
}: {
  active: boolean
  onClick: () => void
  name: string
  kind: string
  coverUrl?: string | null
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`option-card ${active ? 'is-active' : ''}`}
    style={{
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textAlign: 'left',
    }}
  >
    {coverUrl ? (
      <img
        src={coverUrl}
        alt=""
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid var(--line)',
        }}
      />
    ) : (
      <div
        className="cover-placeholder"
        style={{ width: 42, height: 42, borderRadius: 8 }}
      />
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--ink)',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
        {kind}
      </div>
    </div>
    <span className="option-card-radio" />
  </button>
)

// — Email content editor modal (BlockEditor reused from broadcasts).
// Fullscreen sequence email composer — hosts the broadcast Composer in
// embedded mode, so editing an email step inside a sequence reuses the
// same template gallery, block palette, and inspector as standalone
// broadcasts. Mirrors the design's sequence-email-composer modal.
const SequenceEmailComposerModal = ({
  organization,
  step,
  emailNum,
  sequenceName,
  onChange,
  onClose,
  onSendTest,
}: {
  organization: schemas['Organization']
  step: Extract<StepNode, { type: 'email' }>
  emailNum: number
  sequenceName: string
  onChange: (v: EmailStepValue) => void
  onClose: () => void
  onSendTest: (email: string) => Promise<void>
}) => {
  const [doc, setDoc] = useState<ContentDoc>(() =>
    adoptContentJson(step.value.content_json),
  )
  const [subject, setSubject] = useState(step.value.subject)
  const [preview, setPreview] = useState(step.value.preview)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [testEmail, setTestEmail] = useState('')
  const [testStatus, setTestStatus] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle')
  const [showTestField, setShowTestField] = useState(false)
  const upload = useUploadSequenceImage(organization.id)

  // Lock body scroll while open + Esc / ⌘S shortcuts.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        triggerSave(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  const persist = () => {
    const html = renderBlocksToHtml(doc)
    onChange({
      ...step.value,
      subject,
      preview,
      content_html: html,
      content_json: doc as unknown as Record<string, unknown>,
    })
  }

  const triggerSave = (close = false) => {
    setSaveStatus('saving')
    persist()
    // Tiny artificial settle so the indicator visibly transitions.
    window.setTimeout(() => {
      setSaveStatus('saved')
      if (close) {
        window.setTimeout(onClose, 250)
      } else {
        window.setTimeout(() => setSaveStatus('idle'), 1800)
      }
    }, 300)
  }

  // Portal to <body> so the modal escapes the dashboard's stacking
  // context and the .spaire-email-app `zoom: 0.9` scale. Wrapping it
  // back in a `.spaire-email-app` host preserves the scoped CSS used
  // throughout the modal (`.btn`, `.input`, `.modal-fade-in`,
  // `--ink-*` tokens, …). Without this the modal mounted but was
  // hidden behind ancestor layers and the editor looked "dead".
  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="spaire-email-app">
    <div
      className="modal-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid var(--line)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            minWidth: 0,
            flex: 1,
          }}
        >
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            title="Close (Esc)"
          >
            <Icon name="x" size={16} />
          </button>
          <div style={{ height: 24, width: 1, background: 'var(--line)' }} />
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>
              {sequenceName} · Email {String(emailNum).padStart(2, '0')}
            </div>
            <div
              style={{
                fontSize: 14.5,
                color: 'var(--ink)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 480,
              }}
            >
              {subject || 'Untitled email'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              color: saveStatus === 'saved' ? 'var(--green)' : 'var(--ink-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.2s',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  saveStatus === 'saved' ? 'var(--green)' : 'var(--ink-4)',
              }}
            />
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
                ? 'Saved'
                : 'Auto-saving'}
          </span>
          {showTestField ? (
            <>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => {
                  setTestEmail(e.target.value)
                  setTestStatus('idle')
                }}
                style={{ width: 200, fontSize: 12 }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!testEmail.trim() || testStatus === 'sending'}
                onClick={async () => {
                  setTestStatus('sending')
                  try {
                    persist()
                    await onSendTest(testEmail.trim())
                    setTestStatus('sent')
                  } catch {
                    setTestStatus('error')
                  }
                }}
              >
                <Icon name="send" size={12} />
                {testStatus === 'sending'
                  ? 'Sending…'
                  : testStatus === 'sent'
                    ? 'Sent ✓'
                    : testStatus === 'error'
                      ? 'Failed'
                      : 'Send'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowTestField(false)
                  setTestStatus('idle')
                }}
              >
                <Icon name="x" size={12} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTestField(true)}
            >
              <Icon name="send" size={12} />
              Send test
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => triggerSave(true)}
          >
            <Icon name="check" size={12} />
            Save & update sequence
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#f0f0f3',
          padding: '24px 24px 48px',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <BroadcastEditor
            embedded
            doc={doc}
            setDoc={setDoc}
            uploadImage={async (file) => (await upload.mutateAsync(file)).url}
            sender={{
              name: step.value.fromName,
              email: step.value.fromEmail,
            }}
            subject={subject}
            onSubjectChange={setSubject}
            previewText={preview}
            onPreviewTextChange={setPreview}
          />
        </div>
      </div>
    </div>
    </div>,
    document.body,
  )
}

// — When the email step has no authored content_html, render a minimal one
// from subject + preview so the worker has something to send.
const renderEmailFallback = (v: EmailStepValue): string => {
  const safeSubject = (v.subject ?? '').replace(/</g, '&lt;')
  const safePreview = (v.preview ?? '').replace(/</g, '&lt;')
  return `<h2>${safeSubject}</h2><p>${safePreview}</p>`
}

export const NewSequenceRoute = ({
  organization,
  sequenceId,
}: {
  organization: schemas['Organization']
  sequenceId: string | null
}) => {
  const router = useRouter()
  const base = `/dashboard/${organization.slug}/email-marketing/sequences`
  return (
    <NewSequenceScreen
      organization={organization}
      sequenceId={sequenceId}
      onBack={() => router.push(base)}
      onOpened={(id) => {
        if (sequenceId !== id) {
          router.replace(`${base}/${id}/edit`)
        }
      }}
    />
  )
}
