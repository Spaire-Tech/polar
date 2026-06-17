'use client'

/**
 * Community Hub (Creator) — shared atoms.
 *
 * Ported from the design handoff (creator-app.jsx): Field, Seg (Apple sliding-pill
 * segmented control), Toggle, Ring, and the cover-image primitives CoverDrop /
 * HeroCover with the drag-to-reposition (object-position) + click-to-replace
 * mechanic. Markup/classnames match hub.css verbatim so styling is 1:1.
 */
import * as React from 'react'
import { Glyph } from './icons'

const { useState, useRef, useEffect, useCallback } = React

/* ---------- Field ---------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

/* ---------- Seg (sliding-pill segmented control) ---------- */
export function Seg({
  value,
  options,
  onChange,
  wide,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  wide?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState({ left: 0, width: 0, ready: false })
  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const idx = Math.max(0, options.indexOf(value))
    const btn = wrap.querySelectorAll<HTMLElement>('.seg-btn')[idx]
    if (btn)
      setThumb({ left: btn.offsetLeft, width: btn.offsetWidth, ready: true })
  }, [value, options])
  useEffect(() => {
    measure()
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(measure)
    return () => ro.disconnect()
  }, [measure])
  return (
    <div ref={wrapRef} className={`seg-ctl${wide ? ' wide' : ''}`}>
      <span
        className="seg-thumb"
        style={{
          transform: `translateX(${thumb.left}px)`,
          width: thumb.width,
          opacity: thumb.ready ? 1 : 0,
        }}
      />
      {options.map((o) => (
        <button
          key={o}
          className={`seg-btn${value === o ? ' on' : ''}`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/* ---------- Toggle ---------- */
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      className={`tog${on ? ' on' : ''}`}
      onClick={onClick}
      aria-pressed={on}
    />
  )
}

/* ---------- Ring (progress) ---------- */
export function Ring({
  pct,
  size = 92,
  stroke = 9,
  label,
  sub,
}: {
  pct: number
  size?: number
  stroke?: number
  label?: React.ReactNode
  sub?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const mid = size / 2
  const off = c * (1 - Math.max(0, Math.min(1, pct / 100)))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="var(--fill-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.3,1,.3,1)' }}
        />
      </svg>
      {label != null && (
        <div className="ring-c">
          <b>{label}</b>
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

/* ---------- image upload helpers ---------- */
/**
 * Reads an image file and hands the consumer BOTH the raw `File` (to upload to
 * S3 for a durable URL) and a data-URL (for instant optimistic preview).
 */
export type CoverFileHandler = (file: File, dataUrl: string) => void

export function readImg(file: File | undefined, cb: CoverFileHandler) {
  if (!file || !file.type.startsWith('image/')) return
  const r = new FileReader()
  r.onload = () => cb(file, r.result as string)
  r.readAsDataURL(file)
}

/** File picker hook → [open(), hiddenInputNode]. */
export function useFilePick(
  onFile: CoverFileHandler,
): [() => void, React.ReactElement] {
  const ref = useRef<HTMLInputElement>(null)
  const node = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={(e) => {
        readImg(e.target.files?.[0], onFile)
        e.target.value = ''
      }}
    />
  )
  return [() => ref.current?.click(), node]
}

/** Parse the Y percentage out of an `object-position` string. */
export function posY(pos?: string | null): number {
  const m = /(\d+(?:\.\d+)?)%\s*$/.exec(pos || '')
  return m ? parseFloat(m[1]) : 50
}

type DragState = { y: number; base: number; h: number; moved: boolean } | null

/* ---------- CoverDrop (form cover: upload + reposition) ---------- */
export function CoverDrop({
  src,
  onFile,
  pos,
  onPos,
}: {
  src?: string | null
  onFile: CoverFileHandler
  pos?: string | null
  onPos?: (pos: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [openPick, input] = useFilePick(onFile)
  const [drag, setDrag] = useState(false)
  const dd = useRef<DragState>(null)
  const canPos = !!src && !!onPos

  const move = useCallback(
    (e: PointerEvent) => {
      const s = dd.current
      if (!s) return
      const dy = e.clientY - s.y
      if (Math.abs(dy) > 3) s.moved = true
      if (s.moved && canPos && onPos) {
        const pct = Math.max(0, Math.min(100, s.base - (dy / s.h) * 100))
        onPos(`center ${pct}%`)
      }
    },
    [canPos, onPos],
  )
  const up = useCallback(() => {
    const s = dd.current
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (s && !s.moved) openPick()
    dd.current = null
  }, [move, openPick])
  const down = (e: React.PointerEvent) => {
    if (e.button) return
    dd.current = {
      y: e.clientY,
      base: posY(pos),
      h: ref.current?.offsetHeight || 200,
      moved: false,
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={ref}
      className={`cover-drop${drag ? ' drag' : ''}${canPos ? ' repos' : ''}`}
      onPointerDown={down}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        readImg(e.dataTransfer.files?.[0], onFile)
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ objectPosition: pos || 'center' }}
          draggable={false}
        />
      ) : (
        <div className="cover-empty">
          <Glyph d="image" size={26} stroke={1.7} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Add a cover</span>
        </div>
      )}
      <div className="cover-over">
        <Glyph d="image" size={22} stroke={1.8} />
        <span className="cv-verb">
          {src ? 'Click to replace' : 'Drop an image or click to upload'}
        </span>
        <span className="cv-sub">
          {canPos ? 'Drag the image to reposition' : 'JPG or PNG · wide crop'}
        </span>
      </div>
      {input}
    </div>
  )
}

/* ---------- HeroCover (masthead: upload + reposition) ---------- */
export function HeroCover({
  src,
  pos,
  onFile,
  onPos,
  children,
}: {
  src?: string | null
  pos?: string | null
  onFile: CoverFileHandler
  onPos: (pos: string) => void
  children?: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [openPick, fileInput] = useFilePick(onFile)
  const d = useRef<DragState>(null)
  const move = useCallback(
    (e: PointerEvent) => {
      const s = d.current
      if (!s) return
      const dy = e.clientY - s.y
      if (Math.abs(dy) > 3) s.moved = true
      if (s.moved) {
        const pct = Math.max(0, Math.min(100, s.base - (dy / s.h) * 100))
        onPos(`center ${pct}%`)
      }
    },
    [onPos],
  )
  const up = useCallback(() => {
    const s = d.current
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (s && !s.moved) openPick()
    d.current = null
  }, [move, openPick])
  const down = (e: React.PointerEvent) => {
    if (e.button) return
    d.current = {
      y: e.clientY,
      base: posY(pos),
      h: ref.current?.offsetHeight || 340,
      moved: false,
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className="mh-cover" ref={ref} onPointerDown={down}>
      {src ? (
        <img
          src={src}
          alt=""
          style={{ objectPosition: pos || 'center 36%' }}
          draggable={false}
        />
      ) : (
        <div className="mh-cover-blank" />
      )}
      <div className="mh-cover-hint">
        <Glyph d="image" size={14} stroke={1.9} /> Click to change{' '}
        <span className="sep">·</span> Drag to reposition
      </div>
      {fileInput}
      {children}
    </div>
  )
}
