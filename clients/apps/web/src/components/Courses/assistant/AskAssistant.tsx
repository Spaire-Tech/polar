'use client'

/* ============================================================
   Course Assistant — student "Ask {name}" chat (Phase 4)
   Floating launcher → office-hours sheet. Grounded answers stream
   from the creator's approved, course-only assistant, in their voice.
   Ported from the Ask-Carla design; wired to the live endpoints.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  type AskCitation,
  streamAsk,
  useCourseAssistantStatus,
} from '@/hooks/queries/courseAssistant'

import './askAssistant.css'

interface AskAssistantProps {
  courseId: string
  token: string
}

const SF = {
  close: 'M6 6l12 12M18 6 6 18',
  send: 'M21 3 3 11l7 2.6L13 21l8-18Z',
  check: 'm5 12.5 4.5 4.5L19 6.5',
  book: 'M5 4.5h9a2.5 2.5 0 0 1 2.5 2.5v12.5 M5 4.5A1.5 1.5 0 0 0 3.5 6v12a1.5 1.5 0 0 0 1.5 1.5h11.5 M8 9h5.5 M8 12.5h5.5',
  user: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M5 20a7 7 0 0 1 14 0',
  chevron: 'm9 6 6 6-6 6',
}

function Glyph({
  d,
  size = 24,
  stroke = 2,
  fill = 'none',
}: {
  d: string
  size?: number
  stroke?: number
  fill?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i ? 'M' : '') + seg} />
      ))}
    </svg>
  )
}

function VerifiedSeal({ size = 14 }: { size?: number }) {
  return (
    <span className="vseal" style={{ width: size + 4, height: size + 4 }}>
      <Glyph d={SF.check} size={size - 3} stroke={2.8} />
    </span>
  )
}

// Letter avatar — the status payload carries no portrait, so we render the
// instructor's initial rather than a stock photo.
function Ava({ name, className }: { name: string; className: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        background: 'var(--fill-2)',
        color: 'var(--text)',
        fontWeight: 700,
      }}
    >
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  )
}

interface ChatMessage {
  role: 'user' | 'ta'
  text: string
  citations?: AskCitation[]
}

const firstName = (n: string | null | undefined) =>
  (n ?? '').trim().split(/\s+/)[0] || ''

function Citations({ cites }: { cites?: AskCitation[] }) {
  const usable = (cites ?? []).filter((c) => c.cited_text)
  if (!usable.length) return null
  return (
    <div className="m-cites">
      <div className="m-cites-h">
        <Glyph d={SF.book} size={14} stroke={1.9} /> From your lessons
      </div>
      {usable.map((c, i) => (
        <div className="cite" key={i} style={{ cursor: 'default' }}>
          <span className="cite-main">
            <span className="cl">{c.document_title || 'From the course'}</span>
            <span className="cm">
              “
              {(c.cited_text ?? '').length > 140
                ? (c.cited_text ?? '').slice(0, 140) + '…'
                : c.cited_text}
              ”
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function TAMessage({
  m,
  name,
  streaming,
}: {
  m: ChatMessage
  name: string
  streaming: boolean
}) {
  const paras = m.text.split(/\n{2,}/).filter(Boolean)
  return (
    <div className="msg-ta">
      <Ava name={name} className="m-ava" />
      <div className="m-body">
        <div className="m-name">
          <span className="nm">{name}</span>
          <span className="tag">AI</span>
        </div>
        {streaming && m.text.length === 0 ? (
          <div className="typing">
            <i></i>
            <i></i>
            <i></i>
          </div>
        ) : (
          paras.map((p, i) => (
            <p className="m-p" key={i}>
              {p}
            </p>
          ))
        )}
        {!streaming && <Citations cites={m.citations} />}
      </div>
    </div>
  )
}

function TrustCard({
  fullName,
  onClose,
  onAsk,
}: {
  fullName: string
  onClose: () => void
  onAsk: () => void
}) {
  return (
    <div
      className="mind-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="mind-card">
        <button className="mind-x" onClick={onClose} aria-label="Close">
          <Glyph d={SF.close} size={14} stroke={2.3} />
        </button>
        <div className="trust-head">
          <Ava name={fullName} className="trust-ava" />
          <div className="trust-id">
            <div className="trust-name">
              {fullName} <VerifiedSeal />
            </div>
            <div className="trust-role">Your instructor</div>
          </div>
        </div>

        <div className="trust-list">
          <div className="trust-row">
            <span className="trust-ico">
              <Glyph d={SF.user} size={18} stroke={1.9} />
            </span>
            <span className="trust-tx">
              <strong>{firstName(fullName)}’s official assistant.</strong> Their
              voice and their teaching — not a generic chatbot.
            </span>
          </div>
          <div className="trust-row">
            <span className="trust-ico">
              <Glyph d={SF.book} size={17} stroke={1.9} />
            </span>
            <span className="trust-tx">
              <strong>Answers only from this course.</strong> Every reply is
              drawn from the lessons and points back to the source.
            </span>
          </div>
          <div className="trust-row">
            <span className="trust-ico">
              <Glyph d={SF.check} size={18} stroke={2.2} />
            </span>
            <span className="trust-tx">
              <strong>Reviewed by {firstName(fullName)}.</strong> They approved
              how it answers before it went live.
            </span>
          </div>
        </div>

        <div className="mind-verified">
          <span className="vchk">
            <Glyph d={SF.check} size={11} stroke={2.8} />
          </span>
          Verified &amp; owned by {fullName}
        </div>

        <div className="mind-ctas">
          <button className="mind-cta primary" onClick={onAsk}>
            Ask {firstName(fullName)} anything
          </button>
        </div>
      </div>
    </div>
  )
}

export function AskAssistant({ courseId, token }: AskAssistantProps) {
  const { data: status } = useCourseAssistantStatus(courseId, token)

  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [trustOpen, setTrustOpen] = useState(false)
  const convoRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const launcherName =
    status?.display_name || firstName(status?.instructor_name) || 'your instructor'
  const fullName =
    status?.instructor_name || status?.display_name || 'Your instructor'
  const disclaimer =
    status?.disclaimer || 'AI assistant. Double-check anything important.'

  useEffect(() => {
    const el = convoRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, streaming])

  const ask = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || streaming) return
      setMsgs((m) => [
        ...m,
        { role: 'user', text },
        { role: 'ta', text: '' },
      ])
      setDraft('')
      setStreaming(true)
      const appendToLastTA = (fn: (m: ChatMessage) => ChatMessage) =>
        setMsgs((cur) => {
          const next = [...cur]
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'ta') {
              next[i] = fn(next[i])
              break
            }
          }
          return next
        })
      abortRef.current = streamAsk(courseId, token, text, {
        onText: (chunk) =>
          appendToLastTA((m) => ({ ...m, text: m.text + chunk })),
        onCitations: (citations) =>
          appendToLastTA((m) => ({ ...m, citations })),
        onRefusal: (message) =>
          appendToLastTA((m) => ({ ...m, text: m.text || message })),
        onError: (message) =>
          appendToLastTA((m) => ({ ...m, text: m.text || message })),
        onDone: () => setStreaming(false),
      })
    },
    [courseId, token, streaming],
  )

  const doClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 280)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (trustOpen) setTrustOpen(false)
        else if (open) doClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, trustOpen, doClose])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!status?.available) return null

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(130, el.scrollHeight) + 'px'
  }

  return (
    <div className="ta-widget">
      {open && (
        <section className={`ta-sheet ${closing ? 'closing' : ''}`}>
          <header className="ta-head">
            <Ava name={fullName} className="ta-ava" />
            <div className="ta-id">
              <div className="ta-id-top">
                <span className="ta-name">{fullName}</span>
                <button
                  className="ta-seal"
                  onClick={() => setTrustOpen(true)}
                  aria-label="About this assistant"
                >
                  <VerifiedSeal size={13} />
                </button>
              </div>
              <div className="ta-sub">AI assistant · open 24/7</div>
            </div>
            <div className="ta-head-btns">
              <button
                className="ta-iconbtn"
                onClick={doClose}
                aria-label="Close"
              >
                <Glyph d={SF.close} size={15} stroke={2.3} />
              </button>
            </div>
          </header>

          <div className="ta-convo" ref={convoRef}>
            {msgs.length === 0 ? (
              <div className="ta-empty">
                <Ava name={launcherName} className="ta-empty-ava" />
                <div className="ta-empty-t">Office hours with {launcherName}</div>
                <div className="ta-empty-s">Ask anything about the course.</div>
                {status.example_question && (
                  <>
                    <div className="ta-empty-k">Try asking</div>
                    <div className="ta-starters">
                      <button
                        className="starter"
                        onClick={() => ask(status.example_question as string)}
                      >
                        <span className="starter-tx">
                          {status.example_question}
                        </span>
                        <span className="starter-go">
                          <Glyph d={SF.chevron} size={16} stroke={2.2} />
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              msgs.map((m, i) =>
                m.role === 'user' ? (
                  <div className="msg-user" key={i}>
                    <div className="bubble">{m.text}</div>
                  </div>
                ) : (
                  <TAMessage
                    key={i}
                    m={m}
                    name={launcherName}
                    streaming={streaming && i === msgs.length - 1}
                  />
                ),
              )
            )}
          </div>

          <div className="ta-compose">
            <div className="ta-inputrow">
              <textarea
                ref={inputRef}
                className="ta-input"
                rows={1}
                value={draft}
                placeholder={`Ask ${launcherName} anything about the course…`}
                onChange={(e) => {
                  setDraft(e.target.value)
                  autosize(e.target)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ask(draft)
                    if (inputRef.current) inputRef.current.style.height = 'auto'
                  }
                }}
              />
              <button
                className="ta-send"
                disabled={!draft.trim() || streaming}
                onClick={() => {
                  ask(draft)
                  if (inputRef.current) inputRef.current.style.height = 'auto'
                }}
                aria-label="Send"
              >
                <Glyph d={SF.send} size={19} fill="currentColor" />
              </button>
            </div>
            <div className="ta-fine">{disclaimer}</div>
          </div>
        </section>
      )}

      {!open && (
        <button className="ta-launcher" onClick={() => setOpen(true)}>
          <span className="lc-ava-wrap">
            <Ava name={launcherName} className="lc-ava" />
            <span className="lc-dot"></span>
          </span>
          <span className="lc-txt">
            <span className="lc-t">Ask {launcherName}</span>
            <span className="lc-s">Office hours · open 24/7</span>
          </span>
        </button>
      )}

      {trustOpen && (
        <TrustCard
          fullName={fullName}
          onClose={() => setTrustOpen(false)}
          onAsk={() => {
            setTrustOpen(false)
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 60)
          }}
        />
      )}
    </div>
  )
}
