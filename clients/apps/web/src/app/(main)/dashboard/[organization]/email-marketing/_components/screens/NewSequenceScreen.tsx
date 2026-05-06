import {
  SequenceStepAnalyticsRow,
  useCreateEmailSequence,
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useEmailSequence,
  useEmailSubscribers,
  useEnrollSubscriber,
  useReorderSequenceSteps,
  useSendTestSequenceStep,
  useSequenceAnalytics,
  useSequenceEnrollments,
  useSequenceStepAnalytics,
  useSequenceSteps,
  useUnenrollSubscriber,
  useUpdateEmailSequence,
  useUpdateSequenceStep,
  useUploadSequenceImage,
} from '@/hooks/queries/emailMarketing'
import { useProducts } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BlockEditor } from '../blockEditor/BlockEditor'
import { renderBlocksToHtml } from '../blockEditor/render'
import { Block, ContentDoc, isContentDoc, newId } from '../blockEditor/types'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Toggle } from '../shared'

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
}[] = [
  {
    id: 'on_subscribe',
    label: 'On subscribe',
    desc: 'When someone joins your list',
    icon: 'user',
  },
  {
    id: 'on_purchase',
    label: 'On purchase',
    desc: 'When someone buys a product',
    icon: 'shopping-cart',
  },
  {
    id: 'on_subscription_created',
    label: 'Subscription started',
    desc: 'When a subscription begins',
    icon: 'rotate',
  },
  {
    id: 'on_subscription_cancelled',
    label: 'Subscription cancelled',
    desc: 'When a subscription ends',
    icon: 'x-circle',
  },
  {
    id: 'on_form_submit',
    label: 'Form submitted',
    desc: 'When a subscriber submits a form',
    icon: 'tag',
  },
  {
    id: 'manual',
    label: 'Manual',
    desc: 'Enroll via API or dashboard',
    icon: 'mouse-pointer',
  },
]

type Sequence = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  status: 'draft' | 'active' | 'paused'
}

type SendWindow = {
  enabled: boolean
  days: number[]
  start_hour: number
  end_hour: number
}

type Step = {
  id: string
  sequence_id: string
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
    { id: newId(), type: 'heading', level: 2, text: 'Heading' } as Block,
    {
      id: newId(),
      type: 'paragraph',
      text: 'Write your email here.',
    } as Block,
  ],
})

const adoptContentJson = (raw: unknown): ContentDoc => {
  if (isContentDoc(raw)) {
    return {
      version: 1,
      blocks: raw.blocks.map((b) =>
        'id' in b && b.id ? b : ({ ...b, id: newId() } as Block),
      ),
    }
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
      existing={(sequenceQuery.data as Sequence | undefined) ?? null}
      existingSteps={(stepsQuery.data as Step[] | undefined) ?? []}
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
  existing: Sequence | null
  existingSteps: Step[]
}) => {
  const [name, setName] = useState<string>(
    () => existing?.name ?? 'Untitled sequence',
  )
  const [description, setDescription] = useState<string>(
    () => existing?.description ?? '',
  )
  const [trigger, setTrigger] = useState<TriggerId>(
    () => (existing?.trigger_type as TriggerId | undefined) ?? 'manual',
  )
  // Settings live in trigger_config so they round-trip through the existing
  // PATCH endpoint without a schema change. Phase 4 will move them to typed
  // columns once we know which behaviours we actually keep.
  const initialConfig = (existing?.trigger_config ?? {}) as Record<
    string,
    unknown
  >
  const [skipIfInAnother, setSkipIfInAnother] = useState<boolean>(() =>
    Boolean(initialConfig.skip_if_in_another ?? true),
  )
  const [pauseOnUnsub, setPauseOnUnsub] = useState<boolean>(() =>
    Boolean(initialConfig.pause_on_unsubscribe ?? true),
  )
  const [productId, setProductId] = useState<string | null>(() =>
    typeof initialConfig.product_id === 'string'
      ? (initialConfig.product_id as string)
      : null,
  )
  // Goal completion: when the customer hits the goal event, we mark active
  // enrolments complete and stop sending. First-class goal type for now is
  // "buying a specific product" — backend keys the goal_event by type +
  // matching selectors. trial→paid is the headline use case.
  const initialGoal = (initialConfig.goal_event ?? {}) as Record<
    string,
    unknown
  >
  const [goalProductId, setGoalProductId] = useState<string | null>(() =>
    initialGoal.type === 'product_purchase' &&
    typeof initialGoal.product_id === 'string'
      ? (initialGoal.product_id as string)
      : null,
  )
  const initialWindow = (initialConfig.send_window ?? {}) as Record<
    string,
    unknown
  >
  const [sendWindow, setSendWindow] = useState<SendWindow>(() => ({
    enabled: Boolean(initialWindow.enabled ?? false),
    days: Array.isArray(initialWindow.days)
      ? (initialWindow.days as number[]).filter(
          (d) => Number.isInteger(d) && d >= 0 && d <= 6,
        )
      : [0, 1, 2, 3, 4],
    start_hour:
      typeof initialWindow.start_hour === 'number'
        ? (initialWindow.start_hour as number)
        : 9,
    end_hour:
      typeof initialWindow.end_hour === 'number'
        ? (initialWindow.end_hour as number)
        : 17,
  }))
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  // Track the persisted id locally so a fresh editor can create-on-demand and
  // route subsequent edits to the new row without unmounting/remounting.
  const persistedIdRef = useRef<string | null>(sequenceId)

  const createSequence = useCreateEmailSequence(organization.id)
  const updateSequence = useUpdateEmailSequence()

  const persistedId = persistedIdRef.current

  const buildTriggerConfig = (): Record<string, unknown> => {
    const cfg: Record<string, unknown> = {
      ...initialConfig,
      skip_if_in_another: skipIfInAnother,
      pause_on_unsubscribe: pauseOnUnsub,
      send_window: sendWindow,
    }
    // product_id is only meaningful for purchase-style triggers; clear it on
    // other triggers so a stale filter never leaks into matching.
    if (
      productId &&
      (trigger === 'on_purchase' || trigger === 'on_subscription_created')
    ) {
      cfg.product_id = productId
    } else {
      delete cfg.product_id
    }
    if (goalProductId) {
      cfg.goal_event = {
        type: 'product_purchase',
        product_id: goalProductId,
      }
    } else {
      delete cfg.goal_event
    }
    return cfg
  }

  // Materialize the persisted id on first save. The trigger picker, the
  // step buttons, and the activate button all need a real row to point at.
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

  const onSaveDraft = async () => {
    const id = await ensurePersisted()
    await updateSequence.mutateAsync({
      sequenceId: id,
      name,
      description,
      trigger_type: trigger,
      trigger_config: buildTriggerConfig(),
    })
    setSavedAt(new Date())
  }

  const onActivate = async () => {
    if (existingSteps.length === 0) {
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
    onBack()
  }

  const onPause = async () => {
    if (!persistedId) return
    await updateSequence.mutateAsync({
      sequenceId: persistedId,
      status: 'paused',
    })
  }

  // ── step mutations are scoped to the persisted id; for a brand-new editor,
  // creating the first step requires materializing the sequence first.
  const createStep = useCreateSequenceStep(persistedId ?? '')
  const updateStep = useUpdateSequenceStep(persistedId ?? '')
  const deleteStep = useDeleteSequenceStep(persistedId ?? '')
  const reorderSteps = useReorderSequenceSteps(persistedId ?? '')

  const onAddEmail = async () => {
    const id = await ensurePersisted()
    const created = await createStep.mutateAsync({
      delay_hours: existingSteps.length === 0 ? 0 : 24,
      subject: 'New email',
      sender_name: organization.name,
      content_html: '',
    })
    setEditingStepId(created.id)
    if (id !== persistedId) {
      // first save bound the editor to a new id; refetches will surface the step
    }
  }

  const onMoveStep = async (index: number, direction: -1 | 1) => {
    const next = [...existingSteps].sort((a, b) => a.position - b.position)
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    await reorderSteps.mutateAsync(
      next.map((s, i) => ({ id: s.id, position: i })),
    )
  }

  const onDeleteStep = async (id: string) => {
    if (!window.confirm('Remove this email from the sequence?')) return
    await deleteStep.mutateAsync(id)
  }

  const editingStep = existingSteps.find((s) => s.id === editingStepId) ?? null

  const isActive = existing?.status === 'active'
  // Per-step analytics keyed by step id; only meaningful once the sequence has
  // sent at least one email, but we fetch unconditionally so the chips appear
  // immediately when activity arrives.
  const stepAnalyticsQuery = useSequenceStepAnalytics(persistedId ?? '')
  const stepAnalyticsById = useMemo(() => {
    const m = new Map<string, SequenceStepAnalyticsRow>()
    for (const row of stepAnalyticsQuery.data ?? []) m.set(row.step_id, row)
    return m
  }, [stepAnalyticsQuery.data])

  const sendTest = useSendTestSequenceStep()
  const onSendTestStep = async (stepId: string, email: string) => {
    if (!persistedId) return
    await sendTest.mutateAsync({ sequenceId: persistedId, stepId, email })
  }

  const sortedSteps = [...existingSteps].sort((a, b) => a.position - b.position)
  const totalDays = Math.ceil(
    sortedSteps.reduce((acc, s) => acc + (s.delay_hours ?? 0), 0) / 24,
  )

  const triggerObj =
    TRIGGERS.find((t) => t.id === trigger) ?? TRIGGERS[TRIGGERS.length - 1]

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 36,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            className="btn-icon"
            onClick={onBack}
            aria-label="Back"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <div>
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
                width: 600,
                color: 'var(--ink)',
              }}
            />
            {savedAt && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Saved {savedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
          {isActive ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onPause}
            >
              <Icon name="x-circle" size={13} />
              Pause
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onActivate}
              disabled={existingSteps.length === 0}
              style={{ opacity: existingSteps.length === 0 ? 0.5 : 1 }}
            >
              <Icon name="play" size={13} />
              Activate
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: persistedId
            ? 'minmax(0, 1fr) 320px'
            : 'minmax(0, 1fr)',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            minWidth: 0,
          }}
        >
          <div className="card" style={{ padding: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 22,
              }}
            >
              <div>
                <div className="eyebrow">Step 0 · Trigger</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    marginTop: 8,
                    color: 'var(--ink)',
                  }}
                >
                  When this happens…
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--indigo-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name="zap"
                  size={16}
                  style={{ color: 'var(--indigo-2)' }}
                />
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {TRIGGERS.map((t) => {
                const active = trigger === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrigger(t.id)}
                    className="card"
                    style={{
                      padding: '16px 14px',
                      textAlign: 'left',
                      borderColor: active ? 'var(--ink)' : 'var(--line)',
                      borderWidth: active ? 2 : 1,
                      background: active ? 'var(--ink)' : '#fff',
                      boxShadow: active
                        ? '0 6px 18px -10px rgba(0,0,0,0.25)'
                        : 'none',
                      transition: 'all 0.15s',
                      margin: active ? 0 : 1,
                    }}
                  >
                    <Icon
                      name={t.icon}
                      size={14}
                      style={{
                        color: active ? '#fff' : 'var(--ink-3)',
                        marginBottom: 10,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 400,
                        color: active ? '#fff' : 'var(--ink)',
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: active
                          ? 'rgba(255,255,255,0.7)'
                          : 'var(--ink-3)',
                        marginTop: 3,
                        lineHeight: 1.45,
                      }}
                    >
                      {t.desc}
                    </div>
                  </button>
                )
              })}
            </div>

            {(trigger === 'on_purchase' ||
              trigger === 'on_subscription_created') && (
              <TriggerProductPicker
                organization={organization}
                productId={productId}
                onChange={setProductId}
              />
            )}
          </div>

          <div
            className="card"
            style={{
              padding: '36px 32px 28px',
              position: 'relative',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 28,
              }}
            >
              <div className="eyebrow">Sequence flow</div>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {sortedSteps.length} email{sortedSteps.length === 1 ? '' : 's'}{' '}
                · {totalDays} day{totalDays === 1 ? '' : 's'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }}
            >
              <TriggerNode
                label={triggerObj.label}
                desc={triggerObj.desc}
                icon={triggerObj.icon}
              />

              {sortedSteps.length === 0 ? (
                <>
                  <Connector />
                  <div
                    style={{
                      border: '1.5px dashed var(--line-2)',
                      borderRadius: 14,
                      padding: '28px 24px',
                      color: 'var(--ink-3)',
                      fontSize: 13,
                      width: '100%',
                      maxWidth: 540,
                      textAlign: 'center',
                    }}
                  >
                    No emails yet — add your first one below.
                  </div>
                </>
              ) : (
                sortedSteps.map((step, i) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'contents',
                    }}
                  >
                    {i === 0 ? (
                      <Connector />
                    ) : (
                      <WaitConnector
                        delay={
                          step.delay_hours >= 24
                            ? `${Math.round(step.delay_hours / 24)} day${Math.round(step.delay_hours / 24) === 1 ? '' : 's'}`
                            : `${step.delay_hours}h`
                        }
                      />
                    )}
                    <EmailNode
                      num={String(i + 1).padStart(2, '0')}
                      title={step.subject}
                      preview={previewFromHtml(step.content_html)}
                      delay={i === 0 ? 'Immediately' : `+${step.delay_hours}h`}
                      analytics={stepAnalyticsById.get(step.id) ?? null}
                      canMoveUp={i > 0}
                      canMoveDown={i < sortedSteps.length - 1}
                      onClick={() => setEditingStepId(step.id)}
                      onMoveUp={() => onMoveStep(i, -1)}
                      onMoveDown={() => onMoveStep(i, 1)}
                      onDelete={() => onDeleteStep(step.id)}
                    />
                  </div>
                ))
              )}

              <Connector long />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 4,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'var(--ink)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.15)',
                  }}
                >
                  <Icon name="check" size={20} strokeWidth={2} />
                </div>
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <div style={{ fontSize: 16, color: 'var(--ink)' }}>
                    End of sequence
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-3)',
                      marginTop: 4,
                    }}
                  >
                    Subscriber exits and can be enrolled in others.
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                marginTop: 32,
                paddingTop: 24,
                borderTop: '1px solid var(--line)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onAddEmail}
                disabled={createStep.isPending || createSequence.isPending}
              >
                <Icon name="plus" size={12} />
                Add email
              </button>
            </div>
          </div>

          {persistedId && (
            <EnrollmentsPanel
              organization={organization}
              sequenceId={persistedId}
            />
          )}
        </div>

        {persistedId && (
          <SequenceSidebar
            organization={organization}
            sequenceId={persistedId}
            isActive={isActive}
            description={description}
            onDescriptionChange={setDescription}
            skipIfInAnother={skipIfInAnother}
            onSkipChange={setSkipIfInAnother}
            pauseOnUnsub={pauseOnUnsub}
            onPauseOnUnsubChange={setPauseOnUnsub}
            sendWindow={sendWindow}
            onSendWindowChange={setSendWindow}
            goalProductId={goalProductId}
            onGoalProductChange={setGoalProductId}
            steps={sortedSteps}
            stepAnalyticsById={stepAnalyticsById}
          />
        )}
      </div>

      {editingStep && persistedIdRef.current && (
        <StepEditor
          organization={organization}
          step={editingStep}
          onClose={() => setEditingStepId(null)}
          onSave={async (patch) => {
            await updateStep.mutateAsync({
              stepId: editingStep.id,
              ...patch,
            })
          }}
          onSendTest={(email) => onSendTestStep(editingStep.id, email)}
        />
      )}
    </div>
  )
}

const previewFromHtml = (html: string | null | undefined): string => {
  if (!html) return 'No content yet.'
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 140
    ? `${text.slice(0, 137)}…`
    : text || 'No content yet.'
}

// ── Step Editor Modal ──

const StepEditor = ({
  organization,
  step,
  onClose,
  onSave,
  onSendTest,
}: {
  organization: schemas['Organization']
  step: Step
  onClose: () => void
  onSave: (patch: {
    subject?: string
    sender_name?: string
    delay_hours?: number
    content_html?: string
  }) => Promise<void>
  onSendTest: (email: string) => Promise<void>
}) => {
  const [subject, setSubject] = useState(step.subject)
  const [senderName, setSenderName] = useState(step.sender_name)
  const [delayHours, setDelayHours] = useState(step.delay_hours)
  const [doc, setDoc] = useState<ContentDoc>(() =>
    adoptContentJson(step.content_json),
  )
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testStatus, setTestStatus] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle')
  const upload = useUploadSequenceImage(organization.id)

  // Reset local edits when the targeted step changes.
  useEffect(() => {
    setSubject(step.subject)
    setSenderName(step.sender_name)
    setDelayHours(step.delay_hours)
    setDoc(adoptContentJson(step.content_json))
  }, [
    step.id,
    step.subject,
    step.sender_name,
    step.delay_hours,
    step.content_json,
  ])

  const handleSave = async () => {
    setSaving(true)
    try {
      const html = renderBlocksToHtml(doc)
      await onSave({
        subject,
        sender_name: senderName,
        delay_hours: delayHours,
        content_html: html,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit email" width={780}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Field label="Subject">
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field label="Sender name">
          <input
            className="input"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
          />
        </Field>
        <Field label="Wait (hours)">
          <input
            className="input"
            type="number"
            min={0}
            value={delayHours}
            onChange={(e) =>
              setDelayHours(Math.max(0, Number(e.target.value) || 0))
            }
          />
        </Field>
      </div>

      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          maxHeight: '50vh',
          overflowY: 'auto',
        }}
      >
        <BlockEditor
          doc={doc}
          setDoc={setDoc}
          uploadImage={async (file) => (await upload.mutateAsync(file)).url}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          paddingTop: 12,
          borderTop: '1px solid var(--line)',
          marginTop: 4,
        }}
      >
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={testEmail}
          onChange={(e) => {
            setTestEmail(e.target.value)
            setTestStatus('idle')
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!testEmail.trim() || testStatus === 'sending'}
          onClick={async () => {
            setTestStatus('sending')
            try {
              // Persist current edits first so the test reflects what's on screen.
              const html = renderBlocksToHtml(doc)
              await onSave({
                subject,
                sender_name: senderName,
                delay_hours: delayHours,
                content_html: html,
              })
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
                : 'Send test'}
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <label
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontSize: 12,
      color: 'var(--ink-3)',
    }}
  >
    <span>{label}</span>
    {children}
  </label>
)

// ── Right rail: settings + live analytics ──

const SequenceSidebar = ({
  organization,
  sequenceId,
  isActive,
  description,
  onDescriptionChange,
  skipIfInAnother,
  onSkipChange,
  pauseOnUnsub,
  onPauseOnUnsubChange,
  sendWindow,
  onSendWindowChange,
  goalProductId,
  onGoalProductChange,
  steps,
  stepAnalyticsById,
}: {
  organization: schemas['Organization']
  sequenceId: string
  isActive: boolean
  description: string
  onDescriptionChange: (v: string) => void
  skipIfInAnother: boolean
  onSkipChange: (v: boolean) => void
  pauseOnUnsub: boolean
  onPauseOnUnsubChange: (v: boolean) => void
  sendWindow: SendWindow
  onSendWindowChange: (v: SendWindow) => void
  goalProductId: string | null
  onGoalProductChange: (id: string | null) => void
  steps: Step[]
  stepAnalyticsById: Map<string, SequenceStepAnalyticsRow>
}) => {
  const analyticsQuery = useSequenceAnalytics(sequenceId)
  const a = analyticsQuery.data as SequenceAnalytics | undefined

  return (
    <div
      style={{
        position: 'sticky',
        top: 32,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Settings
        </div>
        <Field label="Description">
          <textarea
            className="input"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
            placeholder="What this sequence is for…"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>
        <div style={{ marginTop: 14 }}>
          <Field label="Goal — stop when subscriber buys">
            <GoalProductSelect
              organization={organization}
              value={goalProductId}
              onChange={onGoalProductChange}
            />
          </Field>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: 13.5,
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>Skip if in another</span>
            <Toggle on={skipIfInAnother} onChange={onSkipChange} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>Pause on unsubscribe</span>
            <Toggle on={pauseOnUnsub} onChange={onPauseOnUnsubChange} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--ink-2)' }}>Send window</span>
            <Toggle
              on={sendWindow.enabled}
              onChange={(enabled) =>
                onSendWindowChange({ ...sendWindow, enabled })
              }
            />
          </div>
          {sendWindow.enabled && (
            <SendWindowControls
              value={sendWindow}
              onChange={onSendWindowChange}
            />
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14 }}>
          Settings save with the sequence — hit Save draft after toggling.
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Live performance
        </div>
        {!a ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {analyticsQuery.isLoading ? 'Loading…' : 'No data yet.'}
          </div>
        ) : a.total_sent === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {isActive
              ? 'Waiting for the first send.'
              : 'Activate the sequence to start collecting data.'}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 400,
                  letterSpacing: '-0.025em',
                }}
              >
                {a.open_rate.toFixed(1)}%
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                open rate
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                fontSize: 12.5,
              }}
            >
              <SidebarStat label="Sent" value={a.total_sent.toLocaleString()} />
              <SidebarStat
                label="Delivered"
                value={a.delivered.toLocaleString()}
              />
              <SidebarStat
                label="Click rate"
                value={`${a.click_rate.toFixed(1)}%`}
              />
              <SidebarStat label="Bounced" value={a.bounced.toLocaleString()} />
              <SidebarStat
                label="Active enrolled"
                value={a.active_enrollments.toLocaleString()}
              />
              <SidebarStat
                label="Completed"
                value={a.completed_enrollments.toLocaleString()}
              />
            </div>
          </>
        )}
      </div>

      <SuggestionsCard steps={steps} stepAnalyticsById={stepAnalyticsById} />
    </div>
  )
}

type SequenceAnalytics = {
  total_sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  open_rate: number
  click_rate: number
  total_enrolled: number
  active_enrollments: number
  completed_enrollments: number
}

const SidebarStat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
      {value}
    </div>
  </div>
)

// ── Enrollments panel ──

type Enrollment = {
  id: string
  sequence_id: string
  subscriber_id: string
  status: string
  current_step_position: number
  enrolled_at: string
  next_step_at: string | null
  completed_at: string | null
}

const EnrollmentsPanel = ({
  organization,
  sequenceId,
}: {
  organization: schemas['Organization']
  sequenceId: string
}) => {
  const [expanded, setExpanded] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const enrollmentsQuery = useSequenceEnrollments(sequenceId)
  // Pull a generous slice of subscribers so we can join on id without a
  // round-trip per row. The picker reuses the same set so manual enrollment
  // is one search box rather than a full subscriber browser.
  const subscribersQuery = useEmailSubscribers(organization.id, {
    limit: 500,
  })
  const enroll = useEnrollSubscriber(sequenceId)
  const unenroll = useUnenrollSubscriber(sequenceId)
  const enrollments = (enrollmentsQuery.data as Enrollment[] | undefined) ?? []
  const byId = useMemo(() => {
    const m = new Map<string, schemas['EmailSubscriber']>()
    for (const s of subscribersQuery.data?.items ?? []) {
      m.set(s.id, s as schemas['EmailSubscriber'])
    }
    return m
  }, [subscribersQuery.data])
  const enrolledIds = useMemo(
    () => new Set(enrollments.map((e) => e.subscriber_id)),
    [enrollments],
  )
  const candidates = useMemo(() => {
    const all = subscribersQuery.data?.items ?? []
    const q = pickerQ.trim().toLowerCase()
    const filtered = all.filter((s) => {
      if (enrolledIds.has(s.id)) return false
      if (s.status !== 'active') return false
      if (!q) return true
      return (
        s.email.toLowerCase().includes(q) ||
        (s.name?.toLowerCase().includes(q) ?? false)
      )
    })
    return filtered.slice(0, 6)
  }, [subscribersQuery.data, pickerQ, enrolledIds])

  const visible = expanded ? enrollments : enrollments.slice(0, 8)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom:
            enrollments.length > 0 ? '1px solid var(--line)' : 'none',
        }}
      >
        <div>
          <div className="eyebrow">Enrollments</div>
          <div style={{ fontSize: 14, marginTop: 6, color: 'var(--ink)' }}>
            {enrollmentsQuery.isLoading
              ? 'Loading…'
              : `${enrollments.length} subscriber${enrollments.length === 1 ? '' : 's'} in this sequence`}
          </div>
        </div>
        <div
          style={{ position: 'relative', minWidth: 280 }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setPickerOpen(false)
            }
          }}
        >
          <input
            className="input"
            placeholder="Add subscriber by email…"
            value={pickerQ}
            onChange={(e) => {
              setPickerQ(e.target.value)
              setPickerOpen(true)
            }}
            onFocus={() => setPickerOpen(true)}
            style={{ width: '100%' }}
          />
          {pickerOpen && candidates.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-lg)',
                padding: 6,
                zIndex: 30,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {candidates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={async () => {
                    await enroll.mutateAsync(s.id)
                    setPickerQ('')
                    setPickerOpen(false)
                  }}
                  disabled={enroll.isPending}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'transparent',
                    cursor: enroll.isPending ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-softer)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                    {s.email}
                  </div>
                  {s.name && (
                    <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {s.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {enrollments.length === 0 && !enrollmentsQuery.isLoading ? (
        <div
          style={{
            padding: '32px 24px',
            textAlign: 'center',
            color: 'var(--ink-3)',
            fontSize: 13,
          }}
        >
          No enrollments yet. Active sequences enrol subscribers automatically
          when their trigger fires; manual sequences enrol via the API.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) 100px 90px 130px 130px 36px',
              gap: 16,
              padding: '12px 24px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div>Subscriber</div>
            <div>Status</div>
            <div>Step</div>
            <div>Enrolled</div>
            <div>Next send</div>
            <div />
          </div>
          {visible.map((e) => {
            const sub = byId.get(e.subscriber_id)
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(0, 2fr) 100px 90px 130px 130px 36px',
                  gap: 16,
                  padding: '14px 24px',
                  fontSize: 13,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--ink)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {sub?.email ?? e.subscriber_id.slice(0, 8) + '…'}
                  </div>
                  {sub?.name && (
                    <div
                      style={{
                        color: 'var(--ink-3)',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sub.name}
                    </div>
                  )}
                </div>
                <div>
                  <EnrollmentStatusChip status={e.status} />
                </div>
                <div style={{ color: 'var(--ink-2)' }}>
                  #{e.current_step_position + 1}
                </div>
                <div style={{ color: 'var(--ink-3)' }}>
                  {formatRelative(e.enrolled_at)}
                </div>
                <div style={{ color: 'var(--ink-3)' }}>
                  {e.completed_at
                    ? '—'
                    : e.next_step_at
                      ? formatRelative(e.next_step_at)
                      : 'Done'}
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    color: 'var(--ink-3)',
                  }}
                  title="Unenroll"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        'Remove this subscriber from the sequence?',
                      )
                    )
                      return
                    await unenroll.mutateAsync(e.subscriber_id)
                  }}
                >
                  <Icon name="x-circle" size={14} />
                </button>
              </div>
            )
          })}
          {enrollments.length > 8 && (
            <div
              style={{
                padding: '14px 24px',
                textAlign: 'center',
                fontSize: 12.5,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show fewer' : `Show all ${enrollments.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const EnrollmentStatusChip = ({ status }: { status: string }) => {
  const tone =
    status === 'active'
      ? 'chip-success'
      : status === 'completed'
        ? 'chip-info'
        : ''
  return (
    <span className={`chip ${tone}`}>
      {status === 'active' && <span className="dot" />}
      {status}
    </span>
  )
}

const formatRelative = (iso: string): string => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const diff = t - Date.now()
  const future = diff > 0
  const abs = Math.abs(diff)
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  if (abs < hr) {
    const m = Math.max(1, Math.round(abs / min))
    return future ? `in ${m}m` : `${m}m ago`
  }
  if (abs < day) {
    const h = Math.round(abs / hr)
    return future ? `in ${h}h` : `${h}h ago`
  }
  const d = Math.round(abs / day)
  return future ? `in ${d}d` : `${d}d ago`
}

// ── Goal product select (Settings card) ──

const GoalProductSelect = ({
  organization,
  value,
  onChange,
}: {
  organization: schemas['Organization']
  value: string | null
  onChange: (id: string | null) => void
}) => {
  const productsQuery = useProducts(organization.id, { limit: 100 })
  const products = productsQuery.data?.items ?? []
  return (
    <select
      className="input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      style={{ width: '100%' }}
    >
      <option value="">No goal — sequence runs to completion</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

// ── Spaire suggests (heuristic-driven) ──

type Suggestion = {
  id: string
  tone: 'warn' | 'info' | 'praise'
  text: string
}

const buildSuggestions = (
  steps: Step[],
  byId: Map<string, SequenceStepAnalyticsRow>,
): Suggestion[] => {
  const out: Suggestion[] = []
  if (steps.length === 0) return out

  // Welcome cadence: a step 0 with delay > 0 means new subscribers wait
  // for their first message. We've seen open rate drop sharply when the
  // first email lands more than an hour after the trigger.
  const first = steps[0]
  if (first.delay_hours > 1) {
    out.push({
      id: 'welcome-delay',
      tone: 'warn',
      text: `Step 1 waits ${first.delay_hours}h. The fastest welcomes ship within an hour — open rate drops 30–40% after a day's delay.`,
    })
  }

  // Long gaps between sends: subscribers cool off.
  const longGap = steps.find((s, i) => i > 0 && s.delay_hours >= 24 * 14)
  if (longGap) {
    out.push({
      id: 'long-gap',
      tone: 'warn',
      text: `Step ${steps.indexOf(longGap) + 1} waits ${Math.round(longGap.delay_hours / 24)} days. Anything over 14 days usually loses the thread — consider splitting it.`,
    })
  }

  // Worst-performing step (after enough volume).
  const ranked = steps
    .map((s) => ({ s, a: byId.get(s.id) }))
    .filter(
      (e): e is { s: Step; a: SequenceStepAnalyticsRow } =>
        !!e.a && e.a.delivered >= 20,
    )
    .sort((x, y) => x.a.open_rate - y.a.open_rate)
  if (ranked.length >= 2 && ranked[0].a.open_rate < 30) {
    out.push({
      id: 'low-open',
      tone: 'info',
      text: `Step ${steps.indexOf(ranked[0].s) + 1} ("${ranked[0].s.subject}") has the lowest open rate at ${ranked[0].a.open_rate.toFixed(1)}%. Try a punchier subject line or move it earlier.`,
    })
  }

  // Sequence shape: 1 step is rarely a "sequence".
  if (steps.length === 1) {
    out.push({
      id: 'too-short',
      tone: 'info',
      text: "Just one email — that's a broadcast. Add a follow-up at day 2 and a check-in at day 7 for the strongest welcome arc.",
    })
  }

  // Praise: long sequences with steady cadence.
  if (steps.length >= 5 && out.length === 0) {
    out.push({
      id: 'good-shape',
      tone: 'praise',
      text: `${steps.length} steps with a sane cadence — this is the kind of arc that converts. Watch the open rates after launch and tune the weakest step first.`,
    })
  }

  return out.slice(0, 3)
}

const SuggestionsCard = ({
  steps,
  stepAnalyticsById,
}: {
  steps: Step[]
  stepAnalyticsById: Map<string, SequenceStepAnalyticsRow>
}) => {
  const suggestions = useMemo(
    () => buildSuggestions(steps, stepAnalyticsById),
    [steps, stepAnalyticsById],
  )
  if (suggestions.length === 0) return null
  return (
    <div
      className="card"
      style={{
        padding: 22,
        background: 'var(--indigo-soft)',
        borderColor: 'var(--indigo-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--indigo)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px -2px rgba(79,70,229,0.4)',
          }}
        >
          <Icon name="sparkles" size={14} />
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>Spaire suggests</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suggestions.map((s) => (
          <div
            key={s.id}
            style={{
              fontSize: 12.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              paddingLeft: 18,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 5,
                width: 8,
                height: 8,
                borderRadius: 4,
                background:
                  s.tone === 'warn'
                    ? 'var(--red, #d6336c)'
                    : s.tone === 'praise'
                      ? 'var(--green, #1a7a3e)'
                      : 'var(--indigo-2)',
              }}
            />
            {s.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Trigger product picker ──

const TriggerProductPicker = ({
  organization,
  productId,
  onChange,
}: {
  organization: schemas['Organization']
  productId: string | null
  onChange: (id: string | null) => void
}) => {
  const productsQuery = useProducts(organization.id, { limit: 100 })
  const products = productsQuery.data?.items ?? []
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        padding: '12px 14px',
        background: 'var(--bg-soft)',
        borderRadius: 12,
      }}
    >
      <Icon name="package" size={14} style={{ color: 'var(--ink-3)' }} />
      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        Filter to product
      </span>
      <select
        className="input"
        value={productId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ marginLeft: 'auto', minWidth: 240 }}
      >
        <option value="">Any product</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Send-window controls ──

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const SendWindowControls = ({
  value,
  onChange,
}: {
  value: SendWindow
  onChange: (next: SendWindow) => void
}) => {
  const toggleDay = (day: number) => {
    const has = value.days.includes(day)
    const days = has
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b)
    onChange({ ...value, days })
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px',
        borderRadius: 10,
        background: 'var(--bg-soft)',
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {DAY_LABELS.map((label, i) => {
          const on = value.days.includes(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 11.5,
                fontWeight: 500,
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: on ? 'var(--ink)' : '#fff',
                color: on ? '#fff' : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
        }}
      >
        <select
          className="input"
          value={value.start_hour}
          onChange={(e) =>
            onChange({ ...value, start_hour: Number(e.target.value) })
          }
          style={{ flex: 1 }}
        >
          {Array.from({ length: 24 }).map((_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--ink-3)' }}>to</span>
        <select
          className="input"
          value={value.end_hour}
          onChange={(e) =>
            onChange({ ...value, end_hour: Number(e.target.value) })
          }
          style={{ flex: 1 }}
        >
          {Array.from({ length: 24 }).map((_, h) => (
            <option key={h + 1} value={h + 1}>
              {String(h + 1).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
        Sends outside this window are pushed to the next allowed slot. Hours in
        UTC.
      </div>
    </div>
  )
}

// ── Flow primitives (ported from the previous mock-only screen) ──

const TriggerNode = ({
  label,
  desc,
  icon,
}: {
  label: string
  desc: string
  icon: string
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 22px 14px 16px',
      background: 'var(--ink)',
      color: '#fff',
      borderRadius: 999,
      boxShadow: '0 4px 12px -4px rgba(0,0,0,0.2)',
      minWidth: 320,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={15} />
    </div>
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          opacity: 0.75,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        Trigger
      </div>
      <div style={{ fontSize: 15.5, marginTop: 1 }}>{label}</div>
    </div>
    <div
      style={{
        fontSize: 11.5,
        opacity: 0.85,
        maxWidth: 160,
        textAlign: 'right',
      }}
    >
      {desc}
    </div>
  </div>
)

const Connector = ({ long }: { long?: boolean }) => (
  <div
    style={{
      width: 2,
      height: long ? 36 : 24,
      background:
        'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
    }}
  />
)

const WaitConnector = ({ delay }: { delay: string }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      padding: 0,
    }}
  >
    <div
      style={{
        width: 2,
        height: 18,
        background:
          'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
      }}
    />
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: '#fff',
        border: '1px solid var(--indigo-line)',
        color: 'var(--indigo-2)',
        borderRadius: 999,
        fontSize: 11.5,
        boxShadow: '0 2px 6px rgba(79,70,229,0.08)',
      }}
    >
      <Icon name="clock" size={11} />
      Wait {delay}
    </div>
    <div
      style={{
        width: 2,
        height: 18,
        background:
          'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
      }}
    />
  </div>
)

const EmailNode = ({
  num,
  title,
  preview,
  delay,
  analytics,
  canMoveUp,
  canMoveDown,
  onClick,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  num: string
  title: string
  preview: string
  delay: string
  analytics: SequenceStepAnalyticsRow | null
  canMoveUp: boolean
  canMoveDown: boolean
  onClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        maxWidth: 540,
        background: '#fff',
        borderRadius: 14,
        border: `1px solid var(--line)`,
        boxShadow: hover
          ? '0 8px 22px -14px rgba(15,23,42,0.18)'
          : '0 1px 2px rgba(15,23,42,0.04)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div
          style={{
            width: 56,
            background: 'var(--bg-softer)',
            color: 'var(--ink-3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: '18px 0',
            gap: 6,
            borderRight: '1px solid var(--line)',
          }}
        >
          <Icon name="mail" size={16} />
          <div
            style={{
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              opacity: 0.7,
              letterSpacing: '0.05em',
            }}
          >
            {num}
          </div>
        </div>
        <div style={{ flex: 1, padding: '18px 22px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
                lineHeight: 1.25,
              }}
            >
              {title}
            </div>
            <span
              style={{
                fontSize: 10.5,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--bg-softer)',
                color: 'var(--ink-3)',
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {delay}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-3)',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </div>
          {analytics && analytics.sent > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 10,
                fontSize: 11.5,
                color: 'var(--ink-3)',
              }}
            >
              <span>
                <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                  {analytics.sent.toLocaleString()}
                </strong>{' '}
                sent
              </span>
              <span>
                <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                  {analytics.open_rate.toFixed(1)}%
                </strong>{' '}
                open
              </span>
              <span>
                <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                  {analytics.click_rate.toFixed(1)}%
                </strong>{' '}
                click
              </span>
            </div>
          )}
          {hover && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                <Icon name="edit" size={11} />
                Edit
              </button>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveUp()
                }}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  opacity: canMoveUp ? 1 : 0.4,
                }}
              >
                <Icon name="arrow-left" size={11} />
                Up
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveDown()
                }}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  opacity: canMoveDown ? 1 : 0.4,
                }}
              >
                <Icon name="arrow-right" size={11} />
                Down
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  color: 'var(--red)',
                }}
              >
                <Icon name="trash" size={11} />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
