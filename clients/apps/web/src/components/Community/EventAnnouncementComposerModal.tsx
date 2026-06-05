'use client'

// Host-composed announcement composer. The host types a subject + a
// free-text body; we POST that to the preview endpoint on a debounce so
// the right pane stays in sync with what recipients will actually see.
// Hitting "Send" creates the announcement row + enqueues the fan-out;
// the host gets a "Sent to N members" toast back on the parent.
//
// Replaces the old "Re-announce" 3-dots action — that one re-fired a
// templated email, this one lets the host actually speak in their own
// voice ("hey everyone, can't wait, please come!").

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useCreateCommunityEventAnnouncement,
  usePreviewCommunityEventAnnouncement,
} from '../../hooks/queries/community'
import type { CommunityEvent } from './EventsView'
import styles from './community.module.css'
import { IconCalendar, IconSend, IconX } from './icons'

type Props = {
  open: boolean
  courseId: string
  event: CommunityEvent | null
  onClose: () => void
  // Fires when the announcement was sent successfully. Parent owns
  // the toast UX so the message stays consistent with the rest of the
  // host-side feedback (e.g. "Sent to 42 members").
  onSent?: (recipientCount: number) => void
  // Optional opener label so the modal can re-skin itself for the
  // post-create flow ("Tell your members") vs the menu flow ("Send
  // announcement"). Defaults to the menu wording.
  mode?: 'post-create' | 'menu'
}

const PREVIEW_DEBOUNCE_MS = 600

const defaultSubject = (event: CommunityEvent | null): string => {
  if (!event) return ''
  // Anchor on the event title so the host edits towards a personal
  // line rather than starting from a blank slate.
  return `Heads up: ${event.title}`
}

const defaultBody = (event: CommunityEvent | null): string => {
  if (!event) return ''
  // Soft template the host can keep, edit, or wipe. Trying to write
  // it for them gets in the way; trying to leave it blank gives them
  // nothing to react to. This is the middle ground.
  return `Hey everyone,

A quick note about ${event.title}. The event card with the time + how to join is below — hit "View event" to RSVP or to add it to your calendar.

See you there!`
}

export function EventAnnouncementComposerModal({
  open,
  courseId,
  event,
  onClose,
  onSent,
  mode = 'menu',
}: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const sendMut = useCreateCommunityEventAnnouncement(
    courseId,
    event?.id ?? undefined,
  )
  const previewMut = usePreviewCommunityEventAnnouncement(
    courseId,
    event?.id ?? undefined,
  )

  // Seed subject + body when the modal first opens on a given event.
  // Re-seeding mid-edit would clobber the host's typing, so we only
  // do it on the open transition.
  const lastSeededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !event) return
    if (lastSeededFor.current === event.id) return
    setSubject(defaultSubject(event))
    setBody(defaultBody(event))
    setPreviewHtml(null)
    setPreviewError(null)
    lastSeededFor.current = event.id
  }, [open, event])

  // Debounced preview fetch. We fire whenever subject or body changes
  // and let the latest call win — outdated responses are dropped via
  // the request-id ref pattern so a slow earlier preview doesn't
  // overwrite a fresh later one.
  const requestIdRef = useRef(0)
  useEffect(() => {
    if (!open || !event) return
    if (!subject.trim()) {
      setPreviewHtml(null)
      return
    }
    const requestId = ++requestIdRef.current
    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await previewMut.mutateAsync({ subject, body })
        if (requestId !== requestIdRef.current) return
        setPreviewHtml(res.html)
        setPreviewError(null)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setPreviewError(
          err instanceof Error ? err.message : 'Could not render preview',
        )
        setPreviewHtml(null)
      } finally {
        if (requestId === requestIdRef.current) {
          setPreviewLoading(false)
        }
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // mutateAsync identity changes every render; intentionally
    // excluded so we don't re-trigger on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, subject, body])

  // Esc to close. Suppressed while the confirm dialog is up so the
  // host's Esc closes the dialog instead of the whole composer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, confirmOpen, onClose])

  const headerCopy = useMemo(() => {
    if (mode === 'post-create') {
      return {
        title: 'Tell your members',
        sub: "Your event is published. Now write a quick note so it doesn't just appear in their inbox.",
      }
    }
    return {
      title: 'Send announcement',
      sub: 'Goes to every enrolled member as bell + email, wrapped in your event card.',
    }
  }, [mode])

  if (!open || !event) return null

  const canSend = subject.trim().length > 0 && !sendMut.isPending

  const onSend = () => setConfirmOpen(true)

  const onConfirmSend = async () => {
    try {
      const res = await sendMut.mutateAsync({
        subject: subject.trim(),
        body,
        send_now: true,
      })
      setConfirmOpen(false)
      onSent?.(res.recipient_count)
      onClose()
    } catch {
      setConfirmOpen(false)
      // sendMut.error is surfaced inline below the button — no toast
      // here so the failure stays attached to the action.
    }
  }

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send event announcement"
    >
      <div
        className={styles.ceModal}
        onClick={(e) => e.stopPropagation()}
        // Wider than the create-event modal — we want the form +
        // preview to live side by side on desktop.
        style={{ maxWidth: 920 }}
      >
        <div className={styles.ceHead}>
          <div>
            <div className={styles.ceTitle}>{headerCopy.title}</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--c-muted)',
              }}
            >
              {headerCopy.sub}
            </div>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        <div
          className={styles.ceBody}
          // Override the default vertical-stack so we can put form +
          // preview side-by-side. Falls back to stacked under 720px.
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
            gap: 22,
          }}
        >
          {/* ---- Form column ---- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              minWidth: 0,
            }}
          >
            <div className={styles.ceField}>
              <span className={styles.ceLabel}>Subject</span>
              <input
                className={styles.ceInput}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={defaultSubject(event)}
                maxLength={200}
                autoFocus
              />
            </div>

            <div className={styles.ceField}>
              <span className={styles.ceLabel}>Message</span>
              <textarea
                className={styles.ceInput}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a personal note. Press Enter twice for a paragraph break."
                rows={10}
                maxLength={4000}
                // Inline so the textarea matches the modal's other
                // inputs (which use ceInput) but with a multi-line
                // resize handle.
                style={{
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: 200,
                  lineHeight: 1.5,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--c-muted)',
                  alignSelf: 'flex-end',
                }}
              >
                {body.length} / 4000
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                color: 'var(--c-muted)',
                background: 'var(--c-panel)',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              The event card below your message — date, time, location,
              host — is rendered automatically. Recipients see an
              &quot;RSVP&quot; / &quot;View event&quot; button at the
              bottom.
            </div>
          </div>

          {/* ---- Preview column ---- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <div
              className={styles.ceLabel}
              style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconCalendar size={11} /> Preview
              {previewLoading ? (
                <span style={{ color: 'var(--c-muted)' }}>· refreshing…</span>
              ) : null}
            </div>
            <div
              style={{
                border: '1px solid var(--c-line)',
                borderRadius: 12,
                background: '#fff',
                flex: 1,
                minHeight: 360,
                overflow: 'hidden',
              }}
            >
              {previewError ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#dc2626',
                    fontSize: 13,
                  }}
                >
                  {previewError}
                </div>
              ) : previewHtml ? (
                // srcDoc isolates the email's <html><head><body> so
                // its global font + table styles don't bleed into the
                // composer. Sandbox blocks any scripts the renderer
                // might inject (it shouldn't, but defense in depth).
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox=""
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 360,
                    border: 'none',
                    background: '#fff',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--c-muted)',
                    fontSize: 13,
                  }}
                >
                  Start typing a subject — your preview lands here.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>
            Goes to every member enrolled in this course
          </div>
          <div className={styles.ceActions}>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onClose}
            >
              {mode === 'post-create' ? 'Skip for now' : 'Cancel'}
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              disabled={!canSend}
              onClick={onSend}
            >
              <IconSend size={13} />
              {sendMut.isPending ? 'Sending…' : 'Send to members'}
            </button>
          </div>
        </div>

        {sendMut.isError ? (
          <div
            style={{
              padding: '10px 22px',
              borderTop: '1px solid var(--c-hair)',
              color: '#dc2626',
              fontSize: 12,
            }}
          >
            Couldn&apos;t send: {(sendMut.error as Error).message}
          </div>
        ) : null}
      </div>

      {confirmOpen ? (
        <ConfirmSendDialog
          eventTitle={event.title}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={onConfirmSend}
          pending={sendMut.isPending}
        />
      ) : null}
    </div>
  )
}

function ConfirmSendDialog({
  eventTitle,
  onCancel,
  onConfirm,
  pending,
}: {
  eventTitle: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <div
      className={styles.modalBackdrop}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm send"
      // Nested above the composer.
      style={{ zIndex: 110 }}
    >
      <div
        className={styles.ceModal}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className={styles.ceHead}>
          <div className={styles.ceTitle}>Send to all members?</div>
        </div>
        <div className={styles.ceBody} style={{ gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--c-ink)' }}>
            Every enrolled member of this course will get a bell
            notification and an email about{' '}
            <strong>{eventTitle}</strong>.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--c-muted)' }}>
            This can&apos;t be undone. Make sure your preview looks right.
          </p>
        </div>
        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft} />
          <div className={styles.ceActions}>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              onClick={onConfirm}
              disabled={pending}
            >
              <IconSend size={13} />
              {pending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
