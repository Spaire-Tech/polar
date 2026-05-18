import { CSSProperties, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { SaveStatus } from '../../email-marketing/_components/blockEditor/useAutosave'
import { HelpPopover } from './HelpPopover'

export type EditorMode = 'write' | 'style'

/**
 * Top bar for the newsletter post composer. Three regions:
 *
 *   left   — brand + breadcrumb + status pill
 *   center — readability / word-count / undo-redo / save / info / help / avatar
 *   right  — Write/Style segmented + Publish CTA
 *
 * The center tools layer over `useDocHistory` (undo/redo) and the
 * autosave hook (status pill). Comments / version history are stubs
 * until V2 — the buttons exist to anchor the layout but a click shows
 * a "coming soon" badge.
 */
export function TopBar({
  organizationName,
  newsletterName,
  title,
  status,
  wordCount,
  mode,
  setMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onOpenPalette,
  onPublish,
  userInitials,
  railOpen,
  setRailOpen,
}: {
  organizationName: string
  newsletterName: string | null
  title: string
  status: SaveStatus
  wordCount: number
  mode: EditorMode
  setMode: (next: EditorMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onOpenPalette: () => void
  onPublish: () => void
  userInitials: string
  railOpen: boolean
  setRailOpen: (next: boolean) => void
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 56,
        padding: '0 16px',
        borderBottom: '1px solid #e5e5ea',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(180%) blur(12px)',
      }}
    >
      <button
        type="button"
        title={railOpen ? 'Hide sidebar' : 'Show sidebar'}
        aria-label={railOpen ? 'Hide sidebar' : 'Show sidebar'}
        onClick={() => setRailOpen(!railOpen)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: '1px solid #e5e5ea',
          background: railOpen ? '#f0f0f3' : '#fff',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          color: '#3a3a3c',
        }}
      >
        <Icon name="list" size={13} />
      </button>
      <Brand />
      <Breadcrumb
        organizationName={organizationName}
        newsletterName={newsletterName}
        title={title}
      />
      <StatusPill status={status} />

      <div style={{ flex: 1 }} />

      <CenterTools
        wordCount={wordCount}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onSave={onSave}
        onOpenPalette={onOpenPalette}
        userInitials={userInitials}
      />

      <div style={{ flex: 1 }} />

      <ModeSwitcher mode={mode} setMode={setMode} />
      <PublishButton onClick={onPublish} />
    </header>
  )
}

function Brand() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontWeight: 600,
        fontSize: 14,
        color: '#1d1d1f',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: '#1d1d1f',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        S
      </div>
      Spaire
    </div>
  )
}

function Breadcrumb({
  organizationName,
  newsletterName,
  title,
}: {
  organizationName: string
  newsletterName: string | null
  title: string
}) {
  const sepStyle: CSSProperties = { color: '#c5c5c8', margin: '0 6px' }
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 13,
        color: '#86868b',
        minWidth: 0,
      }}
    >
      <span style={sepStyle}>/</span>
      <span style={{ whiteSpace: 'nowrap' }}>{organizationName}</span>
      {newsletterName && (
        <>
          <span style={sepStyle}>/</span>
          <span style={{ whiteSpace: 'nowrap' }}>{newsletterName}</span>
        </>
      )}
      <span style={sepStyle}>/</span>
      <span
        style={{
          color: '#1d1d1f',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 260,
        }}
      >
        {title || 'Untitled'}
      </span>
    </div>
  )
}

function StatusPill({ status }: { status: SaveStatus }) {
  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'error'
        ? 'Save failed'
        : 'Synced'
  const dotColor =
    status === 'error'
      ? '#c33'
      : status === 'saving'
        ? '#86868b'
        : '#1a7a3e'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px 4px 10px',
        border: '1px solid #e5e5ea',
        borderRadius: 999,
        fontSize: 11.5,
        color: '#3a3a3c',
        marginLeft: 4,
      }}
    >
      <span style={{ color: '#86868b' }}>Draft</span>
      <span
        style={{
          width: 1,
          height: 10,
          background: '#e5e5ea',
        }}
      />
      <span>{label}</span>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: dotColor,
        }}
      />
    </span>
  )
}

function CenterTools({
  wordCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onOpenPalette,
  userInitials,
}: {
  wordCount: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onOpenPalette: () => void
  userInitials: string
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: '#fafafa',
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        position: 'relative',
      }}
    >
      <ToolButton title="Readability (coming soon)" icon="trending-up" disabled />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 6px',
          fontSize: 11.5,
          color: '#3a3a3c',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Icon name="text" size={12} /> {wordCount.toLocaleString()} words
      </span>

      <Divider />

      <ToolButton
        title="Undo (⌘Z)"
        icon="arrow-left"
        onClick={onUndo}
        disabled={!canUndo}
      />
      <ToolButton
        title="Redo (⇧⌘Z)"
        icon="arrow-right"
        onClick={onRedo}
        disabled={!canRedo}
      />

      <Divider />

      <ToolButton
        title="Search & commands (⌘K)"
        icon="search"
        onClick={onOpenPalette}
      />
      <ToolButton title="Insert link (coming soon)" icon="link" disabled />
      <ToolButton title="Comments (coming soon)" icon="mail" disabled />
      <ToolButton title="Version history (coming soon)" icon="rotate" disabled />
      <ToolButton title="Save (⌘S)" icon="download" onClick={onSave} />

      <Divider />

      <ToolButton title="Document info (coming soon)" icon="info" disabled />
      <div style={{ position: 'relative' }}>
        <ToolButton
          title="Help & shortcuts"
          icon="zap"
          onClick={() => setHelpOpen((v) => !v)}
        />
        {helpOpen && (
          <HelpPopover onClose={() => setHelpOpen(false)} />
        )}
      </div>

      <Divider />

      <span
        title="You"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: '#1d1d1f',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          fontWeight: 600,
          marginLeft: 2,
        }}
      >
        {userInitials || '·'}
      </span>
    </div>
  )
}

function ToolButton({
  title,
  icon,
  onClick,
  disabled,
}: {
  title: string
  icon: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 24,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#c5c5c8' : '#3a3a3c',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f0f0f3'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, height: 16, background: '#e5e5ea', margin: '0 2px' }}
    />
  )
}

function ModeSwitcher({
  mode,
  setMode,
}: {
  mode: EditorMode
  setMode: (next: EditorMode) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 2,
        border: '1px solid #e5e5ea',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      <SegItem on={mode === 'write'} onClick={() => setMode('write')}>
        Write
      </SegItem>
      <SegItem on={mode === 'style'} onClick={() => setMode('style')}>
        Style
      </SegItem>
    </div>
  )
}

function SegItem({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        border: 'none',
        background: on ? '#fff' : 'transparent',
        color: on ? '#1d1d1f' : '#86868b',
        fontSize: 12.5,
        fontWeight: on ? 500 : 400,
        borderRadius: 6,
        cursor: 'pointer',
        boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function PublishButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 14px',
        borderRadius: 8,
        border: 'none',
        background: '#4f46e5',
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      Publish
      <Icon name="arrow-right" size={13} />
    </button>
  )
}
