'use client'

// Floating toolbar that anchors to an EditText while it's being edited.
// Lets the user override that specific text's size, weight, italic, and
// underline — independent of every other text on the page.
//
// Anchoring strategy: the toolbar lives inside EditText's render tree and
// positions itself via `position: fixed` against the element's bounding rect.
// Repositions on scroll / resize / value change so it never drifts off the
// text it's editing. Using position:fixed (rather than absolute) sidesteps
// the issue that EditText's parent often has `overflow: hidden` or sticky
// positioning that would clip an absolutely-positioned popover.
//
// Why we don't use Radix Popover for this: Popover anchors to its Trigger,
// which would require either wrapping the EditText in a Trigger (changing
// the rendered DOM tree, which breaks parent flex/grid layouts) or
// imperatively triggering it (which Radix doesn't support cleanly). Fixed
// positioning with a portal is the smaller hammer.

import type { LandingTextFormat } from '@/hooks/queries/courses'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from './EditorContext'

type Props = {
  path: string
  // Element the toolbar should anchor above. The toolbar reads its bounding
  // box and positions itself just above/below.
  anchor: HTMLElement | null
  // Called by toolbar buttons via onMouseDown to keep the user from blurring
  // the contentEditable. The EditText owns the editing state — this just
  // pings it that interaction is happening.
  onInteract?: () => void
}

const SIZE_MIN = 0.5
const SIZE_MAX = 2.0
const SIZE_STEP = 0.1

export function TextFormatToolbar({ path, anchor, onInteract }: Props) {
  const ed = useEditor()
  const fmt: LandingTextFormat = ed.overrides.textFormat[path] ?? {}
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Reposition above the anchor. Recomputes on every render — cheap, and
  // the toolbar is only mounted while editing so this isn't continuous.
  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null)
      return
    }
    const measure = () => {
      const r = anchor.getBoundingClientRect()
      const tbw = toolbarRef.current?.offsetWidth ?? 320
      const tbh = toolbarRef.current?.offsetHeight ?? 36
      // Prefer above the text. If there's not enough room (the text is near
      // the top of the viewport), drop below it instead.
      const above = r.top - tbh - 10
      const below = r.bottom + 10
      const top = above >= 12 ? above : below
      // Centre horizontally relative to the text, clamped to the viewport
      // with an 8px margin on either side.
      const idealLeft = r.left + r.width / 2 - tbw / 2
      const left = Math.max(8, Math.min(idealLeft, window.innerWidth - tbw - 8))
      setPos({ top, left })
    }
    measure()
    // Reposition on viewport scroll/resize. capture:true so we catch
    // scroll events from intermediate scroll containers (the editor canvas
    // is itself scrollable).
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [anchor])

  if (!anchor || !pos) return null

  const sizePct = Math.round((fmt.size ?? 1) * 100)
  const stepSize = (delta: number) => {
    const next = Math.max(
      SIZE_MIN,
      Math.min(SIZE_MAX, +((fmt.size ?? 1) + delta).toFixed(2)),
    )
    // Treat exactly 1.0 as "no override" so the saved payload stays clean.
    ed.setTextFormat(path, { size: next === 1 ? undefined : next })
  }

  // Buttons use onMouseDown + preventDefault so clicking doesn't pull focus
  // off the contentEditable (which would blur and dismiss the toolbar).
  const noBlur = (e: React.MouseEvent) => {
    e.preventDefault()
    onInteract?.()
  }

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        background: 'rgba(20,20,22,0.96)',
        color: 'white',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
      }}
      onMouseDown={noBlur}
    >
      <ToolButton
        label="Decrease size"
        title="Smaller"
        onClick={() => stepSize(-SIZE_STEP)}
        disabled={sizePct <= SIZE_MIN * 100}
      >
        <MinusIcon />
      </ToolButton>
      <span
        aria-live="polite"
        style={{
          minWidth: 38,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sizePct}%
      </span>
      <ToolButton
        label="Increase size"
        title="Larger"
        onClick={() => stepSize(SIZE_STEP)}
        disabled={sizePct >= SIZE_MAX * 100}
      >
        <PlusIcon />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bold"
        title="Bold"
        active={fmt.bold === true}
        onClick={() =>
          ed.setTextFormat(path, {
            bold: fmt.bold === true ? undefined : true,
          })
        }
      >
        <span style={{ fontWeight: 700, fontSize: 13 }}>B</span>
      </ToolButton>
      <ToolButton
        label="Italic"
        title="Italic"
        active={fmt.italic === true}
        onClick={() =>
          ed.setTextFormat(path, {
            italic: fmt.italic === true ? undefined : true,
          })
        }
      >
        <span
          style={{ fontStyle: 'italic', fontSize: 13, fontFamily: 'serif' }}
        >
          I
        </span>
      </ToolButton>
      <ToolButton
        label="Underline"
        title="Underline"
        active={fmt.underline === true}
        onClick={() =>
          ed.setTextFormat(path, {
            underline: fmt.underline === true ? undefined : true,
          })
        }
      >
        <span style={{ textDecoration: 'underline', fontSize: 13 }}>U</span>
      </ToolButton>

      {Object.keys(fmt).length > 0 ? (
        <>
          <Divider />
          <ToolButton
            label="Reset formatting"
            title="Reset to template default"
            onClick={() => ed.setTextFormat(path, null)}
          >
            <ResetIcon />
          </ToolButton>
        </>
      ) : null}
    </div>,
    document.body,
  )
}

function ToolButton({
  label,
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  title?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      disabled={disabled}
      onMouseDown={(e) => {
        // Re-prevent the parent's default just in case — child stopPropagation
        // would block our parent handler.
        e.preventDefault()
        if (!disabled) onClick()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 26,
        borderRadius: 4,
        background: active ? 'rgba(99,102,241,0.85)' : 'transparent',
        color: 'white',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'background-color 100ms ease',
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 18,
        background: 'rgba(255,255,255,0.18)',
        margin: '0 4px',
      }}
    />
  )
}

function MinusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 8h10" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
function ResetIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 4.5A5.5 5.5 0 1 1 2.5 8" />
      <path d="M2.5 2v3h3" />
    </svg>
  )
}

// Re-exported helper used by the parent EditText to compute the merged style
// once per render. Lives here so the role-mapping logic stays co-located with
// the format model.
export function applyTextFormatStyle(
  base: React.CSSProperties | undefined,
  fmt: LandingTextFormat | undefined,
): React.CSSProperties {
  const style: React.CSSProperties = { ...(base ?? {}) }
  if (!fmt) return style
  if (fmt.size != null && fmt.size !== 1) {
    const fs = style.fontSize
    if (typeof fs === 'number') {
      style.fontSize = fs * fmt.size
    } else if (typeof fs === 'string') {
      // Wrap in calc() so percentage/calc/clamp values keep working. Multiple
      // applications of the wrapper would be ugly but only ever happens once
      // per element per render.
      style.fontSize = `calc((${fs}) * ${fmt.size})`
    } else {
      // No explicit base size; emit a relative em so the inherited size
      // still scales.
      style.fontSize = `${fmt.size}em`
    }
  }
  if (fmt.bold === true) style.fontWeight = 700
  if (fmt.italic === true) style.fontStyle = 'italic'
  if (fmt.underline === true) {
    // Append rather than replace so the template's strikethrough/overline
    // (if any) is preserved.
    const existing = (style.textDecoration as string | undefined) ?? ''
    style.textDecoration = existing
      ? existing.includes('underline')
        ? existing
        : `${existing} underline`
      : 'underline'
  }
  return style
}
