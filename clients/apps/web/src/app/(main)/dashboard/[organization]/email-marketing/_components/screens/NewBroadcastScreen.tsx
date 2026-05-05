import { useAuth } from '@/hooks/auth'
import {
  BroadcastWritePayload,
  FilterRule,
  FilterRules,
  useCreateEmailBroadcast,
  useDeleteEmailBroadcastABTest,
  useEmailBroadcast,
  useEmailBroadcastABTest,
  useEmailSegments,
  useEmailSubscriberStats,
  useScheduleEmailBroadcast,
  useSegmentFilterPreview,
  useSendEmailBroadcast,
  useSendTestEmailBroadcast,
  useUpdateEmailBroadcast,
  useUpsertEmailBroadcastABTest,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useRef, useState } from 'react'
import { Icon } from '../Icon'
import { KV, Section, Toggle } from '../shared'

type Step = 'details' | 'content' | 'audience' | 'preview' | 'review'

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'details', label: 'Details', icon: 'mail' },
  { id: 'content', label: 'Content', icon: 'edit' },
  { id: 'audience', label: 'Audience', icon: 'users' },
  { id: 'preview', label: 'Preview', icon: 'eye' },
  { id: 'review', label: 'Review & send', icon: 'send' },
]

type Draft = {
  subject: string
  preview_text: string
  sender_name: string
  reply_to_email: string
  content_html: string
  segment_id: string | null
  filter_rules: FilterRules | null
}

type ABDraft = {
  subject_b: string
  slice_pct: number
  decide_after_minutes: number
  winner_metric: 'open_rate' | 'click_rate'
}

const blankAb = (): ABDraft => ({
  subject_b: '',
  slice_pct: 20,
  decide_after_minutes: 240,
  winner_metric: 'open_rate',
})

const blankDraft = (organization: schemas['Organization']): Draft => ({
  subject: '',
  preview_text: '',
  sender_name: organization.name,
  reply_to_email: '',
  content_html: '<p>Hi friends,</p>\n<p>Write your update here…</p>',
  segment_id: null,
  filter_rules: null,
})

// Next Tuesday at 08:42 in the user's local timezone — used as our Phase 3 stub
// for "optimal send time" until the real heuristic lands (Phase 4+).
const computeOptimalTime = () => {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(42)
  d.setHours(8)
  const day = d.getDay() // 0=Sun..6=Sat
  const daysToTuesday = (2 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysToTuesday)
  return d
}

const toLocalDateTimeInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type ExistingBroadcast = ReturnType<typeof useEmailBroadcast>['data']

const draftFromExisting = (
  existing: NonNullable<ExistingBroadcast>,
  organization: schemas['Organization'],
): Draft => ({
  subject: existing.subject ?? '',
  preview_text: (existing as { preview_text?: string }).preview_text ?? '',
  sender_name: existing.sender_name ?? organization.name,
  reply_to_email: existing.reply_to_email ?? '',
  content_html: existing.content_html ?? '',
  segment_id: existing.segment_id ?? null,
  filter_rules:
    (existing as { filter_rules?: FilterRules | null }).filter_rules ?? null,
})

export const NewBroadcastScreen = (props: {
  organization: schemas['Organization']
  broadcastId: string | null
  onBack: () => void
  onOpened?: (id: string) => void
}) => {
  const { broadcastId } = props
  const existingQuery = useEmailBroadcast(broadcastId ?? '')
  const abQuery = useEmailBroadcastABTest(broadcastId ?? '')

  // Wait for both fetches before mounting the editor so useState's lazy
  // initializer can synchronously seed from real data (no hydration effect
  // needed). React 19 compiler is happier with this split.
  if (broadcastId && (existingQuery.isLoading || abQuery.isLoading)) {
    return (
      <div
        className="card"
        style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}
      >
        Loading draft…
      </div>
    )
  }

  return (
    <ComposerInner
      {...props}
      existing={existingQuery.data ?? null}
      existingAb={abQuery.data?.config ?? null}
    />
  )
}

const ComposerInner = ({
  organization,
  broadcastId,
  onBack,
  onOpened,
  existing,
  existingAb,
}: {
  organization: schemas['Organization']
  broadcastId: string | null
  onBack: () => void
  onOpened?: (id: string) => void
  existing: NonNullable<ExistingBroadcast> | null
  existingAb: {
    subject_b: string
    slice_pct: number
    decide_after_minutes: number
    winner_metric: 'open_rate' | 'click_rate'
  } | null
}) => {
  const isNew = !broadcastId

  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? draftFromExisting(existing, organization)
      : blankDraft(organization),
  )
  const [step, setStep] = useState<Step>('details')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [abDraft, setAbDraft] = useState<ABDraft | null>(() =>
    existingAb
      ? {
          subject_b: existingAb.subject_b,
          slice_pct: existingAb.slice_pct,
          decide_after_minutes: existingAb.decide_after_minutes,
          winner_metric: existingAb.winner_metric,
        }
      : null,
  )
  // Track whether the inner has ever seen a server-side A/B config — drives
  // whether we issue DELETE on clearing the toggle.
  const hadServerAbRef = useRef<boolean>(existingAb !== null)

  const upsertAb = useUpsertEmailBroadcastABTest()
  const deleteAb = useDeleteEmailBroadcastABTest()

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...patch }))

  const createMutation = useCreateEmailBroadcast(organization.id)
  const updateMutation = useUpdateEmailBroadcast()
  const scheduleMutation = useScheduleEmailBroadcast()
  const sendMutation = useSendEmailBroadcast()
  const sendTestMutation = useSendTestEmailBroadcast()

  const persisting =
    createMutation.isPending ||
    updateMutation.isPending ||
    scheduleMutation.isPending ||
    sendMutation.isPending

  const isReadyToSend =
    draft.subject.trim().length > 0 &&
    draft.sender_name.trim().length > 0 &&
    draft.content_html.trim().length > 0

  const persistableUpdate = (): BroadcastWritePayload => ({
    subject: draft.subject,
    preview_text: draft.preview_text || null,
    sender_name: draft.sender_name,
    reply_to_email: draft.reply_to_email || null,
    content_html: draft.content_html,
    segment_id: draft.segment_id,
    filter_rules: draft.filter_rules,
  })

  // Returns the persisted broadcast id (creates first if needed).
  const persist = async (): Promise<string | null> => {
    let id = broadcastId
    if (id) {
      await updateMutation.mutateAsync({
        broadcastId: id,
        body: persistableUpdate(),
      })
    } else {
      if (!draft.subject.trim() || !draft.sender_name.trim()) return null
      const created = await createMutation.mutateAsync({
        subject: draft.subject,
        sender_name: draft.sender_name,
        preview_text: draft.preview_text || null,
        reply_to_email: draft.reply_to_email || null,
        content_html: draft.content_html,
        segment_id: draft.segment_id,
        filter_rules: draft.filter_rules,
      })
      id = created.id
      onOpened?.(id)
    }

    // Sync the A/B test config alongside the broadcast.
    if (abDraft && abDraft.subject_b.trim().length > 0) {
      await upsertAb.mutateAsync({
        broadcastId: id,
        body: {
          subject_b: abDraft.subject_b.trim(),
          slice_pct: abDraft.slice_pct,
          decide_after_minutes: abDraft.decide_after_minutes,
          winner_metric: abDraft.winner_metric,
        },
      })
      hadServerAbRef.current = true
    } else if (hadServerAbRef.current && !abDraft) {
      await deleteAb.mutateAsync(id)
      hadServerAbRef.current = false
    }

    setSavedAt(new Date())
    return id
  }

  const onSchedule = async (date: Date) => {
    const id = await persist()
    if (!id) return
    await scheduleMutation.mutateAsync({
      broadcastId: id,
      scheduledAt: date.toISOString(),
    })
    onBack()
  }

  const onSendNow = async () => {
    const id = await persist()
    if (!id) return
    if (
      !window.confirm(
        `Send "${draft.subject}" to your audience now? This can't be undone.`,
      )
    )
      return
    await sendMutation.mutateAsync(id)
    onBack()
  }

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn-icon" onClick={onBack} aria-label="Back">
            <Icon name="arrow-left" size={16} />
          </button>
          <div>
            <div className="eyebrow">
              {existing
                ? `${existing.status === 'scheduled' ? 'Scheduled' : 'Draft'} · ${isNew ? 'New' : 'Editing'}`
                : 'New broadcast · Draft'}
            </div>
            <h1 className="h1" style={{ marginTop: 6 }}>
              {draft.subject || 'Untitled broadcast'}
            </h1>
            {savedAt && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Saved {savedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setStep('preview')}>
            <Icon name="eye" size={15} />
            Preview
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => persist()}
            disabled={persisting}
          >
            {persisting ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setStep('review')}
            disabled={!isReadyToSend}
            style={{ opacity: !isReadyToSend ? 0.5 : 1 }}
          >
            <Icon name="send" size={15} />
            Schedule send
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 40,
        }}
      >
        <div style={{ position: 'sticky', top: 32, alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  background:
                    step === s.id ? 'var(--bg-softer)' : 'transparent',
                  color: step === s.id ? 'var(--ink)' : 'var(--ink-3)',
                  fontSize: 13.5,
                  fontWeight: step === s.id ? 500 : 400,
                  textAlign: 'left',
                  transition: 'all 0.12s',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background:
                      step === s.id ? 'var(--ink)' : 'var(--bg-softer)',
                    color: step === s.id ? '#fff' : 'var(--ink-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    border: step !== s.id ? '1px solid var(--line)' : 'none',
                  }}
                >
                  {i + 1}
                </div>
                {s.label}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 24,
              padding: '16px 14px',
              background: 'var(--bg-soft)',
              borderRadius: 12,
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Pre-send checklist
            </div>
            <Checklist
              items={[
                {
                  label: 'Subject line',
                  done: draft.subject.trim().length > 5,
                },
                {
                  label: 'Preview text',
                  done: draft.preview_text.trim().length > 5,
                },
                {
                  label: 'Sender name',
                  done: draft.sender_name.trim().length > 0,
                },
                {
                  label: 'Content',
                  done: draft.content_html.trim().length > 30,
                },
                {
                  label: 'Audience confirmed',
                  done: true,
                },
              ]}
            />
          </div>
        </div>

        <div>
          {step === 'details' && (
            <DetailsSection
              draft={draft}
              setDraft={updateDraft}
              abDraft={abDraft}
              setAbDraft={setAbDraft}
            />
          )}
          {step === 'content' && (
            <ContentSection draft={draft} setDraft={updateDraft} />
          )}
          {step === 'audience' && (
            <AudienceSection
              organization={organization}
              draft={draft}
              setDraft={updateDraft}
            />
          )}
          {step === 'preview' && (
            <PreviewSection
              draft={draft}
              broadcastId={broadcastId}
              persist={persist}
              sendTest={async (email) => {
                const id = await persist()
                if (!id) return
                await sendTestMutation.mutateAsync({
                  broadcastId: id,
                  email,
                })
              }}
              sending={sendTestMutation.isPending}
            />
          )}
          {step === 'review' && (
            <ReviewSection
              organization={organization}
              draft={draft}
              isReadyToSend={isReadyToSend}
              onSendNow={onSendNow}
              onSchedule={onSchedule}
              persisting={persisting}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 40,
              paddingTop: 24,
              borderTop: '1px solid var(--line)',
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={() => {
                const i = STEPS.findIndex((s) => s.id === step)
                if (i > 0) setStep(STEPS[i - 1].id)
              }}
              disabled={step === 'details'}
              style={{ opacity: step === 'details' ? 0.4 : 1 }}
            >
              <Icon name="arrow-left" size={15} />
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const i = STEPS.findIndex((s) => s.id === step)
                if (i < STEPS.length - 1) {
                  await persist()
                  setStep(STEPS[i + 1].id)
                }
              }}
              disabled={persisting}
            >
              Continue
              <Icon name="arrow-right" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Checklist = ({
  items,
}: {
  items: { label: string; done: boolean }[]
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map((item, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12.5,
          color: item.done ? 'var(--ink-2)' : 'var(--ink-3)',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: item.done ? 'var(--ink)' : 'transparent',
            border: item.done ? 'none' : '1.5px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {item.done && <Icon name="check" size={10} strokeWidth={2.5} />}
        </div>
        {item.label}
      </div>
    ))}
  </div>
)

const DetailsSection = ({
  draft,
  setDraft,
  abDraft,
  setAbDraft,
}: {
  draft: Draft
  setDraft: (p: Partial<Draft>) => void
  abDraft: ABDraft | null
  setAbDraft: (next: ABDraft | null) => void
}) => (
  <Section
    title="The basics"
    sub="Subject and preview text are the first — sometimes only — thing your readers see."
  >
    <div className="card" style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <label className="label">Subject line</label>
        <input
          className="input"
          value={draft.subject}
          onChange={(e) => setDraft({ subject: e.target.value })}
          style={{ fontSize: 15 }}
          placeholder="Brand Foundations — Module 5 is live"
          maxLength={255}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--ink-4)',
          }}
        >
          <span>
            {draft.subject.length} / 60 recommended · iPhone Mail truncates ~40
          </span>
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label className="label">Preview text</label>
        <input
          className="input"
          value={draft.preview_text}
          onChange={(e) => setDraft({ preview_text: e.target.value })}
          placeholder="A short hint at what's inside…"
          maxLength={150}
        />
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-4)' }}>
          Shows after the subject in the inbox preview ·{' '}
          {draft.preview_text.length} / 90 recommended
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label className="label">Sender name</label>
          <input
            className="input"
            value={draft.sender_name}
            onChange={(e) => setDraft({ sender_name: e.target.value })}
            maxLength={100}
          />
        </div>
        <div>
          <label className="label">Reply-to email</label>
          <input
            className="input"
            type="email"
            value={draft.reply_to_email}
            onChange={(e) => setDraft({ reply_to_email: e.target.value })}
            placeholder="you@yourdomain.com"
          />
        </div>
      </div>
    </div>

    <div className="card" style={{ marginTop: 16, padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: abDraft ? 24 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="flask" size={18} style={{ color: 'var(--ink-2)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Run an A/B test</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              Test subject lines on a slice of your audience first; we&apos;ll
              send the winner to the rest.
            </div>
          </div>
        </div>
        <Toggle
          on={abDraft !== null}
          onChange={(next) => setAbDraft(next ? (abDraft ?? blankAb()) : null)}
        />
      </div>
      {abDraft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--bg-softer)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-2)',
              }}
            >
              A
            </span>
            <input
              className="input"
              value={draft.subject}
              onChange={(e) => setDraft({ subject: e.target.value })}
              placeholder="Subject A"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--bg-softer)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-2)',
              }}
            >
              B
            </span>
            <input
              className="input"
              value={abDraft.subject_b}
              onChange={(e) =>
                setAbDraft({ ...abDraft, subject_b: e.target.value })
              }
              placeholder="Subject B"
              maxLength={255}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginTop: 8,
              padding: 16,
              background: 'var(--bg-soft)',
              borderRadius: 10,
            }}
          >
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Test slice
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={50}
                  value={abDraft.slice_pct}
                  onChange={(e) =>
                    setAbDraft({
                      ...abDraft,
                      slice_pct: Math.min(
                        50,
                        Math.max(5, Number(e.target.value) || 20),
                      ),
                    })
                  }
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>%</span>
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Decide after
              </div>
              <select
                className="select"
                value={abDraft.decide_after_minutes}
                onChange={(e) =>
                  setAbDraft({
                    ...abDraft,
                    decide_after_minutes: Number(e.target.value),
                  })
                }
              >
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={720}>12 hours</option>
                <option value={1440}>1 day</option>
                <option value={4320}>3 days</option>
              </select>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Winner by
              </div>
              <select
                className="select"
                value={abDraft.winner_metric}
                onChange={(e) =>
                  setAbDraft({
                    ...abDraft,
                    winner_metric: e.target.value as 'open_rate' | 'click_rate',
                  })
                }
              >
                <option value="open_rate">Open rate</option>
                <option value="click_rate">Click rate</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Half of the {abDraft.slice_pct}% test slice gets subject A, the
            other half gets subject B. After {abDraft.decide_after_minutes}{' '}
            minutes the winner is sent to the rest of your audience.
          </div>
        </div>
      )}
    </div>
  </Section>
)

const ContentSection = ({
  draft,
  setDraft,
}: {
  draft: Draft
  setDraft: (p: Partial<Draft>) => void
}) => (
  <Section
    title="Compose"
    sub="Write or paste the body of your email as HTML. The block-based editor is on the way."
  >
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            fontSize: 12,
            color: 'var(--ink-3)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>HTML body</span>
          <span>{draft.content_html.length} chars</span>
        </div>
        <textarea
          value={draft.content_html}
          onChange={(e) => setDraft({ content_html: e.target.value })}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 480,
            padding: 20,
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12.5,
            lineHeight: 1.6,
            background: '#fff',
            color: 'var(--ink-2)',
          }}
        />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg-soft)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          Live preview
        </div>
        <div
          style={{
            padding: 28,
            minHeight: 480,
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--ink-2)',
          }}
          dangerouslySetInnerHTML={{ __html: draft.content_html }}
        />
      </div>
    </div>
    <div
      style={{
        marginTop: 16,
        padding: '14px 18px',
        background: 'var(--bg-soft)',
        borderRadius: 12,
        fontSize: 12.5,
        color: 'var(--ink-3)',
      }}
    >
      <Icon name="sparkles" size={14} style={{ marginRight: 8 }} />
      Block-based editor (heading / image / button / divider blocks) is coming
      in a future update. The HTML body you write here is wrapped in your
      organization’s branded template before sending.
    </div>
  </Section>
)

type AudienceMode = 'all' | 'segment' | 'filter'

const audienceMode = (draft: Draft): AudienceMode => {
  if (draft.filter_rules) return 'filter'
  if (draft.segment_id) return 'segment'
  return 'all'
}

const SOURCE_OPTIONS = [
  { value: 'space_signup', label: 'Newsletter form' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'manual', label: 'Manual' },
  { value: 'import', label: 'CSV import' },
]

const AudienceSection = ({
  organization,
  draft,
  setDraft,
}: {
  organization: schemas['Organization']
  draft: Draft
  setDraft: (p: Partial<Draft>) => void
}) => {
  const segmentsQuery = useEmailSegments(organization.id)
  const subStatsQuery = useEmailSubscriberStats(organization.id)
  const segments = segmentsQuery.data ?? []
  const mode = audienceMode(draft)
  const totalActive = subStatsQuery.data?.active ?? 0

  const previewQuery = useSegmentFilterPreview(
    organization.id,
    draft.filter_rules,
    mode === 'filter',
  )

  const selectedSegment = segments.find((s) => s.id === draft.segment_id)
  const audienceCount =
    mode === 'all'
      ? totalActive
      : mode === 'segment'
        ? (selectedSegment?.subscriber_count ?? 0)
        : (previewQuery.data?.count ?? 0)
  const audiencePct =
    totalActive > 0 ? Math.round((audienceCount / totalActive) * 100) : 0

  const setFilterRules = (rules: FilterRule[] | null) => {
    if (rules === null) {
      setDraft({ filter_rules: null })
      return
    }
    setDraft({ filter_rules: { all: rules }, segment_id: null })
  }

  const rules = draft.filter_rules?.all ?? []

  return (
    <Section
      title="Who gets this?"
      sub="Send to your whole list, pick a saved segment, or build a filter."
    >
      <div className="card" style={{ padding: 8, marginBottom: 16 }}>
        <div className="tabs" style={{ width: '100%' }}>
          <button
            className={`tab ${mode === 'all' ? 'tab-active' : ''}`}
            onClick={() => setDraft({ segment_id: null, filter_rules: null })}
            style={{ flex: 1 }}
          >
            All active{' '}
            <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>
              {totalActive.toLocaleString()}
            </span>
          </button>
          <button
            className={`tab ${mode === 'segment' ? 'tab-active' : ''}`}
            onClick={() => {
              if (segments.length > 0)
                setDraft({
                  segment_id: segments[0].id,
                  filter_rules: null,
                })
            }}
            style={{ flex: 1 }}
            disabled={segments.length === 0}
            title={
              segments.length === 0
                ? 'No segments yet — create one from the segments area.'
                : undefined
            }
          >
            By segment
            <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>
              {segments.length}
            </span>
          </button>
          <button
            className={`tab ${mode === 'filter' ? 'tab-active' : ''}`}
            onClick={() =>
              setDraft({
                segment_id: null,
                filter_rules: draft.filter_rules ?? {
                  all: [{ field: 'source', op: 'is', value: 'space_signup' }],
                },
              })
            }
            style={{ flex: 1 }}
          >
            Custom segment
          </button>
          <button
            className="tab"
            disabled
            style={{ flex: 1, opacity: 0.5, cursor: 'not-allowed' }}
            title="Coming soon"
          >
            Upload list
          </button>
        </div>
      </div>

      {mode === 'segment' && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <label className="label">Pick a segment</label>
          <select
            className="select"
            value={draft.segment_id ?? ''}
            onChange={(e) =>
              setDraft({
                segment_id: e.target.value || null,
                filter_rules: null,
              })
            }
          >
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.subscriber_count} subscribers
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'filter' && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink-2)',
              marginBottom: 16,
            }}
          >
            Subscribers who match all of:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((rule, i) => (
              <FilterRowEditor
                key={i}
                rule={rule}
                onChange={(next) => {
                  const copy = [...rules]
                  copy[i] = next
                  setFilterRules(copy)
                }}
                onRemove={() => {
                  const copy = rules.filter((_, j) => j !== i)
                  setFilterRules(copy.length ? copy : null)
                }}
              />
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14, color: 'var(--ink-2)' }}
            onClick={() =>
              setFilterRules([
                ...rules,
                { field: 'source', op: 'is', value: 'space_signup' },
              ])
            }
          >
            <Icon name="plus" size={13} />
            Add filter
          </button>
        </div>
      )}

      <div
        style={{
          padding: 18,
          background: 'var(--bg-soft)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
            Estimated audience
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            {mode === 'filter' && previewQuery.isFetching && !previewQuery.data
              ? '…'
              : audienceCount.toLocaleString()}{' '}
            subscribers
          </div>
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}
        >
          {mode === 'all'
            ? 'Everyone marked active.'
            : `≈ ${audiencePct}% of your list`}
          <br />
          updates live as your list grows
        </div>
      </div>

      {mode === 'filter' &&
        previewQuery.data &&
        previewQuery.data.sample.length > 0 && (
          <div
            className="card"
            style={{
              marginTop: 16,
              padding: '12px 18px',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            <div
              style={{
                marginBottom: 6,
                color: 'var(--ink-2)',
                fontWeight: 500,
              }}
            >
              Sample matches
            </div>
            {previewQuery.data.sample.slice(0, 5).map((s) => (
              <div key={s.id} style={{ padding: '2px 0' }}>
                {s.name ? `${s.name} · ` : ''}
                <span style={{ color: 'var(--ink-2)' }}>{s.email}</span>
              </div>
            ))}
          </div>
        )}
    </Section>
  )
}

const FILTER_FIELDS = [
  {
    field: 'source',
    label: 'Source',
    ops: [
      { op: 'is', label: 'is' },
      { op: 'is_not', label: 'is not' },
    ],
    valueKind: 'source' as const,
  },
  {
    field: 'subscribed_at',
    label: 'Subscribed',
    ops: [
      { op: 'within_days', label: 'in the last' },
      { op: 'more_than_days_ago', label: 'more than days ago' },
    ],
    valueKind: 'days' as const,
  },
  {
    field: 'last_opened_at',
    label: 'Last opened',
    ops: [
      { op: 'within_days', label: 'within' },
      { op: 'more_than_days_ago', label: 'more than days ago' },
      { op: 'never_opened', label: 'never opened' },
    ],
    valueKind: 'days' as const,
  },
]

const FilterRowEditor = ({
  rule,
  onChange,
  onRemove,
}: {
  rule: FilterRule
  onChange: (next: FilterRule) => void
  onRemove: () => void
}) => {
  const fieldDef =
    FILTER_FIELDS.find((f) => f.field === rule.field) ?? FILTER_FIELDS[0]
  const showValue = rule.op !== 'never_opened'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        className="select"
        style={{ width: 160 }}
        value={rule.field}
        onChange={(e) => {
          const next = FILTER_FIELDS.find((f) => f.field === e.target.value)!
          onChange({
            field: next.field,
            op: next.ops[0].op,
            value: next.valueKind === 'days' ? 30 : 'space_signup',
          })
        }}
      >
        {FILTER_FIELDS.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="select"
        style={{ width: 170 }}
        value={rule.op}
        onChange={(e) =>
          onChange({
            ...rule,
            op: e.target.value,
            value:
              e.target.value === 'never_opened'
                ? null
                : (rule.value ??
                  (fieldDef.valueKind === 'days' ? 30 : 'space_signup')),
          })
        }
      >
        {fieldDef.ops.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      {showValue && fieldDef.valueKind === 'source' && (
        <select
          className="select"
          style={{ flex: 1 }}
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {showValue && fieldDef.valueKind === 'days' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
          }}
        >
          <input
            className="input"
            type="number"
            min={1}
            max={365}
            value={typeof rule.value === 'number' ? rule.value : 30}
            onChange={(e) =>
              onChange({ ...rule, value: Number(e.target.value) || 30 })
            }
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>days</span>
        </div>
      )}
      {!showValue && <div style={{ flex: 1 }} />}
      <button
        className="btn-ghost"
        style={{ padding: 8, borderRadius: 8 }}
        onClick={onRemove}
        aria-label="Remove filter"
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  )
}

const PreviewSection = ({
  draft,
  broadcastId,
  persist,
  sendTest,
  sending,
}: {
  draft: Draft
  broadcastId: string | null
  persist: () => Promise<string | null>
  sendTest: (email: string) => Promise<void>
  sending: boolean
}) => {
  const { currentUser } = useAuth()
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'inbox'>(
    'desktop',
  )
  const [testEmail, setTestEmail] = useState(currentUser?.email ?? '')
  const [testSent, setTestSent] = useState<string | null>(null)
  const validEmail = /[^@\s]+@[^@\s]+\.[^@\s]+/.test(testEmail.trim())

  const submit = async () => {
    if (!validEmail) return
    await sendTest(testEmail.trim())
    setTestSent(testEmail.trim())
    setTimeout(() => setTestSent(null), 4000)
  }

  return (
    <Section
      title="Preview"
      sub="See what this looks like in the inbox and across devices."
    >
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="tabs">
            <button
              className={`tab ${device === 'desktop' ? 'tab-active' : ''}`}
              onClick={() => setDevice('desktop')}
            >
              <Icon name="monitor" size={13} /> Desktop
            </button>
            <button
              className={`tab ${device === 'mobile' ? 'tab-active' : ''}`}
              onClick={() => setDevice('mobile')}
            >
              <Icon name="phone" size={13} /> Mobile
            </button>
            <button
              className={`tab ${device === 'inbox' ? 'tab-active' : ''}`}
              onClick={() => setDevice('inbox')}
            >
              <Icon name="mail" size={13} /> Inbox
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ width: 240, height: 36 }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={submit}
              disabled={!validEmail || sending}
              style={{ opacity: !validEmail || sending ? 0.5 : 1 }}
              title={
                broadcastId
                  ? 'Send test'
                  : 'Saves a draft first, then sends a test render.'
              }
            >
              <Icon name="send" size={13} />
              {sending ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </div>
        {testSent && (
          <div
            style={{
              padding: '10px 18px',
              background: 'var(--green-soft)',
              color: 'var(--green)',
              fontSize: 12.5,
              borderBottom: '1px solid var(--line)',
            }}
          >
            Test sent to {testSent}.
          </div>
        )}
        <div
          style={{
            padding: 40,
            background: 'var(--bg-soft)',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 420,
          }}
        >
          {device === 'desktop' && <DesktopPreview draft={draft} />}
          {device === 'mobile' && <MobilePreview draft={draft} />}
          {device === 'inbox' && <InboxPreview draft={draft} />}
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: 'var(--ink-4)',
        }}
      >
        Persist guard:{' '}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => persist()}
          style={{ display: 'inline-flex', padding: '2px 8px' }}
        >
          Save current draft
        </button>
      </div>
    </Section>
  )
}

const DesktopPreview = ({ draft }: { draft: Draft }) => (
  <div
    style={{
      width: 600,
      background: '#fff',
      borderRadius: 10,
      border: '1px solid var(--line)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
        color: 'var(--ink-3)',
      }}
    >
      From <strong style={{ color: 'var(--ink)' }}>{draft.sender_name}</strong>
      {draft.reply_to_email ? ` <${draft.reply_to_email}>` : ''}
    </div>
    <div style={{ padding: 32 }}>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '0 0 16px',
        }}
      >
        {draft.subject || 'Untitled broadcast'}
      </h3>
      <div
        style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)' }}
        dangerouslySetInnerHTML={{ __html: draft.content_html }}
      />
    </div>
  </div>
)

const MobilePreview = ({ draft }: { draft: Draft }) => (
  <div
    style={{
      width: 320,
      background: '#fff',
      borderRadius: 28,
      border: '8px solid #1d1d1f',
      overflow: 'hidden',
      boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
    }}
  >
    <div
      style={{
        padding: '20px 16px',
        borderBottom: '1px solid var(--line)',
        fontSize: 11,
        color: 'var(--ink-3)',
      }}
    >
      {draft.sender_name}
    </div>
    <div style={{ padding: 18 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: '0 0 12px',
          letterSpacing: '-0.01em',
        }}
      >
        {draft.subject || 'Untitled broadcast'}
      </h3>
      <div
        style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-2)' }}
        dangerouslySetInnerHTML={{ __html: draft.content_html }}
      />
    </div>
  </div>
)

const InboxPreview = ({ draft }: { draft: Draft }) => (
  <div
    style={{
      width: 560,
      background: '#fff',
      borderRadius: 10,
      border: '1px solid var(--line)',
      overflow: 'hidden',
    }}
  >
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          padding: '14px 18px',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
          opacity: i === 2 ? 1 : 0.45,
        }}
      >
        <div
          className="avatar"
          style={{ background: i === 2 ? '#1d1d1f' : '#86868b' }}
        >
          {i === 2
            ? draft.sender_name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : 'XX'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: i === 2 ? 600 : 500 }}>
              {i === 2 ? draft.sender_name : 'Other sender'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {i === 2 ? '8:01 AM' : 'Yesterday'}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: i === 2 ? 500 : 400,
              marginBottom: 2,
            }}
          >
            {i === 2 ? draft.subject || 'Untitled broadcast' : '—'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {i === 2 ? draft.preview_text || '—' : '—'}
          </div>
        </div>
      </div>
    ))}
  </div>
)

const ReviewSection = ({
  organization,
  draft,
  isReadyToSend,
  onSendNow,
  onSchedule,
  persisting,
}: {
  organization: schemas['Organization']
  draft: Draft
  isReadyToSend: boolean
  onSendNow: () => Promise<void>
  onSchedule: (date: Date) => Promise<void>
  persisting: boolean
}) => {
  const [scheduleType, setScheduleType] = useState<
    'now' | 'optimal' | 'custom'
  >('optimal')
  const [optimal] = useState(() => computeOptimalTime())
  const [customWhen, setCustomWhen] = useState(() =>
    toLocalDateTimeInputValue(optimal),
  )
  const [customMin] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000)),
  )
  const subStatsQuery = useEmailSubscriberStats(organization.id)
  const segmentsQuery = useEmailSegments(organization.id)
  const segment = (segmentsQuery.data ?? []).find(
    (s) => s.id === draft.segment_id,
  )
  const filterPreviewQuery = useSegmentFilterPreview(
    organization.id,
    draft.filter_rules,
    !!draft.filter_rules,
  )
  const audienceCount = draft.filter_rules
    ? (filterPreviewQuery.data?.count ?? 0)
    : draft.segment_id
      ? (segment?.subscriber_count ?? 0)
      : (subStatsQuery.data?.active ?? 0)
  const audienceLabel = draft.filter_rules
    ? 'Custom segment'
    : segment
      ? segment.name
      : null

  const fmtFull = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const onConfirm = async () => {
    if (!isReadyToSend) return
    if (scheduleType === 'now') return onSendNow()
    if (scheduleType === 'optimal') return onSchedule(optimal)
    const date = new Date(customWhen)
    if (Number.isNaN(date.getTime())) return
    if (date.getTime() <= Date.now()) {
      window.alert('Pick a date in the future.')
      return
    }
    return onSchedule(date)
  }

  return (
    <Section
      title="Review & send"
      sub="Last look. Ship it now, schedule it, or pick the time most likely to be opened."
    >
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h3 className="h3" style={{ marginBottom: 18 }}>
          Schedule
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <ScheduleOption
            id="now"
            current={scheduleType}
            onClick={setScheduleType}
            icon="send"
            title="Send now"
            sub="Immediately"
          />
          <ScheduleOption
            id="optimal"
            current={scheduleType}
            onClick={setScheduleType}
            icon="sparkles"
            title="Optimal time"
            sub={fmtFull(optimal)}
          />
          <ScheduleOption
            id="custom"
            current={scheduleType}
            onClick={setScheduleType}
            icon="calendar"
            title="Pick a time"
            sub="Choose date & time"
          />
        </div>
        {scheduleType === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <label className="label">Send at (your timezone)</label>
            <input
              type="datetime-local"
              className="input"
              value={customWhen}
              min={customMin}
              onChange={(e) => setCustomWhen(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 className="h3" style={{ marginBottom: 18 }}>
          Summary
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <KV
            k="From"
            v={`${draft.sender_name}${draft.reply_to_email ? ` <${draft.reply_to_email}>` : ''}`}
          />
          <KV
            k="Audience"
            v={`${audienceCount.toLocaleString()} subscribers${audienceLabel ? ` · ${audienceLabel}` : ''}`}
          />
          <KV k="Subject" v={draft.subject || '—'} />
          <KV k="Preview" v={draft.preview_text || '—'} />
          <KV
            k="Delivery"
            v={
              scheduleType === 'now'
                ? 'Right away'
                : scheduleType === 'optimal'
                  ? `${fmtFull(optimal)} (optimal)`
                  : customWhen
                    ? fmtFull(new Date(customWhen))
                    : '—'
            }
          />
          <KV k="Estimated cost" v="Included in plan" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={onConfirm}
          disabled={!isReadyToSend || persisting}
          style={{ opacity: !isReadyToSend || persisting ? 0.5 : 1 }}
        >
          <Icon name={scheduleType === 'now' ? 'send' : 'calendar'} size={15} />
          {scheduleType === 'now'
            ? persisting
              ? 'Sending…'
              : `Send to ${audienceCount.toLocaleString()}`
            : persisting
              ? 'Scheduling…'
              : 'Confirm & schedule'}
        </button>
      </div>
    </Section>
  )
}

const ScheduleOption = ({
  id,
  current,
  onClick,
  icon,
  title,
  sub,
}: {
  id: 'now' | 'optimal' | 'custom'
  current: 'now' | 'optimal' | 'custom'
  onClick: (id: 'now' | 'optimal' | 'custom') => void
  icon: string
  title: string
  sub: string
}) => {
  const active = current === id
  return (
    <button
      onClick={() => onClick(id)}
      className="card"
      style={{
        padding: 18,
        textAlign: 'left',
        borderColor: active ? 'var(--ink)' : 'var(--line)',
        borderWidth: active ? 2 : 1,
        background: active ? 'var(--bg-soft)' : '#fff',
        transition: 'all 0.15s',
      }}
    >
      <Icon
        name={icon}
        size={18}
        style={{ color: 'var(--ink-2)', marginBottom: 12 }}
      />
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
        {sub}
      </div>
    </button>
  )
}
