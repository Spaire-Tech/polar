'use client'

// Broadcast composer built on @react-email/editor.
//
// Three-tab workflow that mirrors the legacy wizard's idiom (back button +
// eyebrow + h1 + tabs + Back/Continue footer) using Spaire's existing
// `Section` / `card` / `label` / `input` / `btn-*` CSS classes. Tabs:
//
//   1. Details — subject, preview text, sender, from address, reply-to
//   2. Content — block palette · editor · inspector
//   3. Send    — test recipient, then live send
//
// Persists to the same EmailBroadcast.{content_json, content_html} columns
// the legacy wizard writes to, via the existing mutation hooks. Editor is
// mounted once on first paint and hidden across tab switches (not unmounted)
// so creators don't lose UI state when jumping between Details and Content.

import { useAuth } from '@/hooks/auth'
import {
  useCreateEmailBroadcast,
  useEmailSubscriberStats,
  useSendEmailBroadcast,
  useSendTestEmailBroadcast,
  useUpdateEmailBroadcast,
  useUploadEmailImage,
  type BroadcastWritePayload,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'

import { BlockPalette } from '../emailEditor/BlockPalette'
import {
  SpaireEmailEditor,
  type EmailEditorSnapshot,
} from '../emailEditor/SpaireEmailEditor'
import { Icon } from '../Icon'
import { sanitizeEmailHtml } from '../sanitize'
import { Section } from '../shared'

type Tab = 'details' | 'content' | 'send'

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'content', label: 'Content' },
  { id: 'send', label: 'Send' },
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

  // Draft state — mirrors the legacy Draft shape but trimmed to what V2 sends.
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [senderName, setSenderName] = useState(organization.name)
  const [senderEmail, setSenderEmail] = useState('')
  const [replyToEmail, setReplyToEmail] = useState('')
  const [testRecipient, setTestRecipient] = useState(currentUser?.email ?? '')
  const [broadcastId, setBroadcastId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<EmailEditorSnapshot | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [statusMsg, setStatusMsg] = useState<string>('')
  const [statusKind, setStatusKind] = useState<'info' | 'success' | 'error'>(
    'info',
  )
  const [tab, setTab] = useState<Tab>('details')

  // Live-send confirmation. The button is gated behind typing SEND so a
  // mis-click can't dispatch a real broadcast to the whole audience.
  const [confirmText, setConfirmText] = useState('')

  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendTest = useSendTestEmailBroadcast()
  const sendBroadcast = useSendEmailBroadcast()
  const subscriberStats = useEmailSubscriberStats(organization.id)
  const uploadImageMutation = useUploadEmailImage(organization.id)

  // Stable upload wrapper — TanStack mutation references change every
  // render; the editor will rebuild if uploadImage's identity changes,
  // so hold the mutation in a ref and expose a singleton callback.
  const uploadMutRef = useRef(uploadImageMutation)
  uploadMutRef.current = uploadImageMutation
  const uploadImage = useCallback(async (file: File) => {
    const result = await uploadMutRef.current.mutateAsync(file)
    return result.url
  }, [])

  const sanitizedHtml = useMemo(
    () => sanitizeEmailHtml(snapshot?.html),
    [snapshot?.html],
  )

  const setStatus = (kind: 'info' | 'success' | 'error', msg: string) => {
    setStatusKind(kind)
    setStatusMsg(msg)
  }

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
      sender_email: senderEmail || null,
      reply_to_email: replyToEmail || null,
      content_html: snapshot.html,
      content_json: snapshot.json as unknown as Record<string, unknown>,
      segment_id: null,
      filter_rules: null,
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

  const onSendTest = async () => {
    if (!testRecipient) {
      setStatus('error', 'Enter a recipient email for the test.')
      return
    }
    const id = await persist()
    if (!id) return
    setStatus('info', 'Sending test…')
    try {
      await sendTest.mutateAsync({ broadcastId: id, email: testRecipient })
      setStatus('success', `Test sent to ${testRecipient}.`)
    } catch (err) {
      setStatus('error', err instanceof Error ? err.message : 'Test failed.')
    }
  }

  const onSendLive = async () => {
    if (confirmText.trim().toUpperCase() !== 'SEND') {
      setStatus('error', 'Type SEND in the box to confirm.')
      return
    }
    const id = await persist()
    if (!id) return
    setStatus('info', 'Sending broadcast…')
    try {
      await sendBroadcast.mutateAsync(id)
      setStatus(
        'success',
        `Broadcast sent to ${activeSubscribers} active subscriber${activeSubscribers === 1 ? '' : 's'}.`,
      )
      setConfirmText('')
      // Hand off to the broadcasts list so the just-sent one shows up there.
      router.push(
        `/dashboard/${organization.slug}/email-marketing/broadcasts`,
      )
    } catch (err) {
      setStatus(
        'error',
        err instanceof Error ? err.message : 'Send failed.',
      )
    }
  }

  const isPersisting = createBroadcast.isPending || updateBroadcast.isPending
  const isSending = sendTest.isPending
  const isSendingLive = sendBroadcast.isPending
  const isReadyToSend = Boolean(subject.trim()) && Boolean(snapshot?.html)
  const activeSubscribers = subscriberStats.data?.active ?? 0
  const canSendLive =
    isReadyToSend &&
    activeSubscribers > 0 &&
    confirmText.trim().toUpperCase() === 'SEND' &&
    !isSendingLive &&
    !isPersisting
  const tabIndex = TABS.findIndex((t) => t.id === tab)

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
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
            className="btn btn-secondary"
            onClick={() => void persist()}
            disabled={isPersisting}
          >
            {isPersisting ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setTab('send')}
            disabled={!isReadyToSend}
            style={{ opacity: !isReadyToSend ? 0.5 : 1 }}
          >
            <Icon name="send" size={15} />
            Send
          </button>
        </div>
      </div>

      {/* ── Status banner ───────────────────────────────────────────────── */}
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

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <div style={{ display: tab === 'details' ? 'block' : 'none' }}>
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ display: tab === 'content' ? 'block' : 'none' }}>
        <Section
          title="Compose"
          sub="Pick a block from the left or type / inside the editor."
        >
          <SpaireEmailEditor
            content={STARTER_JSON}
            onChange={setSnapshot}
            uploadImage={uploadImage}
            paletteSlot={<BlockPalette />}
          />
        </Section>
      </div>

      {/* ── Send ────────────────────────────────────────────────────────── */}
      <div style={{ display: tab === 'send' ? 'block' : 'none' }}>
        <Section
          title="Send a test"
          sub="Send yourself the email to confirm it looks right before going live."
        >
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="label">Recipient</label>
                <input
                  className="input"
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={onSendTest}
                disabled={isSending || isPersisting || !isReadyToSend}
              >
                {isSending ? 'Sending…' : 'Send test'}
              </button>
            </div>
            {!isReadyToSend && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: 'var(--ink-3)',
                }}
              >
                Add a subject and at least one content block to enable
                sending.
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Send to subscribers"
          sub="Dispatches the broadcast to every active subscriber on your list. This can't be undone."
        >
          <div className="card" style={{ padding: 28 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: 'var(--bg-soft)',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Active subscribers
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    marginTop: 4,
                  }}
                >
                  {subscriberStats.isLoading
                    ? '…'
                    : activeSubscribers.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-soft)',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  From
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {senderName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
                >
                  {senderEmail || 'org default sender'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">Type SEND to confirm</label>
              <input
                className="input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SEND"
                disabled={!isReadyToSend || activeSubscribers === 0}
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={() => void onSendLive()}
              disabled={!canSendLive}
              style={{ opacity: canSendLive ? 1 : 0.5 }}
            >
              <Icon name="send" size={15} />
              {isSendingLive
                ? 'Sending…'
                : `Send to ${activeSubscribers.toLocaleString()} subscriber${activeSubscribers === 1 ? '' : 's'}`}
            </button>

            {activeSubscribers === 0 && !subscriberStats.isLoading && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: 'var(--ink-3)',
                }}
              >
                You don't have any active subscribers yet. Add some through
                your Space signup form to enable a live send.
              </div>
            )}
          </div>
        </Section>

        <Section title="Inbox preview" sub="How the email renders right now.">
          <div
            className="card"
            style={{ padding: 28, background: 'var(--bg-soft)' }}
          >
            <div
              style={{
                background: '#fff',
                maxWidth: 600,
                margin: '0 auto',
                padding: 28,
                borderRadius: 10,
                border: '1px solid var(--line)',
                minHeight: 200,
              }}
            >
              {sanitizedHtml ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--ink-4)',
                    padding: 40,
                  }}
                >
                  Start composing on the Content tab to see a preview.
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── Footer: Back / Continue ────────────────────────────────────── */}
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
            if (tabIndex > 0) setTab(TABS[tabIndex - 1].id)
          }}
          disabled={tabIndex === 0}
          style={{ opacity: tabIndex === 0 ? 0.4 : 1 }}
        >
          <Icon name="arrow-left" size={15} />
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (tabIndex < TABS.length - 1) {
              await persist()
              setTab(TABS[tabIndex + 1].id)
            }
          }}
          disabled={isPersisting || tabIndex === TABS.length - 1}
          style={{
            opacity: tabIndex === TABS.length - 1 ? 0.4 : 1,
          }}
        >
          Continue
          <Icon name="arrow-right" size={15} />
        </button>
      </div>
    </div>
  )
}
