'use client'

// Broadcast composer — your design (the screenshot), now powered by the real
// @react-email/editor instead of the hand-rolled execCommand editor. Same
// chrome (top bar, To/Exclude, Subject, Broadcast-settings panel, Send), but
// the message body is the React Email visual editor: per-selection bubble-menu
// formatting, slash commands, normalized paste, and email-ready HTML via
// getEmail() — which fixes the selection/font-size/paste bugs at the root.

import { useAuth } from '@/hooks/auth'
import {
  useCreateEmailBroadcast,
  useEmailBroadcast,
  useScheduleEmailBroadcast,
  useSendEmailBroadcast,
  useSendTestEmailBroadcast,
  useUpdateEmailBroadcast,
  useUploadEmailImage,
  type BroadcastWritePayload,
} from '@/hooks/queries/emailMarketing'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { AudienceFields, fmt, useSegments } from './fields'
import { Icon, type IconName } from './Icon'
import { SendOptions } from './panel'
import { type SendOptionsState } from './types'

import './composer.css'
// React Email editor styles. NB: the package's exports map lists
// link/button/image-bubble-menu.css but ships no such files (their bubble-menu
// styles live in bubble-menu.css), so we import only the ones that exist.
import '@react-email/editor/themes/default.css'
import '@react-email/editor/styles/bubble-menu.css'
import '@react-email/editor/styles/slash-command.css'
import '@react-email/editor/styles/inspector.css'

// ── small local chrome helpers (same markup/classes as the original) ──
function Toast({ msg }: { msg: string }) {
  return <div className={'toast' + (msg ? ' show' : '')}>{msg}</div>
}

type MenuItem =
  | { sep: true }
  | { icon: IconName; label: string; danger?: boolean; fn: () => void }

function Menu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <Fragment>
      <div className="menu-backdrop" onClick={onClose}></div>
      <div className="c-menu">
        {items.map((it, i) =>
          'sep' in it ? (
            <div className="menu-sep" key={i}></div>
          ) : (
            <button
              key={i}
              className={'menu-item' + (it.danger ? ' danger' : '')}
              onClick={() => {
                it.fn()
                onClose()
              }}
            >
              <Icon name={it.icon} size={18} /> {it.label}
            </button>
          ),
        )}
      </div>
    </Fragment>
  )
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="c-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const todayISO = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function BroadcastComposer({
  organization,
  broadcastId: initialBroadcastId = null,
}: {
  organization: schemas['Organization']
  broadcastId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const exitTo =
    searchParams.get('returnTo') ||
    `/dashboard/${organization.slug}/email-marketing/broadcasts`
  const { currentUser } = useAuth()

  // Load an existing broadcast when editing (gated until ready so the editor
  // mounts with its content already in place).
  const existingQuery = useEmailBroadcast(initialBroadcastId ?? '')
  const existing = initialBroadcastId ? existingQuery.data : null
  const loading = !!initialBroadcastId && existingQuery.isLoading

  if (loading) {
    return createPortalSafe(
      <div className="composer-shell">
        <div className="topbar">
          <span className="tb-saved">Loading…</span>
        </div>
      </div>,
    )
  }

  return (
    <ComposerInner
      key={existing?.id ?? 'new'}
      organization={organization}
      existing={existing ?? null}
      exitTo={exitTo}
      router={router}
      currentUserEmail={currentUser?.email ?? ''}
      initialBroadcastId={initialBroadcastId}
    />
  )
}

// Render into document.body so the composer sits above the dashboard chrome.
function createPortalSafe(node: ReactNode): ReactNode {
  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

type Existing = ReturnType<typeof useEmailBroadcast>['data']

function ComposerInner({
  organization,
  existing,
  exitTo,
  router,
  currentUserEmail,
  initialBroadcastId,
}: {
  organization: schemas['Organization']
  existing: NonNullable<Existing> | null
  exitTo: string
  router: ReturnType<typeof useRouter>
  currentUserEmail: string
  initialBroadcastId: string | null
}) {
  const [audience, setAudience] = useState<string>(
    existing?.segment_id ?? 'all',
  )
  const [excludes, setExcludes] = useState<string[]>([])
  const [showExclude, setShowExclude] = useState(false)
  const [subject, setSubject] = useState(existing?.subject ?? '')
  const [so, setSo] = useState<SendOptionsState>({
    replyTo: 'self',
    schedule: false,
    date: todayISO(),
    time: '09:00',
    tracking: true,
    webVersion: true,
    labels: ['Newsletter'],
    customTags: [],
  })
  const [save, setSave] = useState<'saved' | 'saving'>('saved')
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'sent'>(
    (existing?.status as 'draft' | 'scheduled' | 'sent') ?? 'draft',
  )
  const [toast, setToastMsg] = useState('')
  const [menu, setMenu] = useState(false)
  const [sendMenu, setSendMenu] = useState(false)
  const [modal, setModal] = useState<
    null | 'send' | 'nosubject' | 'close' | 'discard'
  >(null)
  const [broadcastId, setBroadcastId] = useState<string | null>(
    initialBroadcastId,
  )
  const [mounted, setMounted] = useState(false)

  const editorRef = useRef<EmailEditorRef | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Initial editor content — existing HTML when editing, empty otherwise.
  // `existing` is stable for this mount (the parent keys ComposerInner by id),
  // so a plain derived const is correct here (no ref needed).
  const initialContent = existing?.content_html ?? ''

  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendBroadcast = useSendEmailBroadcast()
  const scheduleBroadcast = useScheduleEmailBroadcast()
  const sendTest = useSendTestEmailBroadcast()
  const uploadImage = useUploadEmailImage(organization.id)

  const segments = useSegments(organization.id)
  const audSeg = segments.find((s) => s.id === audience) ?? segments[0]
  const excTotal = excludes.reduce(
    (s, id) => s + (segments.find((x) => x.id === id)?.count ?? 0),
    0,
  )
  const reach = Math.max(0, (audSeg?.count ?? 0) - excTotal)

  useEffect(() => setMounted(true), [])

  const showToast = (m: string) => {
    setToastMsg(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400)
  }

  // Pull the email HTML + JSON from the editor at save time.
  const getContent = async (): Promise<{
    html: string
    json: Record<string, unknown> | null
  }> => {
    const ref = editorRef.current
    if (!ref) return { html: '', json: null }
    const { html } = await ref.getEmail()
    return { html, json: ref.getJSON() as unknown as Record<string, unknown> }
  }

  const buildPayload = (
    html: string,
    json: Record<string, unknown> | null,
  ): BroadcastWritePayload & { subject: string; sender_name: string } => ({
    subject: subject || 'Untitled broadcast',
    preview_text: null,
    sender_name: organization.name,
    sender_email: null,
    reply_to_email: so.replyTo === 'noreply' ? null : currentUserEmail || null,
    content_html: html,
    content_json: json,
    segment_id: audience === 'all' ? null : audience,
    filter_rules: null,
  })

  const persist = async (): Promise<string | null> => {
    const { html, json } = await getContent()
    const payload = buildPayload(html, json)
    setSave('saving')
    try {
      let id = broadcastId
      if (id) {
        await updateBroadcast.mutateAsync({ broadcastId: id, body: payload })
      } else {
        const created = await createBroadcast.mutateAsync(payload)
        id = created.id
        setBroadcastId(id)
      }
      setSave('saved')
      return id
    } catch (err) {
      setSave('saved')
      showToast(err instanceof Error ? err.message : 'Save failed')
      return null
    }
  }

  const doSendTest = async () => {
    if (!currentUserEmail) {
      showToast('No email on file for test send')
      return
    }
    const id = await persist()
    if (!id) return
    try {
      await sendTest.mutateAsync({ broadcastId: id, email: currentUserEmail })
      showToast('Test sent to ' + currentUserEmail)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Test failed')
    }
  }

  const trySend = () => {
    if (reach < 1) {
      showToast('This audience is empty')
      return
    }
    if (!subject.trim()) {
      setModal('nosubject')
      return
    }
    setModal('send')
  }

  const doSend = async () => {
    setModal(null)
    const id = await persist()
    if (!id) return
    try {
      if (so.schedule) {
        const dt = new Date(`${so.date}T${so.time}`)
        if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
          showToast('Pick a future date and time')
          return
        }
        await scheduleBroadcast.mutateAsync({
          broadcastId: id,
          scheduledAt: dt.toISOString(),
        })
        setStatus('scheduled')
        showToast('Broadcast scheduled for ' + so.date + ' at ' + so.time)
      } else {
        await sendBroadcast.mutateAsync(id)
        setStatus('sent')
        showToast('Broadcast sent to ' + fmt(reach) + ' subscribers')
      }
      router.push(exitTo)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Send failed')
    }
  }

  const onUploadImage = async (file: File): Promise<{ url: string }> => {
    const res = await uploadImage.mutateAsync(file)
    return { url: res.url }
  }

  const savedLabel =
    save === 'saving'
      ? 'Saving…'
      : status === 'sent'
        ? 'Sent'
        : status === 'scheduled'
          ? 'Scheduled'
          : 'Draft saved'

  const senderEmailDisplay = currentUserEmail
  const senderNameDisplay = organization.name
  const senderAvatarUrl = organization.avatar_url ?? null

  const menuItems: MenuItem[] = [
    { icon: 'flask', label: 'Send a test', fn: doSendTest },
    {
      icon: 'drafts',
      label: 'Save draft',
      fn: async () => {
        const id = await persist()
        if (id) showToast('Draft saved')
      },
    },
    { sep: true },
    {
      icon: 'trash',
      label: 'Discard draft',
      danger: true,
      fn: () => setModal('discard'),
    },
  ]
  const sendMenuItems: MenuItem[] = [
    {
      icon: 'sendFill',
      label: 'Send now',
      fn: () => {
        setSo({ ...so, schedule: false })
        trySend()
      },
    },
    {
      icon: 'clock',
      label: 'Schedule send',
      fn: () => {
        setSo({ ...so, schedule: true })
        showToast('Pick a date in settings →')
      },
    },
    { icon: 'flask', label: 'Send a test first', fn: doSendTest },
  ]

  if (!mounted) return null

  const shell = (
    <div className="composer-shell">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="topbar">
        <button
          className="tb-x"
          title="Close"
          onClick={() => setModal('close')}
        >
          <Icon name="close" size={22} />
        </button>
        <span className={'tb-saved' + (save === 'saving' ? ' saving' : '')}>
          {savedLabel}
        </span>
        <span className="tb-spacer"></span>
        <div style={{ position: 'relative' }}>
          <button
            className={'tb-round' + (menu ? ' on' : '')}
            title="More"
            onClick={() => setMenu(!menu)}
          >
            <Icon name="dots" size={20} />
          </button>
          {menu && <Menu items={menuItems} onClose={() => setMenu(false)} />}
        </div>
        <div className="split-pill" style={{ position: 'relative' }}>
          <button className="pill pill-dark pill-main" onClick={trySend}>
            <Icon name="send" size={18} /> {so.schedule ? 'Schedule' : 'Send'}
          </button>
          <span className="pill-cv"></span>
          <button className="pill-chev" onClick={() => setSendMenu(!sendMenu)}>
            <Icon name="chevronDown" size={16} />
          </button>
          {sendMenu && (
            <Menu items={sendMenuItems} onClose={() => setSendMenu(false)} />
          )}
        </div>
      </div>

      {/* ── Workspace ─────────────────────────────────────────────── */}
      <div className="work">
        <div className="doc-col">
          <AudienceFields
            organization={organization}
            audience={audience}
            setAudience={setAudience}
            excludes={excludes}
            setExcludes={setExcludes}
            showExclude={showExclude}
            setShowExclude={setShowExclude}
            subject={subject}
            setSubject={setSubject}
            reach={reach}
            onTouch={() => {}}
          />
          <div className="re-editor">
            <EmailEditor
              ref={editorRef}
              content={initialContent || undefined}
              placeholder="Write your message…"
              onUploadImage={onUploadImage}
            />
          </div>
        </div>

        <div className="panel-col">
          <SendOptions
            organization={organization}
            senderEmail={senderEmailDisplay}
            senderName={senderNameDisplay}
            senderAvatarUrl={senderAvatarUrl}
            so={so}
            setSo={setSo}
            onTouch={() => {}}
            onTest={doSendTest}
            sequence={false}
          />
        </div>
      </div>

      <Toast msg={toast} />

      {/* ── Modals ────────────────────────────────────────────────── */}
      {modal === 'send' && (
        <Modal onClose={() => setModal(null)}>
          <div className="modal-ic">
            <Icon name="sendFill" size={24} />
          </div>
          <h3>
            {so.schedule ? 'Schedule this broadcast?' : 'Send this broadcast?'}
          </h3>
          <p>
            It will go to <b>{fmt(reach)} subscribers</b>{' '}
            {so.schedule ? `on ${so.date} at ${so.time}` : 'right now'}.
          </p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="m-dark" onClick={() => void doSend()}>
              {so.schedule ? 'Schedule' : 'Send to ' + fmt(reach)}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'nosubject' && (
        <Modal onClose={() => setModal(null)}>
          <h3>Send without a subject?</h3>
          <p>
            This broadcast doesn&apos;t have a subject line. Subscribers are far
            more likely to skip it.
          </p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Add subject
            </button>
            <button className="m-dark" onClick={() => setModal('send')}>
              Send anyway
            </button>
          </div>
        </Modal>
      )}

      {modal === 'close' && (
        <Modal onClose={() => setModal(null)}>
          <h3>Close this draft?</h3>
          <p>Your broadcast is saved when you hit Save draft or Send.</p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Keep editing
            </button>
            <button
              className="m-dark"
              onClick={() => {
                setModal(null)
                router.push(exitTo)
              }}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {modal === 'discard' && (
        <Modal onClose={() => setModal(null)}>
          <h3>Discard this draft?</h3>
          <p>This can&apos;t be undone.</p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="m-danger"
              onClick={() => {
                setModal(null)
                router.push(exitTo)
              }}
            >
              Discard
            </button>
          </div>
        </Modal>
      )}
    </div>
  )

  return createPortal(shell, document.body)
}
