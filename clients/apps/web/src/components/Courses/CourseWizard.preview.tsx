'use client'

import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useState } from 'react'

type DraftState = {
  name: string
  courseTitle: string
  desc: string
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

type MediaState = {
  format: 'thumbnail' | 'trailer' | null
  thumbFile: File | null
  videoFile: File | null
  thumbName: string
  videoName: string
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

export function LandingPreview({
  instructor,
  course,
  media,
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
  media: MediaState
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  editOpen: boolean
  setEditOpen: (open: boolean) => void
  onGenerate: () => void
  onBack: () => void
  onClose: () => void
  error: string | null
}) {
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const isVideo = media.format === 'trailer' && !!media.videoFile
  const file = media.format === 'trailer' ? media.videoFile : media.thumbFile

  useEffect(() => {
    if (!file) {
      setBgUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setBgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

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
      }}
    >
      {/* Background media */}
      {bgUrl ? (
        isVideo ? (
          <video
            src={bgUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          }}
        />
      )}

      {/* Left gradient vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.80) 22%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Bottom vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%)',
        }}
      />

      {/* Class TA badge */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          borderRadius: 100,
          fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 500,
          color: '#fff',
          letterSpacing: '-0.01em',
          boxShadow: '0 2px 12px rgba(109,40,217,0.5)',
          userSelect: 'none',
          zIndex: 30,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1l1.2 3.6H11L8.1 6.9 9.3 11 6 8.7 2.7 11l1.2-4.1L1 4.6h3.8z"
            fill="white"
          />
        </svg>
        Class TA
      </div>

      {/* Top-left: back + close */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '7px 14px',
            borderRadius: 100,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <CloseIcon style={{ fontSize: 18 }} />
        </button>
      </div>

      {/* ── Centered content column (positioned bottom-left) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          padding: '0 64px 72px',
          width: 'min(620px, 50vw)',
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
            fontSize: 'clamp(64px, 7.5vw, 112px)',
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

        {/* Separator — centered */}
        <div
          style={{
            width: 30,
            height: 2.5,
            background: '#fff',
            margin: '22px auto 18px',
            flexShrink: 0,
          }}
        />

        {/* Course title */}
        <div
          onClick={() => setEditOpen(true)}
          title="Click to edit"
          style={{
            fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
            fontSize: 17,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.96)',
            letterSpacing: '0.005em',
            marginBottom: 32,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          {displayCourse}
        </div>

        {/* Description */}
        {displayDesc && (
          <div
            onClick={() => setEditOpen(true)}
            title="Click to edit"
            style={{
              fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
              fontSize: 13.5,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.65,
              maxWidth: 340,
              marginBottom: 40,
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

        {/* Buttons — centered */}
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
              gap: 7,
              padding: '11px 22px',
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: 100,
              fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
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
              padding: '10px 20px',
              background: 'rgba(30,30,30,0.85)',
              color: '#fff',
              border: 'none',
              borderRadius: 100,
              fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            Edit
          </button>
          <button
            type="button"
            aria-label="Add"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.45)',
              background: 'transparent',
              color: '#fff',
              fontSize: 20,
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
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
