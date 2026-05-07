'use client'

import React, { useEffect, useRef, useState } from 'react'

// ─── Shared primitives — verbatim port of `primitives.jsx` from the prototype.
// Inline styles are intentional. Do NOT refactor to Tailwind.
//
// The tweak system has been removed: indigo is hardcoded to `#312E81`, and the
// primary button is hardcoded to "solid black".

const INDIGO_HEX = '#312E81'
const INDIGO_RING = INDIGO_HEX + '33'

// ─── Shared <style> tag injected once per wizard mount ──────────────────────
export function CoachingWizardStyles() {
  return (
    <>
      {/* Inter is not loaded globally; Instrument Serif is. Pull both. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .coaching-wizard {
          --indigo: ${INDIGO_HEX};
          --indigo-soft: #4F46E5;
          --indigo-tint: #EEF2FF;
          --indigo-ring: ${INDIGO_RING};
          --ink: #0A0A0A;
          --ink-2: #1A1A1A;
          --muted: #6B6B70;
          --muted-2: #8E8E93;
          --line: #E5E5EA;
          --line-2: #F2F2F4;
          --bg: #FFFFFF;
          --bg-soft: #FAFAFA;
          --radius-sm: 10px;
          --radius: 14px;
          --radius-lg: 20px;

          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
          background: var(--bg);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .coaching-wizard *, .coaching-wizard *::before, .coaching-wizard *::after { box-sizing: border-box; }
        .coaching-wizard button { font-family: inherit; }
        .coaching-wizard input, .coaching-wizard textarea, .coaching-wizard select { font-family: inherit; }
        .coaching-wizard input:focus, .coaching-wizard textarea:focus { outline: none; }
        .coaching-wizard ::placeholder { color: #B5B5BA; }
        .coaching-wizard .serif-num { font-family: 'Instrument Serif', serif; font-weight: 400; font-style: italic; letter-spacing: -0.02em; }
        .coaching-wizard .pane::-webkit-scrollbar { width: 8px; }
        .coaching-wizard .pane::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        .coaching-wizard .pane::-webkit-scrollbar-track { background: transparent; }

        @keyframes coachingShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .coaching-wizard .sk {
          display: inline-block;
          background: linear-gradient(90deg, #EEEEF1 0%, #F7F7F9 50%, #EEEEF1 100%);
          background-size: 200% 100%;
          animation: coachingShimmer 1.4s linear infinite;
          border-radius: 4px;
          height: 12px;
        }
        .coaching-wizard .sk-dark {
          background: linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 100%);
          background-size: 200% 100%;
          animation: coachingShimmer 1.4s linear infinite;
        }
        @keyframes coachingFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .coaching-wizard .fade-up { animation: coachingFadeUp 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @keyframes coachingSlideIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .coaching-wizard .slide-in { animation: coachingSlideIn 0.35s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @keyframes coachingPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .coaching-wizard .pop { animation: coachingPop 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both; }

        @keyframes coachingScrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes coachingScrollDown {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
        @keyframes coachingPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes coachingConfetti {
          0% { transform: translateY(0) rotate(0); opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
        @keyframes coachingSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

// ─── StepHeader ─────────────────────────────────────────────────────────────
export function StepHeader({
  step,
  total,
  headline,
  helper,
  recommended,
}: {
  step: number
  total: number
  headline: string
  helper?: string
  recommended?: boolean
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          letterSpacing: '0.02em',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 500,
        }}
      >
        <span>
          Step {step} of {total}
        </span>
        {recommended && (
          <>
            <span
              style={{
                width: 3,
                height: 3,
                background: 'var(--muted-2)',
                borderRadius: '50%',
              }}
            />
            <span>Recommended</span>
          </>
        )}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 36,
          lineHeight: 1.08,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
        }}
      >
        {headline}
      </h1>
      {helper && (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 15.5,
            color: 'var(--muted)',
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          {helper}
        </p>
      )}
    </div>
  )
}

// ─── Label ──────────────────────────────────────────────────────────────────
export function Label({
  children,
  optional,
  htmlFor,
}: {
  children: React.ReactNode
  optional?: boolean
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13.5,
        fontWeight: 500,
        color: 'var(--ink)',
        marginBottom: 8,
      }}
    >
      <span>{children}</span>
      {optional && (
        <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}>
          Optional
        </span>
      )}
    </label>
  )
}

// ─── TextInput ──────────────────────────────────────────────────────────────
export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  prefix,
  suffix,
  id,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  id?: string
  autoFocus?: boolean
}) {
  const [focus, setFocus] = useState(false)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${focus ? 'var(--indigo)' : 'var(--line)'}`,
        borderRadius: 'var(--radius-sm)',
        background: '#fff',
        boxShadow: focus ? `0 0 0 3px var(--indigo-ring)` : 'none',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        overflow: 'hidden',
      }}
    >
      {prefix && (
        <span
          style={{
            padding: '0 4px 0 14px',
            color: 'var(--muted)',
            fontSize: 15,
            userSelect: 'none',
          }}
        >
          {prefix}
        </span>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          padding: '13px 14px',
          fontSize: 15,
          color: 'var(--ink)',
          minWidth: 0,
        }}
      />
      {suffix && (
        <span
          style={{
            padding: '0 14px 0 4px',
            color: 'var(--muted)',
            fontSize: 14,
            userSelect: 'none',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── TextArea ───────────────────────────────────────────────────────────────
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  id,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  id?: string
  autoFocus?: boolean
}) {
  const [focus, setFocus] = useState(false)
  return (
    <div
      style={{
        border: `1px solid ${focus ? 'var(--indigo)' : 'var(--line)'}`,
        borderRadius: 'var(--radius-sm)',
        background: '#fff',
        boxShadow: focus ? `0 0 0 3px var(--indigo-ring)` : 'none',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
      }}
    >
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '13px 14px',
          fontSize: 15,
          color: 'var(--ink)',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
    </div>
  )
}

// ─── PrimaryButton (hardcoded solid black) ─────────────────────────────────
export function PrimaryButton({
  children,
  onClick,
  disabled,
  style = {},
  fullWidth,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
  fullWidth?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'var(--ink)',
        color: '#fff',
        border: '1.5px solid var(--ink)',
        padding: '13px 22px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 15,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition:
          'transform 100ms ease, opacity 150ms ease, background 150ms ease',
        width: fullWidth ? '100%' : 'auto',
        letterSpacing: '-0.005em',
        ...style,
      }}
      onMouseDown={(e) =>
        !disabled && (e.currentTarget.style.transform = 'scale(0.98)')
      }
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  )
}

// ─── GhostButton ────────────────────────────────────────────────────────────
export function GhostButton({
  children,
  onClick,
  style = {},
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        color: 'var(--ink)',
        border: 'none',
        padding: '13px 18px',
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        transition: 'background 150ms ease',
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F5F5F7')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

// ─── SelectCard ─────────────────────────────────────────────────────────────
export function SelectCard({
  selected,
  onClick,
  title,
  body,
  children,
  layout = 'block',
}: {
  selected?: boolean
  onClick?: () => void
  title: string
  body?: string
  children?: React.ReactNode
  layout?: 'row' | 'block'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: '#fff',
        border: `1.5px solid ${selected ? 'var(--indigo)' : 'var(--line)'}`,
        borderRadius: 'var(--radius)',
        padding: layout === 'row' ? '16px 18px' : '20px',
        cursor: 'pointer',
        boxShadow: selected ? `0 0 0 3px var(--indigo-ring)` : 'none',
        transition:
          'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
        display: 'flex',
        flexDirection: layout === 'row' ? 'row' : 'column',
        alignItems: layout === 'row' ? 'center' : 'stretch',
        gap: layout === 'row' ? 14 : 6,
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        {body && (
          <div
            style={{
              fontSize: 13.5,
              color: 'var(--muted)',
              lineHeight: 1.45,
            }}
          >
            {body}
          </div>
        )}
        {children}
      </div>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${selected ? 'var(--indigo)' : '#D5D5DA'}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          transition: 'border-color 150ms ease',
        }}
      >
        {selected && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--indigo)',
            }}
          />
        )}
      </div>
    </button>
  )
}

// ─── Segmented ──────────────────────────────────────────────────────────────
type SegmentedOption = string | { value: string; label: string }
export function Segmented({
  options,
  value,
  onChange,
  disabled = {},
}: {
  options: SegmentedOption[]
  value: string
  onChange: (v: string) => void
  disabled?: Record<string, boolean>
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        background: '#F2F2F4',
        padding: 3,
        borderRadius: 10,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const isDisabled = !!disabled[v]
        const selected = value === v
        return (
          <button
            type="button"
            key={v}
            onClick={() => !isDisabled && onChange(v)}
            disabled={isDisabled}
            style={{
              border: 'none',
              background: selected ? '#fff' : 'transparent',
              color: isDisabled
                ? '#C5C5CA'
                : selected
                  ? 'var(--ink)'
                  : 'var(--muted)',
              padding: '8px 14px',
              fontSize: 13.5,
              fontWeight: 500,
              borderRadius: 8,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              boxShadow: selected
                ? '0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)'
                : 'none',
              transition: 'background 150ms ease, color 150ms ease',
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle ─────────────────────────────────────────────────────────────────
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        background: '#fff',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}
          >
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: checked ? 'var(--ink)' : '#E0E0E5',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 200ms ease',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow:
              '0 1px 2px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08)',
            transition: 'left 200ms cubic-bezier(0.2, 0.7, 0.2, 1)',
          }}
        />
      </button>
    </div>
  )
}

// ─── DropZone ───────────────────────────────────────────────────────────────
//
// Two operating modes:
//   1. Boolean mode (legacy / trailer): pass `filled` + `onClick`. The button
//      toggles a boolean in parent state. No file picker is involved.
//   2. Upload mode: pass `imageUrl` + `onUpload`. Clicking opens the native
//      file picker; when the user picks a file we call `onUpload(file)` which
//      returns the persisted URL. While the upload is in flight we show a
//      spinner overlay. When complete the URL is rendered as a background
//      image filling the drop zone.
export function DropZone({
  filled,
  onClick,
  label,
  helper,
  aspect = '16/9',
  shape = 'rect',
  filename,
  duration,
  imageUrl,
  onUpload,
  uploading: uploadingProp,
  accept = 'image/*',
}: {
  filled?: boolean
  onClick?: () => void
  label: string
  helper?: string
  aspect?: string
  shape?: 'rect' | 'circle'
  filename?: string | null
  duration?: string | null
  imageUrl?: string | null
  onUpload?: (file: File) => Promise<string | null>
  uploading?: boolean
  accept?: string
}) {
  const isCircle = shape === 'circle'
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [internalUploading, setInternalUploading] = useState(false)
  const uploading = uploadingProp || internalUploading
  const hasImage = !!imageUrl
  const isFilled = hasImage || !!filled

  const handleClick = () => {
    if (uploading) return
    if (onUpload) {
      inputRef.current?.click()
      return
    }
    onClick?.()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpload) return
    setInternalUploading(true)
    try {
      await onUpload(file)
    } finally {
      setInternalUploading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        border: isFilled
          ? '1.5px solid var(--indigo)'
          : '1.5px dashed var(--line)',
        background: hasImage
          ? `center / cover no-repeat url(${JSON.stringify(imageUrl)}), #FBFBFC`
          : isFilled
            ? 'var(--indigo-tint)'
            : '#FBFBFC',
        borderRadius: isCircle ? '50%' : 'var(--radius)',
        aspectRatio: isCircle ? '1 / 1' : aspect,
        width: '100%',
        cursor: uploading ? 'progress' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        transition: 'border-color 150ms ease, background 150ms ease',
        fontFamily: 'inherit',
        boxShadow: isFilled ? `0 0 0 3px var(--indigo-ring)` : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!isFilled) e.currentTarget.style.borderColor = '#C5C5CA'
      }}
      onMouseLeave={(e) => {
        if (!isFilled) e.currentTarget.style.borderColor = 'var(--line)'
      }}
    >
      {onUpload && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}
      {!isFilled && !uploading && (
        <>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--ink)',
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          {helper && (
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--muted)',
                textAlign: 'center',
              }}
            >
              {helper}
            </div>
          )}
        </>
      )}
      {isFilled && !hasImage && !uploading && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--indigo)' }}
          >
            {filename || 'Uploaded'}
          </div>
          {duration && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {duration}
            </div>
          )}
        </div>
      )}
      {uploading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasImage ? 'rgba(255,255,255,0.55)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner />
        </div>
      )}
    </button>
  )
}

// ─── Spinner ───────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        border: '2px solid rgba(0,0,0,0.15)',
        borderTopColor: 'var(--ink)',
        borderRadius: '50%',
        animation: 'coachingSpin 0.7s linear infinite',
      }}
    />
  )
}

// ─── Field ──────────────────────────────────────────────────────────────────
export function Field({
  label,
  optional,
  children,
  hint,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <Label optional={optional}>{label}</Label>
      {children}
      {hint && (
        <div
          style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 6 }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

// ─── Reveal ─────────────────────────────────────────────────────────────────
export function Reveal({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [h, setH] = useState<number | 'auto'>(open ? 'auto' : 0)
  useEffect(() => {
    if (!ref.current) return
    if (open) {
      const target = ref.current.scrollHeight
      setH(target)
      const t = setTimeout(() => setH('auto'), 350)
      return () => clearTimeout(t)
    } else {
      const target = ref.current.scrollHeight
      setH(target)
      requestAnimationFrame(() => setH(0))
    }
  }, [open])
  return (
    <div
      style={{
        height: h,
        overflow: 'hidden',
        transition: 'height 320ms cubic-bezier(0.2, 0.7, 0.2, 1)',
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  )
}
