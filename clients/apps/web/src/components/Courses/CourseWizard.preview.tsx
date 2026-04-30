'use client'

import CloseIcon from '@mui/icons-material/Close'

type DraftState = {
  name: string
  courseTitle: string
  desc: string
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

type PricingState = {
  isFree: boolean
  amount: number
}

function EditPanel({
  open,
  draft,
  setDraft,
  onClose,
}: {
  open: boolean
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        background: 'rgba(12,12,12,0.92)',
        backdropFilter: 'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 300,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(242,241,238,0.7)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Edit page
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close edit panel"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(242,241,238,0.4)',
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <PanelSection label="Instructor name">
          <PanelInput
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <StyleToggle
              active={draft.nameItalic}
              onClick={() =>
                setDraft((d) => ({ ...d, nameItalic: !d.nameItalic }))
              }
              label="Italic"
              italic
            />
            <StyleToggle
              active={draft.nameBold}
              onClick={() =>
                setDraft((d) => ({ ...d, nameBold: !d.nameBold }))
              }
              label="Bold"
              bold
            />
            <StyleToggle
              active={draft.nameUppercase}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  nameUppercase: !d.nameUppercase,
                }))
              }
              label="ALL CAPS"
            />
          </div>
        </PanelSection>

        <PanelSection label="Course title">
          <PanelInput
            value={draft.courseTitle}
            onChange={(v) => setDraft((d) => ({ ...d, courseTitle: v }))}
          />
        </PanelSection>

        <PanelSection label="Description">
          <PanelTextarea
            value={draft.desc}
            onChange={(v) => setDraft((d) => ({ ...d, desc: v }))}
          />
        </PanelSection>
      </div>
      <div
        style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: 13,
            background: '#fff',
            color: '#080808',
            border: 'none',
            borderRadius: 100,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Save changes
        </button>
      </div>
    </div>
  )
}

function PanelSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'rgba(242,241,238,0.35)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function PanelInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 300,
        color: '#f2f1ee',
        outline: 'none',
      }}
    />
  )
}

function PanelTextarea({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 300,
        color: '#f2f1ee',
        outline: 'none',
        resize: 'none',
        lineHeight: 1.6,
      }}
    />
  )
}

function StyleToggle({
  active,
  onClick,
  label,
  italic,
  bold,
}: {
  active: boolean
  onClick: () => void
  label: string
  italic?: boolean
  bold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 8,
        background: active
          ? 'rgba(255,255,255,0.14)'
          : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        color: active ? '#fff' : 'rgba(242,241,238,0.5)',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 700 : 400,
      }}
    >
      {label}
    </button>
  )
}

function PriceBadge({ pricing }: { pricing: PricingState }) {
  const label = pricing.isFree
    ? 'Free'
    : `$${pricing.amount % 1 === 0 ? pricing.amount.toFixed(0) : pricing.amount.toFixed(2)}`

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: pricing.isFree
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(255,255,255,0.92)',
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 600,
        color: pricing.isFree ? 'rgba(255,255,255,0.9)' : '#080808',
        letterSpacing: '-0.01em',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: pricing.isFree
          ? '1px solid rgba(255,255,255,0.2)'
          : '1px solid rgba(255,255,255,0.8)',
      }}
    >
      {!pricing.isFree && (
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>
          One-time
        </span>
      )}
      {label}
    </div>
  )
}

export function LandingPreview({
  instructor,
  course,
  pricing,
  draft,
  setDraft,
  editOpen,
  setEditOpen,
  onGenerate,
  onBack,
  onClose,
  error,
}: {
  instructor: { name: string; bio: string }
  course: { title: string; desc: string }
  pricing: PricingState
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  editOpen: boolean
  setEditOpen: (open: boolean) => void
  onGenerate: () => void
  onBack: () => void
  onClose: () => void
  error: string | null
}) {
  const displayName = draft.name || instructor.name || 'Your Name'
  const displayCourse = draft.courseTitle || course.title || 'Your Course Title'
  const displayDesc = draft.desc || course.desc || instructor.bio || ''

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
      }}
    >
      {/* Nav bar */}
      <div
        style={{
          height: 52,
          background: '#000',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 20,
          flexShrink: 0,
          position: 'relative',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '6px 14px',
              borderRadius: 100,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {/* Hero body */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Gradient background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          }}
        />

        {/* Left gradient vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '35%',
            background:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Content column: lower-left, left-aligned */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            padding: '0 88px 110px',
            width: 'min(560px, 44vw)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          {/* Instructor name */}
          <div
            onClick={() => setEditOpen(true)}
            title="Click to edit"
            style={{
              fontFamily: 'var(--font-barlow-condensed), Impact, sans-serif',
              fontWeight: draft.nameBold ? 800 : 700,
              fontStyle: draft.nameItalic ? 'italic' : 'normal',
              fontSize: 'clamp(48px, 4.6vw, 76px)',
              lineHeight: 0.92,
              letterSpacing: '0.01em',
              color: '#fff',
              textTransform: draft.nameUppercase ? 'uppercase' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              width: '100%',
            }}
          >
            {displayName}
          </div>

          {/* Separator */}
          <div
            style={{
              width: 30,
              height: 2,
              background: '#fff',
              margin: '26px auto 22px',
              flexShrink: 0,
            }}
          />

          {/* Course title */}
          <div
            onClick={() => setEditOpen(true)}
            title="Click to edit"
            style={{
              fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
              fontSize: 22,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.98)',
              letterSpacing: '-0.005em',
              marginBottom: 16,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {displayCourse}
          </div>

          {/* Price badge */}
          <div style={{ marginBottom: 20 }}>
            <PriceBadge pricing={pricing} />
          </div>

          {/* Description */}
          {displayDesc && (
            <div
              onClick={() => setEditOpen(true)}
              title="Click to edit"
              style={{
                fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: 15.5,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.78)',
                lineHeight: 1.55,
                maxWidth: 420,
                marginBottom: 36,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {displayDesc}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 14,
                fontSize: 12,
                color: 'rgba(252,165,165,0.95)',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onGenerate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 26px',
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: 100,
                fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
                <path d="M3 1.5l6 4-6 4V1.5z" fill="currentColor" />
              </svg>
              Generate Course
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 24px',
                background: 'rgba(30,30,30,0.85)',
                color: '#fff',
                border: 'none',
                borderRadius: 100,
                fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <EditPanel
        open={editOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setEditOpen(false)}
      />
    </div>
  )
}
