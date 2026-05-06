import {
  useCreateEmailSequence,
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useEmailSequence,
  useReorderSequenceSteps,
  useSequenceSteps,
  useUpdateEmailSequence,
  useUpdateSequenceStep,
  useUploadSequenceImage,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useEffect, useRef, useState } from 'react'
import { BlockEditor } from '../blockEditor/BlockEditor'
import { renderBlocksToHtml } from '../blockEditor/render'
import { Block, ContentDoc, isContentDoc, newId } from '../blockEditor/types'
import { Icon } from '../Icon'
import { Modal } from '../Modal'

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
  const [trigger, setTrigger] = useState<TriggerId>(
    () => (existing?.trigger_type as TriggerId | undefined) ?? 'manual',
  )
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  // Track the persisted id locally so a fresh editor can create-on-demand and
  // route subsequent edits to the new row without unmounting/remounting.
  const persistedIdRef = useRef<string | null>(sequenceId)

  const createSequence = useCreateEmailSequence(organization.id)
  const updateSequence = useUpdateEmailSequence()

  const persistedId = persistedIdRef.current

  // Materialize the persisted id on first save. The trigger picker, the
  // step buttons, and the activate button all need a real row to point at.
  const ensurePersisted = async (): Promise<string> => {
    if (persistedIdRef.current) return persistedIdRef.current
    const created = await createSequence.mutateAsync({
      name,
      trigger_type: trigger,
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
      trigger_type: trigger,
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
      trigger_type: trigger,
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
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 24,
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
              <Icon name="zap" size={16} style={{ color: 'var(--indigo-2)' }} />
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
                      color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)',
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
              {sortedSteps.length} email{sortedSteps.length === 1 ? '' : 's'} ·{' '}
              {totalDays} day{totalDays === 1 ? '' : 's'}
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
}) => {
  const [subject, setSubject] = useState(step.subject)
  const [senderName, setSenderName] = useState(step.sender_name)
  const [delayHours, setDelayHours] = useState(step.delay_hours)
  const [doc, setDoc] = useState<ContentDoc>(() =>
    adoptContentJson(step.content_json),
  )
  const [saving, setSaving] = useState(false)
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
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
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
