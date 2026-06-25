'use client'

// Spaire broadcast editor v3 — FRAME (brick 1).
//
// Pixel-exact port of the uploaded design's chrome: top bar, left palette,
// canvas (envelope + email surface), right inspector. Built as real React so
// it's the foundation the live editor engine + blocks mount into next.
//
// Brick 1 scope (this file): the faithful shell + working chrome interactions
// (light/dark theme, Desktop/Mobile stage resize). The live TipTap engine,
// palette inserts, per-block editing and inspector controls are the next
// bricks — each added and verified on top of this frame.

import { EditorContent } from '@tiptap/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { insertBlock, useEmailEditor } from './engine'

import './editor.css'

const WIRED = new Set(['text', 'heading', 'button'])

// ── tiny inline icon set (stroke-based, matches the design's line icons) ──
function I({ d, size = 16, fill }: { d: string; size?: number; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}
const IC = {
  back: 'M15 18l-6-6 6-6',
  caret: 'M6 9l6 6 6-6',
  sun: 'M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  check: 'M20 6L9 17l-5-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  mobile: 'M7 3h10v18H7zM11 18h2',
  drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  dup: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  info: 'M12 8h.01M11 12h1v4h1M12 3a9 9 0 100 18 9 9 0 000-18z',
}

// ── block palette definition (matches the design groups) ──
type PalItem = { key: string; label: string; d: string }
const PALETTE: { group: string; items: PalItem[] }[] = [
  {
    group: 'Course',
    items: [
      { key: 'cover', label: 'Cover', d: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6' },
      { key: 'welcome', label: 'Welcome note', d: 'M4 5h16v11H4zM4 8l8 5 8-5' },
      { key: 'facts', label: 'Course facts', d: 'M4 6h16M4 12h16M4 18h10' },
      { key: 'curriculum', label: 'Curriculum', d: 'M6 4h12v16l-6-3-6 3z' },
      { key: 'progress', label: 'Progress bar', d: 'M3 12h18M3 12a3 3 0 013-3h6v6H6a3 3 0 01-3-3z' },
      { key: 'trailer', label: 'Trailer', d: 'M5 4l14 8-14 8z' },
      { key: 'instructor', label: 'Instructor', d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
      { key: 'cta', label: 'Call to action', d: 'M4 8h12v8H4zM16 12h4l-2-2m2 2l-2 2' },
    ],
  },
  {
    group: 'Content',
    items: [
      { key: 'image', label: 'Image', d: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6' },
      { key: 'heading', label: 'Heading', d: 'M6 4v16M18 4v16M6 12h12' },
      { key: 'text', label: 'Text', d: 'M4 6h16M4 12h16M4 18h10' },
      { key: 'button', label: 'Button', d: 'M3 8h18v8H3zM7 12h10' },
      { key: 'quote', label: 'Quote', d: 'M7 7H5v6h4V9M19 7h-2v6h4V9' },
      { key: 'divider', label: 'Divider', d: 'M4 12h16' },
      { key: 'spacer', label: 'Spacer', d: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4' },
    ],
  },
  { group: 'Footer', items: [{ key: 'footer', label: 'Footer', d: 'M4 4h16v16H4zM4 15h16' }] },
]
const MERGE = ['First name', 'Last name', 'Email', 'Company']

function Ctl({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="ctl">
      <div className="ctl-l">{label}</div>
      {children}
    </div>
  )
}

export function BroadcastEditorV3({
  courseName = 'Southern Cooking',
  momentName = 'Enrolment',
  audienceLabel = 'New enrollments',
  audienceCount = 1204,
}: {
  courseName?: string
  momentName?: string
  audienceLabel?: string
  audienceCount?: number
}) {
  const [dark, setDark] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editor = useEmailEditor()

  const showToast = (m: string) => {
    setToast(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const onPalette = (key: string, label: string) => {
    if (WIRED.has(key)) {
      insertBlock(editor, key as 'text' | 'heading' | 'button')
    } else {
      showToast(`“${label}” block is coming next`)
    }
  }

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  return (
    <div className={'bem' + (dark ? ' dark' : '')}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="topbar">
        <button className="tb-back">
          <I d={IC.back} size={16} /> Broadcasts
        </button>
        <span className="tb-divide" />
        <button className="tb-crumb">
          <span className="tb-course">{courseName}</span>
          <span className="tb-sep">/</span>
          <span className="tb-name">{momentName}</span>
          <span className="tb-caret">
            <I d={IC.caret} size={14} />
          </span>
        </button>
        <span className="tb-status">
          <span className="saved-dot" /> Saved
        </span>
        <div className="tb-actions">
          <button
            className="icon-circ theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle theme"
          >
            <I d={dark ? IC.sun : IC.moon} size={18} />
          </button>
          <div className="btn-split">
            <button className="bs-main">
              <I d={IC.check} size={15} /> Save
            </button>
            <button className="bs-caret">
              <I d={IC.caret} size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Shell ───────────────────────────────────────────── */}
      <div className="shell">
        {/* Palette */}
        <aside className="side">
          {PALETTE.map((g) => (
            <div className="pal-group" key={g.group}>
              <div className="pal-label">{g.group}</div>
              <div className="pal-grid">
                {g.items.map((it) => (
                  <button
                    className="pal-item"
                    key={it.key}
                    data-block={it.key}
                    onClick={() => onPalette(it.key, it.label)}
                  >
                    <span className="pal-droplet">
                      <I d={it.d} size={15} />
                    </span>
                    <span className="pal-t">{it.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="pal-group">
            <div className="pal-label">Personalize</div>
            <div className="merge-wrap">
              {MERGE.map((m) => (
                <button className="merge-chip" key={m}>
                  {'{ }'} {m}
                </button>
              ))}
            </div>
            <div className="merge-hint">
              Click a tag while editing to insert it. We swap in each
              subscriber&apos;s details on send.
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <div className="canvas-col">
          <div className="canvas-head">
            <div className="seg">
              <button
                className={device === 'desktop' ? 'on' : ''}
                onClick={() => setDevice('desktop')}
              >
                <I d={IC.desktop} size={15} /> Desktop
              </button>
              <button
                className={device === 'mobile' ? 'on' : ''}
                onClick={() => setDevice('mobile')}
              >
                <I d={IC.mobile} size={15} /> Mobile
              </button>
            </div>
            <div className="ch-spacer" />
            <span className="ch-meta">
              {audienceCount.toLocaleString('en-US')} enrolled
            </span>
          </div>

          <main className="canvas">
            <div className={'stage' + (device === 'mobile' ? ' mobile' : '')}>
              <div className={'email' + (editor?.isEmpty ? ' empty-hint' : '')}>
                {editor?.isEmpty && (
                  <div className="email-empty">
                    <div className="ee-ic">
                      <I d="M12 5v14M5 12h14" size={20} />
                    </div>
                    Add a block from the left to start your email — Text,
                    Heading or Button.
                  </div>
                )}
                <EditorContent editor={editor} />
              </div>
            </div>
          </main>
        </div>

        {/* Inspector */}
        <aside className="inspector">
          <div className="insp-head">
            <div className="ih-main">
              <span className="ih-k" />
              <span className="ih-t">Email settings</span>
            </div>
          </div>
          <div className="insp-body">
            <div className="ig">
              <div className="ig-h">Details</div>
              <Ctl label="Subject">
                <input className="fld" defaultValue={`Welcome to ${courseName}`} />
              </Ctl>
              <Ctl label="Preview text">
                <input className="fld" defaultValue="Your class is ready. Here's your first lesson." />
              </Ctl>
              <Ctl label="From name">
                <input className="fld" defaultValue="Adaeze Bello" />
              </Ctl>
              <Ctl label="Audience">
                <button className="aud-pill">
                  <span className="aud-dot" />
                  <span className="aud-name">{audienceLabel}</span>
                  <span className="aud-cnt">{audienceCount.toLocaleString('en-US')}</span>
                </button>
              </Ctl>
            </div>
            <div className="ig">
              <div className="ig-h">Canvas</div>
              <Ctl label="Email background">
                <button className="color-trigger">
                  <span className="ct-sw" style={{ background: '#141518' }} />
                  <span className="ct-hex">#141518</span>
                </button>
              </Ctl>
              <Ctl label="Backdrop">
                <button className="color-trigger">
                  <span className="ct-sw" style={{ background: '#0B0C0E' }} />
                  <span className="ct-hex">#0B0C0E</span>
                </button>
              </Ctl>
            </div>
            <div className="insp-empty-note">
              <span className="n-ic">
                <I d={IC.info} size={15} />
              </span>
              Select any block to edit it. Every colour control draws from the
              template&apos;s presets.
            </div>
          </div>
        </aside>
      </div>

      <div className={'toast' + (toast ? ' show' : '')}>
        <span className="tk">
          <I d={IC.check} size={15} />
        </span>
        <span>{toast}</span>
      </div>
    </div>
  )
}
