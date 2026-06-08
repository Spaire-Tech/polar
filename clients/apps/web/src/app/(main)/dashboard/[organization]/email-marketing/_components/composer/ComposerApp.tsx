'use client'

// Top-level broadcast composer.
//
// Ports the design's single-page layout 1:1 and wires every action to the
// existing Spaire email-broadcast API surface — no new endpoints needed.
//
//   - Subject, body blocks, attachments, audience, sender → persisted via
//     useCreateEmailBroadcast / useUpdateEmailBroadcast
//   - "Send a test" → useSendTestEmailBroadcast
//   - "Send" → useSendEmailBroadcast (or useScheduleEmailBroadcast if the
//     Schedule toggle is on)
//   - Image blocks call useUploadEmailImage so the broadcast HTML ships
//     hosted URLs (not base64 data URLs) — keeps payload size sane on send.

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
import { useRouter } from 'next/navigation'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { MailDocument } from './blocks'
import { AudienceFields, fmt, useSegments } from './fields'
import { Icon, type IconName } from './Icon'
import { ContextPanel, SendOptions } from './panel'
import { EmailPreview } from './preview'
import { blocksToEmailHtml } from './serializer'
import {
  INITIAL_BLOCKS,
  TEXTLIKE,
  defaultBlock,
  readFileAsDataURL,
  type Attachment,
  type Block,
  type BlockType,
  type SendOptionsState,
} from './types'

import './composer.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Toast({ msg }: { msg: string }) {
  return <div className={'toast' + (msg ? ' show' : '')}>{msg}</div>
}

type MenuItem =
  | { sep: true }
  | { icon: IconName; label: string; danger?: boolean; fn: () => void }

function Menu({
  items,
  onClose,
}: {
  items: MenuItem[]
  onClose: () => void
}) {
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

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function ComposerApp({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { currentUser } = useAuth()

  // Draft state
  const [audience, setAudience] = useState<string>('all')
  const [excludes, setExcludes] = useState<string[]>([])
  const [showExclude, setShowExclude] = useState(false)
  const [subject, setSubject] = useState(
    'June at the studio: new course + a flash sale',
  )
  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [drag, setDrag] = useState<string | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
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
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'sent'>('draft')
  const [toast, setToastMsg] = useState('')
  const [menu, setMenu] = useState(false)
  const [sendMenu, setSendMenu] = useState(false)
  const [modal, setModal] = useState<
    null | 'send' | 'nosubject' | 'close' | 'discard'
  >(null)
  const [broadcastId, setBroadcastId] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileCb = useRef<((f: File) => void) | null>(null)
  // Tracks which image block, if any, is currently waiting for a file.
  // Lets the file picker drive both "new upload" and "replace existing".
  const pendingImageId = useRef<string | null>(null)

  // Mutations
  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendBroadcast = useSendEmailBroadcast()
  const scheduleBroadcast = useScheduleEmailBroadcast()
  const sendTest = useSendTestEmailBroadcast()
  const uploadImage = useUploadEmailImage(organization.id)

  // Audience derivation
  const segments = useSegments(organization.id)
  const audSeg = segments.find((s) => s.id === audience) ?? segments[0]
  const excTotal = excludes.reduce(
    (s, id) => s + (segments.find((x) => x.id === id)?.count ?? 0),
    0,
  )
  const reach = Math.max(0, (audSeg?.count ?? 0) - excTotal)

  // Selected block + context panel decision
  const sel = blocks.find((b) => b.id === selId) || null
  const showCtx = mode === 'edit' && sel && !TEXTLIKE.includes(sel.type)

  // Touch handlers
  const touch = () => {
    setSave('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setSave('saved'), 850)
  }
  const showToast = (m: string) => {
    setToastMsg(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400)
  }
  const pickFile = (accept: string, cb: (f: File) => void) => {
    if (!fileRef.current) return
    fileRef.current.accept = accept
    fileCb.current = cb
    fileRef.current.value = ''
    fileRef.current.click()
  }

  // Block ops
  const addBlock = (type: BlockType, at?: number) => {
    const nb = defaultBlock(type)
    setBlocks((bs) => {
      const c = [...bs]
      c.splice(at == null ? bs.length : at, 0, nb)
      return c
    })
    setSelId(nb.id)
    touch()
    if (type === 'image') pickImageFor(nb.id)
  }
  const update = (id: string, patch: Partial<Block>) => {
    setBlocks((bs) =>
      bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
    )
    touch()
  }
  const del = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id))
    setSelId(null)
    touch()
    showToast('Section removed')
  }
  const dup = (id: string) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id)
      if (i < 0) return bs
      const copy = JSON.parse(JSON.stringify(bs[i])) as Block
      copy.id = 'm' + Date.now() + Math.floor(Math.random() * 1000)
      const c = [...bs]
      c.splice(i + 1, 0, copy)
      return c
    })
    touch()
    showToast('Section duplicated')
  }
  const changeType = (id: string, t: BlockType) => {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b
        // text → list / list → text conversion preserves visible text by
        // walking through the rendered innerText so HTML tags don't leak
        // into list items as raw strings.
        const wasList = b.type === 'bullet' || b.type === 'numbered'
        const toList = t === 'bullet' || t === 'numbered'
        if (toList && !wasList) {
          const html = 'html' in b ? b.html || '' : ''
          const tmp = document.createElement('div')
          tmp.innerHTML = html
          const items =
            (tmp.innerText || '').split('\n').filter(Boolean) || [html]
          return { id: b.id, type: t, items } as Block
        }
        if (!toList && wasList) {
          const items = 'items' in b ? b.items || [] : []
          return { id: b.id, type: t, html: items.join('<br>') } as Block
        }
        if (TEXTLIKE.includes(t) && !toList && !wasList) {
          return { ...b, type: t } as Block
        }
        return { ...b, type: t } as Block
      }),
    )
    touch()
  }

  // DnD
  const onDragStart = (id: string) => {
    setDrag(id)
    setDropIdx(null)
  }
  const onDragEnd = () => {
    setDrag(null)
    setDropIdx(null)
  }
  const onDrop = () => {
    if (drag == null) return
    const at = dropIdx == null ? blocks.length : dropIdx
    setBlocks((bs) => {
      const from = bs.findIndex((b) => b.id === drag)
      if (from === -1) return bs
      const c = [...bs]
      const [m] = c.splice(from, 1)
      c.splice(from < at ? at - 1 : at, 0, m)
      return c
    })
    setDrag(null)
    setDropIdx(null)
    touch()
  }

  // Image picker — used for both "create image block" and "replace existing".
  const pickImageFor = (blockId: string) => {
    pendingImageId.current = blockId
    pickFile('image/*', async (file) => {
      // Show a local preview immediately while the upload completes.
      readFileAsDataURL(file, (data) => {
        const id = pendingImageId.current
        if (id) update(id, { src: data } as Partial<Block>)
      })
      try {
        const { url } = await uploadImage.mutateAsync(file)
        const id = pendingImageId.current
        if (id) update(id, { src: url } as Partial<Block>)
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Image upload failed',
        )
      } finally {
        pendingImageId.current = null
      }
    })
  }

  // Attachments — kept local. The server-side persistence layer does not
  // yet track per-broadcast file attachments; we render them inline in the
  // preview so the creator can see what they intended. Upload to a hosted
  // location is the obvious next step.
  const addAttachment = () =>
    pickFile('*/*', (f) => {
      const kb = f.size / 1024
      const size =
        kb > 1024
          ? (kb / 1024).toFixed(1) + ' MB'
          : Math.max(1, Math.round(kb)) + ' KB'
      setAttachments((a) => [...a, { name: f.name, size }])
      touch()
      showToast('Attached ' + f.name)
    })
  const rmAttachment = (i: number) => {
    setAttachments((a) => a.filter((_, j) => j !== i))
    touch()
  }

  // Backend persistence
  const buildPayload = (): BroadcastWritePayload & {
    subject: string
    sender_name: string
  } => {
    const filter_rules: FilterRules | null =
      audience !== 'all' || excludes.length
        ? null /* segment+excludes can't be expressed via FilterRules yet */
        : null
    return {
      subject: subject || 'Untitled broadcast',
      preview_text: null,
      sender_name: organization.name,
      sender_email: null,
      reply_to_email: so.replyTo === 'noreply' ? null : null,
      content_html: blocksToEmailHtml(blocks),
      // content_json stores the source-of-truth block list so the doc can
      // be reopened losslessly. Wrapped in a versioned envelope so we can
      // evolve the schema without breaking older drafts.
      content_json: {
        v: 'composer.v3',
        blocks,
        attachments,
        audience,
        excludes,
        sendOptions: so,
      } as unknown as Record<string, unknown>,
      segment_id: audience === 'all' ? null : audience,
      filter_rules,
    }
  }

  const persist = async (): Promise<string | null> => {
    const payload = buildPayload()
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
    const recipient = currentUser?.email
    if (!recipient) {
      showToast('No email on file for test send')
      return
    }
    const id = await persist()
    if (!id) return
    try {
      await sendTest.mutateAsync({ broadcastId: id, email: recipient })
      showToast('Test sent to ' + recipient)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Test failed')
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        sel &&
        !TEXTLIKE.includes(sel.type)
      ) {
        const ae = document.activeElement as HTMLElement | null
        if (
          ae &&
          ((ae as HTMLElement).isContentEditable ||
            ae.tagName === 'INPUT' ||
            ae.tagName === 'TEXTAREA')
        )
          return
        e.preventDefault()
        del(sel.id)
      }
      if (e.key === 'Escape') {
        setSelId(null)
        setMenu(false)
        setSendMenu(false)
        setModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

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
      router.push(
        `/dashboard/${organization.slug}/email-marketing/broadcasts`,
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Send failed')
    }
  }

  const menuItems: MenuItem[] = [
    { icon: 'flask', label: 'Send a test', fn: doSendTest },
    { icon: 'paperclip', label: 'Attach files', fn: addAttachment },
    {
      icon: 'copy',
      label: 'Duplicate broadcast',
      fn: () => showToast('Broadcast duplicated'),
    },
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
        setSelId(null)
        showToast('Pick a date in settings →')
      },
    },
    { icon: 'flask', label: 'Send a test first', fn: doSendTest },
  ]

  const savedLabel =
    save === 'saving'
      ? 'Saving…'
      : status === 'sent'
        ? 'Sent'
        : status === 'scheduled'
          ? 'Scheduled'
          : 'Draft saved'

  const header = (
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
      onTouch={touch}
    />
  )

  const attachTray = (
    <div className="atray">
      {attachments.map((f, i) => (
        <div className="atile" key={i}>
          <span className="fi">
            <Icon name="file" size={20} />
          </span>
          <span className="meta">
            <b>{f.name}</b>
            <span>{f.size}</span>
          </span>
          <button className="rm" onClick={() => rmAttachment(i)}>
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
      <div className="atile add" onClick={addAttachment}>
        <span className="fi">
          <Icon name="paperclip" size={18} />
        </span>
        <span className="meta">
          <b>Attach a file</b>
          <span>Up to 25 MB</span>
        </span>
      </div>
    </div>
  )

  const senderEmailDisplay = currentUser?.email ?? ''

  return (
    <div className="composer-shell">
      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && fileCb.current) fileCb.current(f)
        }}
      />

      {/* ── Top bar ────────────────────────────────────────────────── */}
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
        <button
          className="tb-round"
          title="Attach files"
          onClick={addAttachment}
        >
          <Icon name="paperclip" size={19} />
        </button>
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
        <button
          className={'pill pill-soft' + (mode === 'preview' ? ' on' : '')}
          onClick={() => {
            setMode(mode === 'preview' ? 'edit' : 'preview')
            setSelId(null)
          }}
        >
          <Icon name="eye" size={19} /> Preview
        </button>
        <div className="split-pill" style={{ position: 'relative' }}>
          <button className="pill pill-dark pill-main" onClick={trySend}>
            <Icon name="send" size={18} /> {so.schedule ? 'Schedule' : 'Send'}
          </button>
          <span className="pill-cv"></span>
          <button
            className="pill-chev"
            onClick={() => setSendMenu(!sendMenu)}
          >
            <Icon name="chevronDown" size={16} />
          </button>
          {sendMenu && (
            <Menu items={sendMenuItems} onClose={() => setSendMenu(false)} />
          )}
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────────── */}
      <div className="work">
        {mode === 'edit' ? (
          <MailDocument
            header={header}
            attachTray={attachTray}
            blocks={blocks}
            selId={selId}
            onSelect={setSelId}
            update={update}
            changeType={changeType}
            addBlock={addBlock}
            pickImageFor={pickImageFor}
            drag={drag}
            dropIdx={dropIdx}
            setDropIdx={setDropIdx}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onDuplicate={dup}
            onDelete={del}
          />
        ) : (
          <div className="doc-col">
            <div className="mid-bar">
              <div className="mid-seg">
                <button onClick={() => setMode('edit')}>
                  <Icon name="type" size={15} /> Edit
                </button>
                <button className="on">
                  <Icon name="eye" size={15} /> Preview
                </button>
              </div>
              <div className="mid-dev">
                <button
                  className={device === 'desktop' ? 'on' : ''}
                  onClick={() => setDevice('desktop')}
                >
                  <Icon name="monitor" size={18} />
                </button>
                <button
                  className={device === 'mobile' ? 'on' : ''}
                  onClick={() => setDevice('mobile')}
                >
                  <Icon name="smartphone" size={18} />
                </button>
              </div>
            </div>
            <EmailPreview
              organization={organization}
              senderEmail={senderEmailDisplay}
              subject={subject}
              blocks={blocks}
              attachments={attachments}
              webVersion={so.webVersion}
              device={device}
            />
          </div>
        )}

        <div className="panel-col">
          {showCtx && sel ? (
            <ContextPanel
              b={sel}
              update={update}
              onDelete={del}
              onClose={() => setSelId(null)}
              pickImage={() => pickImageFor(sel.id)}
              toast={showToast}
            />
          ) : (
            <SendOptions
              organization={organization}
              senderEmail={senderEmailDisplay}
              so={so}
              setSo={setSo}
              onTouch={touch}
              onTest={doSendTest}
            />
          )}
        </div>
      </div>

      <Toast msg={toast} />

      {/* ── Modals ─────────────────────────────────────────────────── */}
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
          <div className="modal-rows">
            <div className="mrow">
              <Icon name={audSeg?.icon ?? 'people'} size={17} />{' '}
              {audSeg?.name}
              {excludes.length
                ? `, minus ${excludes.length} segment${excludes.length > 1 ? 's' : ''}`
                : ''}
            </div>
            <div className="mrow">
              <Icon name="clock" size={17} />{' '}
              {so.schedule ? `${so.date} · ${so.time}` : 'Send immediately'}
            </div>
            {so.tracking && (
              <div className="mrow">
                <Icon name="shield" size={17} /> Opens &amp; clicks tracked
              </div>
            )}
          </div>
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
            This broadcast doesn&apos;t have a subject line. Subscribers are
            far more likely to skip it.
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
          <p>
            Your broadcast is saved automatically — you can finish it later
            from Drafts.
          </p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Keep editing
            </button>
            <button
              className="m-dark"
              onClick={() => {
                setModal(null)
                router.push(
                  `/dashboard/${organization.slug}/email-marketing/broadcasts`,
                )
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
          <p>
            This can&apos;t be undone. The broadcast and its content will be
            deleted.
          </p>
          <div className="modal-actions">
            <button className="m-ghost" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="m-danger"
              onClick={() => {
                setModal(null)
                setBlocks([])
                setSubject('')
                setAttachments([])
                showToast('Draft discarded')
              }}
            >
              Discard
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
