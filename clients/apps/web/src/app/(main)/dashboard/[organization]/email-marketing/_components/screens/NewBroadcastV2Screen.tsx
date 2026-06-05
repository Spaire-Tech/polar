'use client'

// Broadcast composer (V2) built on @react-email/editor.
//
// Five-step flow that mirrors the legacy NewBroadcastScreen wizard:
//   1. Details       — subject, preview text, sender, from, reply-to
//   2. Content       — block palette · editor · inspector
//   3. Audience      — all active · segment · custom filter rules
//   4. Preview       — Desktop / Mobile / Inbox device mocks + send-test
//   5. Review & send — schedule (now / optimal / custom) + summary + dispatch
//
// All steps stay mounted via display:none toggling so the editor doesn't
// tear down on tab switches and the user never loses transient UI state.
// Persistence + dispatch go through the same useCreateEmailBroadcast /
// useUpdateEmailBroadcast / useScheduleEmailBroadcast / useSendEmailBroadcast
// hooks the legacy wizard uses, so the API path is unchanged.

import { useAuth } from '@/hooks/auth'
import {
  useCreateEmailBroadcast,
  useScheduleEmailBroadcast,
  useSendEmailBroadcast,
  useSendTestEmailBroadcast,
  useUpdateEmailBroadcast,
  useUploadEmailImage,
  type BroadcastWritePayload,
  type FilterRules,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import type { Editor } from '@tiptap/react'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

import { BlockPalette } from '../emailEditor/BlockPalette'
import {
  SpaireEmailEditor,
  type EmailEditorSnapshot,
} from '../emailEditor/SpaireEmailEditor'
import { Icon } from '../Icon'
import { Section } from '../shared'
import {
  AudienceSection,
  PreviewTabContent,
  ReviewSection,
} from './BroadcastV2Sections'

type Step = 'details' | 'content' | 'audience' | 'preview' | 'review'

const STEPS: { id: Step; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'content', label: 'Content' },
  { id: 'audience', label: 'Audience' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review & send' },
]

const STARTER_JSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Hi friends,' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text:
            "Write your update here. We'll wrap it in your branded template before sending.",
        },
      ],
    },
  ],
}

export function NewBroadcastV2Screen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { currentUser } = useAuth()

  // ── Draft state ─────────────────────────────────────────────────────
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [senderName, setSenderName] = useState(organization.name)
  const [senderEmail, setSenderEmail] = useState('')
  const [replyToEmail, setReplyToEmail] = useState('')
  const [segmentId, setSegmentId] = useState<string | null>(null)
  const [filterRules, setFilterRules] = useState<FilterRules | null>(null)

  // Editor output (TipTap JSON + email-ready HTML) lives in state so
  // every tab — preview, review, persistence — sees the latest snapshot.
  const [snapshot, setSnapshot] = useState<EmailEditorSnapshot | null>(null)

  // The editor instance lifted up via SpaireEmailEditor.onEditorReady so
  // sibling components (BlockPalette) can drive it without depending on
  // Tiptap's EditorContext resolution.
  const [editor, setEditor] = useState<Editor | null>(null)

  // ── Test send + UI state ────────────────────────────────────────────
  const [testEmail, setTestEmail] = useState(currentUser?.email ?? '')
  const [testSent, setTestSent] = useState<string | null>(null)

  const [broadcastId, setBroadcastId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [statusMsg, setStatusMsg] = useState<string>('')
  const [statusKind, setStatusKind] = useState<'info' | 'success' | 'error'>(
    'info',
  )
  const [step, setStep] = useState<Step>('details')

  // ── Mutations ───────────────────────────────────────────────────────
  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendTest = useSendTestEmailBroadcast()
  const sendBroadcast = useSendEmailBroadcast()
  const scheduleBroadcast = useScheduleEmailBroadcast()
  const uploadImageMutation = useUploadEmailImage(organization.id)

  // Stable upload wrapper — TanStack mutation refs change every render;
  // unstable callbacks rebuild the editor.
  const uploadMutRef = useRef(uploadImageMutation)
  uploadMutRef.current = uploadImageMutation
  const uploadImage = useCallback(async (file: File) => {
    const result = await uploadMutRef.current.mutateAsync(file)
    return result.url
  }, [])

  // ── Status helper ───────────────────────────────────────────────────
  const setStatus = (kind: 'info' | 'success' | 'error', msg: string) => {
    setStatusKind(kind)
    setStatusMsg(msg)
  }

  // ── Persistence ─────────────────────────────────────────────────────
  type CreatePayload = BroadcastWritePayload & {
    subject: string
    sender_name: string
  }

  const buildPayload = (): CreatePayload | null => {
    if (!snapshot) return null
    return {
      subject: subject || 'Untitled broadcast',
      preview_text: previewText || null,
      sender_name: senderName || organization.name,
      sender_email: senderEmail.trim() || null,
      reply_to_email: replyToEmail.trim() || null,
      content_html: snapshot.html,
      content_json: snapshot.json as unknown as Record<string, unknown>,
      segment_id: segmentId,
      filter_rules: filterRules,
    }
  }

  const persist = async (): Promise<string | null> => {
    const payload = buildPayload()
    if (!payload) {
      setStatus('error', 'Add some content before saving.')
      return null
    }
    setStatus('info', 'Saving…')
    try {
      let id = broadcastId
      if (id) {
        await updateBroadcast.mutateAsync({ broadcastId: id, body: payload })
      } else {
        const created = await createBroadcast.mutateAsync(payload)
        id = created.id
        setBroadcastId(id)
      }
      setSavedAt(new Date())
      setStatus('success', 'Saved.')
      return id
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Save failed.')
      return null
    }
  }

  // ── Test send ───────────────────────────────────────────────────────
  const onSendTest = async () => {
    const trimmed = testEmail.trim()
    if (!trimmed) {
      setStatus('error', 'Enter a recipient email for the test.')
      return
    }
    const id = await persist()
    if (!id) return
    setStatus('info', 'Sending test…')
    try {
      await sendTest.mutateAsync({ broadcastId: id, email: trimmed })
      setTestSent(trimmed)
      setStatus('success', `Test sent to ${trimmed}.`)
      window.setTimeout(() => setTestSent(null), 4000)
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Test failed.')
    }
  }

  // ── Live send & schedule ────────────────────────────────────────────
  const onSendNow = async () => {
    const id = await persist()
    if (!id) return
    setStatus('info', 'Sending broadcast…')
    try {
      await sendBroadcast.mutateAsync(id)
      setStatus('success', 'Broadcast sent.')
      router.push(
        `/dashboard/${organization.slug}/email-marketing/broadcasts`,
      )
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Send failed.')
    }
  }

  const onSchedule = async (date: Date) => {
    const id = await persist()
    if (!id) return
    setStatus('info', 'Scheduling…')
    try {
      await scheduleBroadcast.mutateAsync({
        broadcastId: id,
        scheduledAt: date.toISOString(),
      })
      setStatus('success', `Scheduled for ${date.toLocaleString()}.`)
      router.push(
        `/dashboard/${organization.slug}/email-marketing/broadcasts`,
      )
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Schedule failed.')
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────
  const isPersisting =
    createBroadcast.isPending ||
    updateBroadcast.isPending ||
    sendBroadcast.isPending ||
    scheduleBroadcast.isPending
  const isReadyToSend =
    subject.trim().length > 0 &&
    senderName.trim().length > 0 &&
    Boolean(snapshot?.html)
  const stepIndex = STEPS.findIndex((s) => s.id === step)

  const previewProps = {
    subject,
    senderName,
    replyToEmail,
    html: snapshot?.html ?? '',
  }

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minWidth: 0,
          }}
        >
          <button
            className="btn-icon"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">
              {broadcastId ? 'Draft · Editing' : 'New broadcast · Draft'}
            </div>
            <h1
              className="h1"
              style={{
                marginTop: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subject || 'Untitled broadcast'}
            </h1>
            {savedAt && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Saved {savedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setStep('preview')}
          >
            <Icon name="eye" size={15} />
            Preview
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void persist()}
            disabled={isPersisting}
          >
            {isPersisting ? 'Saving…' : 'Save draft'}
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

      {/* ── Status banner ───────────────────────────────────────────── */}
      {statusMsg && (
        <div
          style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            border: '1px solid var(--line)',
            background:
              statusKind === 'error'
                ? 'rgba(220,38,38,0.06)'
                : statusKind === 'success'
                  ? 'rgba(16,185,129,0.06)'
                  : 'var(--bg-soft)',
            color:
              statusKind === 'error'
                ? '#b91c1c'
                : statusKind === 'success'
                  ? '#047857'
                  : 'var(--ink-2)',
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <div className="tabs">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`tab ${step === s.id ? 'tab-active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Details ──────────────────────────────────────────────────── */}
      <div style={{ display: step === 'details' ? 'block' : 'none' }}>
        <Section
          title="The basics"
          sub="Subject and preview text are the first — sometimes only — thing your readers see."
        >
          <div className="card" style={{ padding: 28 }}>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Subject line</label>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ fontSize: 15 }}
                maxLength={255}
                placeholder="Your subject…"
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
                <span>{subject.length}/255</span>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Preview text</label>
              <input
                className="input"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                maxLength={150}
                placeholder="Shown in the inbox after the subject line"
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div>
                <label className="label">Sender name</label>
                <input
                  className="input"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label">From address</label>
                <input
                  className="input"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="hi@yourdomain.com (optional)"
                />
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    marginTop: 4,
                  }}
                >
                  Leave blank to use your default notifications sender.
                </div>
              </div>
              <div>
                <label className="label">Reply-to email</label>
                <input
                  className="input"
                  type="email"
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ display: step === 'content' ? 'block' : 'none' }}>
        <Section
          title="Compose"
          sub="Click a block on the left or type / inside the editor."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr',
              gap: 20,
              alignItems: 'flex-start',
            }}
          >
            <BlockPalette editor={editor} />
            <SpaireEmailEditor
              content={STARTER_JSON}
              onChange={setSnapshot}
              uploadImage={uploadImage}
              onEditorReady={setEditor}
            />
          </div>
        </Section>
      </div>

      {/* ── Audience ─────────────────────────────────────────────────── */}
      <div style={{ display: step === 'audience' ? 'block' : 'none' }}>
        <AudienceSection
          organization={organization}
          segmentId={segmentId}
          filterRules={filterRules}
          onChange={({ segmentId: nextSeg, filterRules: nextRules }) => {
            setSegmentId(nextSeg)
            setFilterRules(nextRules)
          }}
        />
      </div>

      {/* ── Preview ──────────────────────────────────────────────────── */}
      <div style={{ display: step === 'preview' ? 'block' : 'none' }}>
        <PreviewTabContent
          preview={previewProps}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          onSendTest={onSendTest}
          sending={sendTest.isPending || isPersisting}
          testSent={testSent}
        />
      </div>

      {/* ── Review & send ────────────────────────────────────────────── */}
      <div style={{ display: step === 'review' ? 'block' : 'none' }}>
        <ReviewSection
          organization={organization}
          subject={subject}
          previewText={previewText}
          senderName={senderName}
          replyToEmail={replyToEmail}
          segmentId={segmentId}
          filterRules={filterRules}
          isReadyToSend={isReadyToSend}
          persisting={isPersisting}
          onSendNow={onSendNow}
          onSchedule={onSchedule}
        />
      </div>

      {/* ── Footer: Back / Continue ──────────────────────────────────── */}
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
            if (stepIndex > 0) setStep(STEPS[stepIndex - 1].id)
          }}
          disabled={stepIndex === 0}
          style={{ opacity: stepIndex === 0 ? 0.4 : 1 }}
        >
          <Icon name="arrow-left" size={15} />
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (stepIndex < STEPS.length - 1) {
              await persist()
              setStep(STEPS[stepIndex + 1].id)
            }
          }}
          disabled={isPersisting || stepIndex === STEPS.length - 1}
          style={{
            opacity: stepIndex === STEPS.length - 1 ? 0.4 : 1,
          }}
        >
          Continue
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
    </div>
  )
}
