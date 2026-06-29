'use client'

// Drag handle that sits between two consecutive sections in the canvas.
// Controls `spacingBefore[nextId]` — i.e. the extra gap above the section
// it precedes. Specific to one pair of sections at a time; never mutates
// other pairs.
//
// Behaviour:
//   * In edit mode: renders a 24px-tall hover zone. The visible chrome
//     (thin line + grip dots) is fully transparent until the user hovers
//     or drags, so the canvas reads as clean.
//   * In preview / public mode: doesn't render at all (the parent gates
//     us on ed.mode === 'edit'). The saved spacing is applied directly
//     to the next EditBlock's marginTop, so visitors see the gap with no
//     editor chrome.
//
// Drag model: pointerdown on the handle captures the pointer + grabs the
// current spacing value as the start. During the drag we update a local
// `dragValue` state (no history frame per pixel). On pointerup we commit
// the final value through ed.setSpacingBefore — one history frame per
// drag, regardless of how far the pointer travelled. This matches Framer
// and Figma's "drag commits once" pattern.

import { useEffect, useRef, useState } from 'react'
import { useEditor } from './EditorContext'

const MAX_EXTRA = 240 // pixels of additional gap a user can add
const MIN_EXTRA = 0

type Props = {
  // Section id this handle precedes. Spacing is stored as spacingBefore[id].
  nextId: string
}

export function SpacingHandle({ nextId }: Props) {
  const ed = useEditor()
  const committed = ed.overrides.spacingBefore[nextId] ?? 0
  // Local state used only while the pointer is captured. Outside a drag,
  // `dragValue` is null and the render reads from `committed`.
  const [dragValue, setDragValue] = useState<number | null>(null)
  const [hover, setHover] = useState(false)
  const dragStartRef = useRef<{ y: number; startValue: number } | null>(null)
  // Pointer id captured on the handle, so we can release it on pointerup.
  const captureRef = useRef<HTMLDivElement>(null)

  const displayValue = dragValue ?? committed
  const dragging = dragValue !== null

  const onPointerDown = (e: React.PointerEvent) => {
    // Only respond to primary pointer (left mouse / first touch).
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = { y: e.clientY, startValue: committed }
    setDragValue(committed)
    captureRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const delta = e.clientY - dragStartRef.current.y
    const next = Math.max(
      MIN_EXTRA,
      Math.min(MAX_EXTRA, dragStartRef.current.startValue + delta),
    )
    setDragValue(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    captureRef.current?.releasePointerCapture(e.pointerId)
    const final = dragValue ?? committed
    dragStartRef.current = null
    setDragValue(null)
    // setSpacingBefore(id, 0 | null) clears the entry — keeps the saved
    // payload clean when the user drags back to zero.
    if (final !== committed) {
      ed.setSpacingBefore(nextId, final === 0 ? null : final)
    }
  }

  // Safety net: if a pointerup is missed (e.g. dragging outside the window),
  // an Escape press cancels the drag and reverts to the committed value.
  useEffect(() => {
    if (!dragging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragStartRef.current = null
        setDragValue(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragging])

  // Hover zone height is constant in edit mode so the handle is always
  // findable, even when the saved spacing is 0. The committed/displayed
  // spacing is APPLIED ON TOP of this zone via marginTop on the spacer
  // below — visitors see only the spacing, never the handle zone.
  const HOVER_ZONE = 24

  return (
    <div
      style={{
        position: 'relative',
        height: HOVER_ZONE + displayValue,
        // Ensure the handle paints above section backgrounds (some sections
        // have full-bleed dark backgrounds that would otherwise occlude
        // hover detection at their top edge).
        zIndex: 5,
      }}
      aria-label="Section spacing"
    >
      {/* The "spacer" — invisible, just produces the gap the user dragged. */}
      <div style={{ height: displayValue }} aria-hidden />

      {/* Interactive zone: thin strip centred in the bottom half of the
          container. We pull it up by half the hover-zone height so the
          interactive area straddles the section boundary, which makes the
          handle catchable by hovering "between" two sections. */}
      <div
        ref={captureRef}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={displayValue}
        aria-valuemin={MIN_EXTRA}
        aria-valuemax={MAX_EXTRA}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onKeyDown={(e) => {
          // Keyboard accessibility: arrow keys nudge by 8px, hold shift for
          // 32px. Same commit-on-release isn't needed — single arrow press
          // is already one history frame.
          const step = e.shiftKey ? 32 : 8
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = Math.min(MAX_EXTRA, committed + step)
            ed.setSpacingBefore(nextId, next === 0 ? null : next)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const next = Math.max(MIN_EXTRA, committed - step)
            ed.setSpacingBefore(nextId, next === 0 ? null : next)
          }
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: HOVER_ZONE,
          cursor: 'ns-resize',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // The chrome inside is what's actually visible. The wrapper stays
          // transparent so the section beneath shines through.
        }}
      >
        <SpacingHandleChrome
          visible={hover || dragging}
          dragging={dragging}
          value={displayValue}
        />
      </div>
    </div>
  )
}

function SpacingHandleChrome({
  visible,
  dragging,
  value,
}: {
  visible: boolean
  dragging: boolean
  value: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 140ms ease',
        pointerEvents: 'none',
      }}
    >
      {/* The horizontal blue line spans the canvas width. Subtle when idle,
          brighter while dragging. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          height: 1,
          background: dragging
            ? 'color-mix(in srgb, var(--color-ce-accent) 95%, transparent)'
            : 'color-mix(in srgb, var(--color-ce-accent) 55%, transparent)',
          transition: 'background-color 100ms ease',
        }}
      />
      {/* Two grip dots flanking the centre, matching the screenshot. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Dot />
        <Dot />
      </span>
      {/* Numeric readout while dragging, anchored above the line. */}
      {dragging ? (
        <span
          style={{
            position: 'absolute',
            top: -22,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(20,20,22,0.92)',
            color: 'white',
            fontSize: 10.5,
            fontWeight: 600,
            fontFamily: 'ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          +{Math.round(value)}px
        </span>
      ) : null}
    </div>
  )
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background:
          'color-mix(in srgb, var(--color-ce-accent) 90%, transparent)',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.7)',
      }}
    />
  )
}
