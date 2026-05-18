'use client'

import {
  AITransformAction,
  useAITransformNewsletterPost,
} from '@/hooks/queries/newsletters'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

// Selection-anchored AI assist. Sits inside the editor canvas; the
// parent decides when to mount it (we mount on a non-empty selection
// inside a text-bearing block) and where (we read the current
// Selection's rect on every mount).
//
// Flow:
//   1. Parent renders <AIPopover .../> when selection lives inside the
//      editor's body.
//   2. Popover positions itself above the selection rect.
//   3. User clicks an action. We POST to /ai-transform with the
//      selected text; on success the parent's `onApply(text)` swaps
//      the selection for the new text.
//   4. The popover closes on apply, cancel, or outside click.

export type AIAnchor = {
  /** Selected text from the editor. */
  text: string
  /** Viewport rect to anchor against. */
  rect: { left: number; top: number; right: number; bottom: number }
}

export function AIPopover({
  postId,
  anchor,
  onApply,
  onClose,
}: {
  postId: string
  anchor: AIAnchor
  onApply: (next: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mutation = useAITransformNewsletterPost()
  const [toneOpen, setToneOpen] = useState(false)
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'loading'; action: AITransformAction }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  // Click-outside dismiss. Delay one tick so the click that opened us
  // (which may not have settled yet) doesn't immediately close.
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      onClose()
    }
    const t = window.setTimeout(
      () => window.addEventListener('mousedown', fn),
      0,
    )
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', fn)
    }
  }, [onClose])

  // Esc closes.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const run = async (action: AITransformAction, tone?: string) => {
    setStatus({ kind: 'loading', action })
    try {
      const result = await mutation.mutateAsync({
        postId,
        text: anchor.text,
        action,
        tone,
      })
      onApply(result.text)
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'AI transform failed',
      })
    }
  }

  // Anchor above the selection. Clamp to the viewport so an edge-of-
  // screen selection doesn't push the popover off-screen.
  const top = Math.max(8, anchor.rect.top - 220)
  const left = Math.min(
    window.innerWidth - 308,
    Math.max(8, anchor.rect.left),
  )

  const loading = status.kind === 'loading'

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="AI assist"
      style={{
        position: 'fixed',
        top,
        left,
        width: 280,
        zIndex: 70,
        background: '#fff',
        border: '1px solid #e5e5ea',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(20,20,30,0.18)',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#86868b',
          fontWeight: 600,
          borderBottom: '1px solid #f0f0f3',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Icon name="sparkles" size={12} /> Polish with AI
      </div>

      {!toneOpen ? (
        <>
          <Item
            icon="sparkles"
            label="Polish writing"
            onClick={() => run('polish')}
            disabled={loading}
            loading={status.kind === 'loading' && status.action === 'polish'}
          />
          <Item
            icon="arrow-down"
            label="Make shorter"
            onClick={() => run('shorter')}
            disabled={loading}
            loading={status.kind === 'loading' && status.action === 'shorter'}
          />
          <Item
            icon="arrow-up"
            label="Make longer"
            onClick={() => run('longer')}
            disabled={loading}
            loading={status.kind === 'loading' && status.action === 'longer'}
          />
          <Item
            icon="check"
            label="Fix grammar"
            onClick={() => run('grammar')}
            disabled={loading}
            loading={status.kind === 'loading' && status.action === 'grammar'}
          />
          <Item
            icon="edit"
            label="Change tone…"
            onClick={() => setToneOpen(true)}
            disabled={loading}
          />
        </>
      ) : (
        <ToneSubmenu
          onPick={(tone) => run('tone', tone)}
          onBack={() => setToneOpen(false)}
          loading={loading}
        />
      )}

      {status.kind === 'error' && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: '#c33',
            borderTop: '1px solid #f0f0f3',
          }}
        >
          {status.message}
        </div>
      )}
    </div>
  )
}

function Item({
  icon,
  label,
  onClick,
  disabled,
  loading,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        fontSize: 13,
        color: disabled ? '#c5c5c8' : '#1d1d1f',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f4f4f7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon name={icon} size={13} />
      <span style={{ flex: 1 }}>{label}</span>
      {loading && (
        <span
          aria-label="Working…"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #d1d1d6',
            borderTopColor: '#1d1d1f',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      )}
    </button>
  )
}

const TONES = [
  'Warm',
  'Formal',
  'Playful',
  'Direct',
  'Editorial',
  'Casual',
]

function ToneSubmenu({
  onPick,
  onBack,
  loading,
}: {
  onPick: (tone: string) => void
  onBack: () => void
  loading: boolean
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          fontSize: 12.5,
          color: '#86868b',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Icon name="arrow-left" size={11} /> Back
      </button>
      {TONES.map((tone) => (
        <Item
          key={tone}
          icon="edit"
          label={tone}
          onClick={() => onPick(tone)}
          disabled={loading}
        />
      ))}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
