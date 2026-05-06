// Broadcast composer — modern, breathing-room redesign with template gallery.
//
// This is the broadcast-only replacement for `BlockEditor`. It owns its own
// drag/drop, palette, inspector, and template gallery so the previous
// BlockEditor stays untouched for sequence step editing.

import { useRef, useState } from 'react'
import {
  Block,
  BlockType,
  ChecklistBlock,
  ColumnsBlock,
  ContentDoc,
  EventCardBlock,
  ListBlock,
  ReceiptBlock,
  blankBlock,
  newId,
} from '../blockEditor/types'
import { Icon } from '../Icon'
import {
  EMAIL_TEMPLATES,
  EmailTemplate,
  TemplateBlock,
  applyTemplate,
} from './templates'

const ACCENT_SWATCHES = [
  '#1d1d1f',
  '#4f46e5',
  '#0066CC',
  '#1A7A3E',
  '#D6336C',
  '#FF6B35',
]

const TONES = {
  warm: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #ea580c 100%)',
  cool: 'linear-gradient(135deg, #c7d2fe 0%, #818cf8 50%, #4f46e5 100%)',
  neutral: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
}

type Sender = { name: string; email: string }

export type ImageUploader = (file: File) => Promise<string>

export const Composer = ({
  doc,
  setDoc,
  uploadImage,
  sender,
  // Embedded mode: render without the page-level "Compose" header so the
  // composer can sit inside a fullscreen modal (sequence email editor).
  embedded,
  // Optional editable subject + preview-text strip drawn just under the
  // envelope chrome. Pass undefined to hide the strip entirely.
  subject,
  onSubjectChange,
  previewText,
  onPreviewTextChange,
  // Optional inline Save button on the toolbar.
  onSave,
  saveLabel,
}: {
  doc: ContentDoc
  setDoc: (next: ContentDoc) => void
  uploadImage?: ImageUploader
  sender?: Sender
  embedded?: boolean
  subject?: string
  onSubjectChange?: (next: string) => void
  previewText?: string
  onPreviewTextChange?: (next: string) => void
  onSave?: () => void
  saveLabel?: string
}) => {
  const [selected, setSelected] = useState<string | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const dragId = useRef<string | null>(null)

  const accent = doc.accent ?? '#1d1d1f'
  const setAccent = (c: string) => setDoc({ ...doc, accent: c })
  const setBlocks = (next: Block[]) => setDoc({ ...doc, blocks: next })

  const addBlock = (type: BlockType, atIndex: number | null) => {
    const block = blankBlock(type)
    setBlocks(
      atIndex == null || atIndex >= doc.blocks.length
        ? [...doc.blocks, block]
        : [
            ...doc.blocks.slice(0, atIndex),
            block,
            ...doc.blocks.slice(atIndex),
          ],
    )
    setSelected(block.id)
    setShowPalette(false)
    setInsertAt(null)
  }

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks(
      doc.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
    )
  }

  const removeBlock = (id: string) => {
    setBlocks(doc.blocks.filter((b) => b.id !== id))
    if (selected === id) setSelected(null)
  }

  const duplicateBlock = (id: string) => {
    const idx = doc.blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const copy = { ...doc.blocks[idx], id: newId() }
    setBlocks([
      ...doc.blocks.slice(0, idx + 1),
      copy as Block,
      ...doc.blocks.slice(idx + 1),
    ])
  }

  const moveBlock = (fromId: string, toId: string) => {
    const from = doc.blocks.findIndex((b) => b.id === fromId)
    const to = doc.blocks.findIndex((b) => b.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...doc.blocks]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setBlocks(next)
  }

  const onTemplate = (tpl: EmailTemplate) => {
    setDoc(applyTemplate(tpl))
    setSelected(null)
    setShowTemplates(false)
  }

  const selectedBlock = doc.blocks.find((b) => b.id === selected) ?? null

  return (
    <div style={{ marginBottom: embedded ? 0 : 36 }}>
      {!embedded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <h2 className="h2" style={{ marginBottom: 6 }}>
              Compose
            </h2>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Pick a template, or build it block by block.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowTemplates(true)}
          >
            <Icon name="grid" size={14} />
            Browse templates
          </button>
        </div>
      )}

      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        <Toolbar
          device={device}
          setDevice={setDevice}
          accent={accent}
          setAccent={setAccent}
          onAdd={() => {
            setShowPalette((p) => !p)
            setInsertAt(null)
          }}
          onTemplates={() => setShowTemplates(true)}
          paletteOpen={showPalette}
          itemCount={doc.blocks.length}
          onSave={onSave}
          saveLabel={saveLabel}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selectedBlock ? '1fr 280px' : '1fr',
            minHeight: 640,
            background: '#f0f0f3',
          }}
        >
          <div
            style={{
              padding: '40px 24px 80px',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={() => setSelected(null)}
          >
            <div
              style={{
                background: '#fff',
                maxWidth: device === 'mobile' ? 380 : 600,
                margin: '0 auto',
                borderRadius: 14,
                boxShadow:
                  '0 24px 48px -16px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.04)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <EnvelopeHeader sender={sender} />

              {(subject !== undefined || previewText !== undefined) && (
                <div
                  style={{
                    padding: '16px 36px 14px',
                    borderBottom: '1px solid #efefef',
                    background: '#fff',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {subject !== undefined && (
                    <input
                      value={subject}
                      onChange={(e) => onSubjectChange?.(e.target.value)}
                      placeholder="Subject line…"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 20,
                        fontWeight: 500,
                        letterSpacing: '-0.012em',
                        color: '#1d1d1f',
                        padding: 0,
                        marginBottom: 4,
                        fontFamily: 'inherit',
                      }}
                    />
                  )}
                  {previewText !== undefined && (
                    <input
                      value={previewText}
                      onChange={(e) => onPreviewTextChange?.(e.target.value)}
                      placeholder="Preview text — appears in the inbox after the subject."
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 13,
                        color: '#86868b',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    />
                  )}
                </div>
              )}

              <div style={{ padding: '32px 36px 40px' }}>
                <Inserter
                  visible
                  active={showPalette && insertAt === 0}
                  onClick={() => {
                    setInsertAt(0)
                    setShowPalette(true)
                  }}
                />
                {doc.blocks.map((b, i) => (
                  <div key={b.id}>
                    <EditableBlock
                      block={b}
                      accent={accent}
                      selected={selected === b.id}
                      uploadImage={uploadImage}
                      onSelect={() => setSelected(b.id)}
                      onChange={(patch) => updateBlock(b.id, patch)}
                      onRemove={() => removeBlock(b.id)}
                      onDuplicate={() => duplicateBlock(b.id)}
                      onMoveUp={() =>
                        i > 0 && moveBlock(b.id, doc.blocks[i - 1].id)
                      }
                      onMoveDown={() =>
                        i < doc.blocks.length - 1 &&
                        moveBlock(b.id, doc.blocks[i + 1].id)
                      }
                      isFirst={i === 0}
                      isLast={i === doc.blocks.length - 1}
                      onDragStart={() => {
                        dragId.current = b.id
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragId.current) moveBlock(dragId.current, b.id)
                        dragId.current = null
                      }}
                    />
                    <Inserter
                      active={showPalette && insertAt === i + 1}
                      onClick={() => {
                        setInsertAt(i + 1)
                        setShowPalette(true)
                      }}
                    />
                  </div>
                ))}
                {doc.blocks.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '60px 20px',
                      color: '#86868b',
                    }}
                  >
                    <div style={{ fontSize: 14, marginBottom: 14 }}>
                      This email is empty.
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowTemplates(true)}
                    >
                      <Icon name="grid" size={13} />
                      Pick a template
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '20px 36px 24px',
                  borderTop: '1px solid #efefef',
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#86868b',
                  background: '#fafafa',
                }}
              >
                You're getting this because you subscribed.
                <br />
                <span
                  style={{
                    color: '#86868b',
                    textDecoration: 'underline',
                  }}
                >
                  Unsubscribe
                </span>{' '}
                ·{' '}
                <span
                  style={{
                    color: '#86868b',
                    textDecoration: 'underline',
                  }}
                >
                  Update preferences
                </span>
              </div>
            </div>
          </div>

          {selectedBlock && (
            <Inspector
              block={selectedBlock}
              onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              onClose={() => setSelected(null)}
              onRemove={() => removeBlock(selectedBlock.id)}
              onDuplicate={() => duplicateBlock(selectedBlock.id)}
            />
          )}
        </div>

        {showPalette && (
          <BlockPalette
            onAdd={(t) => addBlock(t, insertAt)}
            onClose={() => {
              setShowPalette(false)
              setInsertAt(null)
            }}
          />
        )}
      </div>

      {showTemplates && (
        <TemplateGalleryOverlay
          onClose={() => setShowTemplates(false)}
          onPick={onTemplate}
        />
      )}
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────

const Toolbar = ({
  device,
  setDevice,
  accent,
  setAccent,
  onAdd,
  onTemplates,
  paletteOpen,
  itemCount,
  onSave,
  saveLabel,
}: {
  device: 'desktop' | 'mobile'
  setDevice: (d: 'desktop' | 'mobile') => void
  accent: string
  setAccent: (c: string) => void
  onAdd: () => void
  onTemplates: () => void
  paletteOpen: boolean
  itemCount: number
  onSave?: () => void
  saveLabel?: string
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 18px',
      borderBottom: '1px solid var(--line)',
      background: '#fff',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onAdd}
        style={{
          background: paletteOpen ? 'var(--ink)' : 'var(--bg-softer)',
          color: paletteOpen ? '#fff' : 'var(--ink)',
          border: 'none',
        }}
      >
        <Icon name="plus" size={13} />
        Add block
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onTemplates}
      >
        <Icon name="grid" size={13} />
        Templates
      </button>
      <div
        style={{
          width: 1,
          height: 22,
          background: 'var(--line)',
          margin: '0 4px',
        }}
      />
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--ink-3)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {itemCount} block{itemCount === 1 ? '' : 's'}
      </span>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Accent
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: c,
                border:
                  accent === c
                    ? '2px solid var(--ink)'
                    : '1px solid var(--line)',
                boxShadow: accent === c ? '0 0 0 2px #fff' : 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`Accent ${c}`}
            />
          ))}
        </div>
      </div>
      <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
      <div className="tabs" style={{ padding: 2 }}>
        <button
          type="button"
          className={`tab ${device === 'desktop' ? 'tab-active' : ''}`}
          onClick={() => setDevice('desktop')}
          style={{ padding: '5px 10px' }}
        >
          <Icon name="monitor" size={12} />
        </button>
        <button
          type="button"
          className={`tab ${device === 'mobile' ? 'tab-active' : ''}`}
          onClick={() => setDevice('mobile')}
          style={{ padding: '5px 10px' }}
        >
          <Icon name="phone" size={12} />
        </button>
      </div>
      {onSave && (
        <>
          <div style={{ width: 1, height: 22, background: 'var(--line)' }} />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
          >
            <Icon name="check" size={12} />
            {saveLabel || 'Save'}
          </button>
        </>
      )}
    </div>
  </div>
)

// ── Envelope header (avatar + sender) ─────────────────────────────────

const EnvelopeHeader = ({ sender }: { sender?: Sender }) => {
  const name = sender?.name || 'Sender'
  const email = sender?.email || ''
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div
      style={{
        padding: '14px 24px',
        borderBottom: '1px solid #efefef',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(250,250,252,0.6)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#1d1d1f',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {initials || '·'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#1d1d1f', fontWeight: 500 }}>
          {name}
        </div>
        {email && (
          <div
            style={{
              fontSize: 10.5,
              color: '#86868b',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {email}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: '#86868b' }}>preview</div>
    </div>
  )
}

// ── Inserter (the "+" between blocks) ─────────────────────────────────

const Inserter = ({
  onClick,
  visible,
  active,
}: {
  onClick: () => void
  visible?: boolean
  active?: boolean
}) => {
  const [hover, setHover] = useState(false)
  const show = hover || visible || active
  return (
    <div
      style={{
        height: show ? 22 : 6,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'height 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          background: hover || active ? 'var(--indigo)' : 'transparent',
          transition: 'background 0.15s',
        }}
      />
      {show && (
        <button
          type="button"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: active ? 'var(--ink)' : '#fff',
            color: active ? '#fff' : 'var(--ink-2)',
            border: `1px solid ${active ? 'var(--ink)' : 'var(--line-2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Icon name="plus" size={11} />
        </button>
      )}
    </div>
  )
}

// ── Block palette popover ──────────────────────────────────────────────

const BlockPalette = ({
  onAdd,
  onClose,
}: {
  onAdd: (type: BlockType) => void
  onClose: () => void
}) => {
  const groups: {
    label: string
    blocks: { type: BlockType; label: string; icon: string; desc: string }[]
  }[] = [
    {
      label: 'Text',
      blocks: [
        {
          type: 'heading',
          label: 'Heading',
          icon: 'heading',
          desc: 'Large title text',
        },
        {
          type: 'subheading',
          label: 'Subheading',
          icon: 'heading',
          desc: 'Section divider title',
        },
        {
          type: 'eyebrow',
          label: 'Eyebrow',
          icon: 'tag',
          desc: 'Tiny label above heading',
        },
        {
          type: 'paragraph',
          label: 'Paragraph',
          icon: 'text',
          desc: 'Body text',
        },
        {
          type: 'list',
          label: 'Bullet list',
          icon: 'list',
          desc: 'Unordered list',
        },
        {
          type: 'quote',
          label: 'Quote',
          icon: 'quote',
          desc: 'Pull-quote with citation',
        },
      ],
    },
    {
      label: 'Layout',
      blocks: [
        {
          type: 'columns',
          label: 'Columns',
          icon: 'grid',
          desc: 'Three-column row',
        },
        {
          type: 'image',
          label: 'Image',
          icon: 'image',
          desc: 'Photo or graphic',
        },
        {
          type: 'video',
          label: 'Video',
          icon: 'play',
          desc: 'Upload or embed',
        },
        {
          type: 'divider',
          label: 'Divider',
          icon: 'minus',
          desc: 'Horizontal line',
        },
      ],
    },
    {
      label: 'Action',
      blocks: [
        {
          type: 'button',
          label: 'Button',
          icon: 'button-icon',
          desc: 'CTA button',
        },
        {
          type: 'badge',
          label: 'Badge',
          icon: 'tag',
          desc: 'Inline status pill',
        },
      ],
    },
  ]
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 30 }}
      />
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 18,
          width: 480,
          background: '#fff',
          borderRadius: 14,
          boxShadow:
            '0 24px 48px -8px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06)',
          border: '1px solid var(--line)',
          zIndex: 31,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Add a block</div>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            style={{ padding: 4, borderRadius: 6 }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {g.label}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {g.blocks.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => onAdd(b.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: 'var(--bg-softer)',
                        color: 'var(--ink-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={b.icon} size={14} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--ink)',
                        }}
                      >
                        {b.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {b.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Editable block — renders + selection chrome + floating toolbar ─────

type EditableBlockProps = {
  block: Block
  accent: string
  selected: boolean
  uploadImage?: ImageUploader
  onSelect: () => void
  onChange: (patch: Partial<Block>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
}

const EditableBlock = ({
  block,
  accent,
  selected,
  uploadImage,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onDragStart,
  onDragOver,
  onDrop,
}: EditableBlockProps) => {
  const [hover, setHover] = useState(false)
  const showHandle = hover || selected
  return (
    <div
      style={{
        position: 'relative',
        margin: '4px -10px',
        padding: '4px 10px',
        borderRadius: 8,
        outline: selected ? `2px solid ${accent}` : 'none',
        outlineOffset: 2,
        background: hover && !selected ? 'rgba(0,0,0,0.015)' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <BlockBody
        block={block}
        accent={accent}
        uploadImage={uploadImage}
        onChange={onChange}
        selected={selected}
      />

      {selected && (
        <div
          style={{
            position: 'absolute',
            top: -36,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 0,
            background: 'var(--ink)',
            borderRadius: 8,
            boxShadow: '0 6px 20px -6px rgba(15,23,42,0.3)',
            padding: 3,
            zIndex: 5,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolbarBtn
            icon="arrow-up"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
          />
          <ToolbarBtn
            icon="arrow-down"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
          />
          <div
            style={{
              width: 1,
              height: 22,
              background: 'rgba(255,255,255,0.15)',
              alignSelf: 'center',
              margin: '0 2px',
            }}
          />
          <ToolbarBtn icon="copy" onClick={onDuplicate} title="Duplicate" />
          <ToolbarBtn icon="trash" onClick={onRemove} title="Delete" danger />
        </div>
      )}

      {showHandle && (
        <div
          draggable
          onDragStart={(e) => {
            onDragStart()
            e.stopPropagation()
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: -28,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 22,
            height: 22,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-3)',
            cursor: 'grab',
            background: 'rgba(255,255,255,0.6)',
          }}
          title="Drag to reorder"
        >
          <Icon name="drag" size={12} />
        </div>
      )}
    </div>
  )
}

const ToolbarBtn = ({
  icon,
  onClick,
  disabled,
  title,
  danger,
}: {
  icon: string
  onClick: () => void
  disabled?: boolean
  title: string
  danger?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      width: 26,
      height: 26,
      borderRadius: 6,
      background: 'transparent',
      border: 'none',
      color: disabled
        ? 'rgba(255,255,255,0.25)'
        : danger
          ? '#fca5a5'
          : 'rgba(255,255,255,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      padding: 0,
      transition: 'background 0.12s',
    }}
  >
    <Icon name={icon} size={12} />
  </button>
)

// ── Block body — per-type render + edit ──────────────────────────────

const BlockBody = ({
  block,
  accent,
  uploadImage,
  onChange,
  selected,
}: {
  block: Block
  accent: string
  uploadImage?: ImageUploader
  onChange: (patch: Partial<Block>) => void
  selected: boolean
}) => {
  if (block.type === 'eyebrow')
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({
            text: e.currentTarget.textContent ?? '',
          } as Partial<Block>)
        }
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
          marginBottom: 8,
          outline: 'none',
        }}
      >
        {block.text}
      </div>
    )
  if (block.type === 'heading') {
    const size = block.huge
      ? 32
      : block.level === 1
        ? 28
        : block.level === 3
          ? 17
          : 26
    return (
      <h2
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({
            text: e.currentTarget.textContent ?? '',
          } as Partial<Block>)
        }
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '8px 0 12px',
          color: '#1d1d1f',
          lineHeight: 1.15,
          outline: 'none',
        }}
      >
        {block.text}
      </h2>
    )
  }
  if (block.type === 'subheading')
    return (
      <h3
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({
            text: e.currentTarget.textContent ?? '',
          } as Partial<Block>)
        }
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          margin: '20px 0 8px',
          color: '#1d1d1f',
          outline: 'none',
        }}
      >
        {block.text}
      </h3>
    )
  if (block.type === 'paragraph')
    return (
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({
            text: e.currentTarget.textContent ?? '',
          } as Partial<Block>)
        }
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: '#3a3a3c',
          margin: '0 0 14px',
          outline: 'none',
        }}
      >
        {block.text}
      </p>
    )
  if (block.type === 'badge')
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({
            text: e.currentTarget.textContent ?? '',
          } as Partial<Block>)
        }
        style={{
          display: 'inline-block',
          fontSize: 12,
          padding: '5px 11px',
          background: '#1d1d1f',
          color: '#fff',
          borderRadius: 999,
          fontWeight: 500,
          marginBottom: 14,
          outline: 'none',
        }}
      >
        {block.text}
      </span>
    )
  if (block.type === 'image')
    return (
      <ImageBody
        block={block}
        onChange={onChange}
        uploadImage={uploadImage}
        selected={selected}
      />
    )
  if (block.type === 'button') {
    const lg = block.size === 'lg'
    return (
      <div style={{ margin: '12px 0' }}>
        <a
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) =>
            onChange({
              text: e.currentTarget.textContent ?? '',
            } as Partial<Block>)
          }
          style={{
            display: 'inline-block',
            background: accent,
            color: '#fff',
            padding: lg ? '13px 28px' : '10px 20px',
            borderRadius: 8,
            fontSize: lg ? 14 : 13,
            fontWeight: 500,
            textDecoration: 'none',
            outline: 'none',
          }}
        >
          {block.text}
        </a>
      </div>
    )
  }
  if (block.type === 'divider')
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid #e5e5e7',
          margin: '20px 0',
        }}
      />
    )
  if (block.type === 'list')
    return <ListBody block={block} onChange={onChange} />
  if (block.type === 'quote')
    return (
      <div
        style={{
          margin: '20px 0',
          padding: '18px 22px',
          background: '#fafafa',
          borderLeft: `3px solid ${accent}`,
          borderRadius: '0 8px 8px 0',
        }}
      >
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) =>
            onChange({
              text: e.currentTarget.textContent ?? '',
            } as Partial<Block>)
          }
          style={{
            fontSize: 15,
            color: '#1d1d1f',
            lineHeight: 1.55,
            fontStyle: 'italic',
            marginBottom: 10,
            letterSpacing: '-0.01em',
            outline: 'none',
          }}
        >
          "{block.text}"
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) =>
            onChange({
              cite: (e.currentTarget.textContent ?? '').replace(/^—\s*/, ''),
            } as Partial<Block>)
          }
          style={{ fontSize: 11.5, color: '#86868b', outline: 'none' }}
        >
          — {block.cite}
        </div>
      </div>
    )
  if (block.type === 'columns')
    return <ColumnsBody block={block} accent={accent} />
  if (block.type === 'checklist')
    return <ChecklistBody block={block} accent={accent} />
  if (block.type === 'event-card')
    return <EventCardBody block={block} accent={accent} />
  if (block.type === 'receipt') return <ReceiptBody block={block} />
  if (block.type === 'digest-item')
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr',
          gap: 14,
          margin: '14px 0',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: accent,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
          }}
        >
          {block.num}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#1d1d1f',
              letterSpacing: '-0.01em',
              marginBottom: 3,
              lineHeight: 1.3,
            }}
          >
            {block.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#86868b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 5,
            }}
          >
            {block.meta}
          </div>
          <div style={{ fontSize: 13, color: '#3a3a3c', lineHeight: 1.55 }}>
            {block.body}
          </div>
        </div>
      </div>
    )
  if (block.type === 'video') return <VideoBody block={block} />
  return null
}

// ── Per-block body components ───────────────────────────────────────

const ImageBody = ({
  block,
  onChange,
  uploadImage,
  selected,
}: {
  block: Extract<Block, { type: 'image' }>
  onChange: (patch: Partial<Block>) => void
  uploadImage?: ImageUploader
  selected: boolean
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const onFile = async (file: File | null | undefined) => {
    if (!file) return
    if (uploadImage) {
      const url = await uploadImage(file)
      onChange({ src: url } as Partial<Block>)
    } else {
      onChange({ src: URL.createObjectURL(file) } as Partial<Block>)
    }
  }
  const tone = block.tone ?? 'cool'
  return (
    <div style={{ margin: '14px 0' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {block.src ? (
        <div style={{ position: 'relative' }}>
          <img
            src={block.src}
            alt=""
            style={{ width: '100%', display: 'block', borderRadius: 8 }}
          />
          {selected && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                fontSize: 11.5,
              }}
            >
              Replace
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
          style={{
            width: '100%',
            height: block.short ? 120 : 190,
            borderRadius: 8,
            background: TONES[tone],
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.9)',
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 500,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="upload" size={20} />
            <span style={{ fontFamily: 'inherit', fontWeight: 500 }}>
              Click to upload an image
            </span>
            {block.placeholder && (
              <span style={{ fontSize: 11, opacity: 0.85 }}>
                {block.placeholder}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  )
}

const VideoBody = ({ block }: { block: Extract<Block, { type: 'video' }> }) => {
  if (block.embed_url) {
    return (
      <div
        style={{
          margin: '12px 0',
          paddingBottom: '56.25%',
          height: 0,
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <iframe
          src={block.embed_url}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 0,
          }}
          allowFullScreen
        />
      </div>
    )
  }
  if (block.src) {
    return (
      <video
        src={block.src}
        controls
        style={{
          width: '100%',
          display: 'block',
          margin: '12px 0',
          borderRadius: 8,
          background: '#000',
        }}
      />
    )
  }
  return (
    <div
      style={{
        margin: '12px 0',
        padding: 24,
        textAlign: 'center',
        border: '1.5px dashed var(--line-2)',
        borderRadius: 8,
        background: 'var(--bg-soft)',
        color: 'var(--ink-3)',
        fontSize: 13,
      }}
    >
      Add a video URL or upload in the inspector.
    </div>
  )
}

const ListBody = ({
  block,
  onChange,
}: {
  block: ListBlock
  onChange: (patch: Partial<Block>) => void
}) => {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag
      style={{
        margin: '0 0 14px',
        paddingLeft: 20,
        color: '#3a3a3c',
        fontSize: 14,
        lineHeight: 1.7,
      }}
    >
      {block.items.map((it, i) => (
        <li
          key={i}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const next = [...block.items]
            next[i] = e.currentTarget.textContent ?? ''
            onChange({ items: next } as Partial<Block>)
          }}
          style={{ marginBottom: 4, outline: 'none' }}
        >
          {it}
        </li>
      ))}
    </Tag>
  )
}

const ColumnsBody = ({
  block,
  accent,
}: {
  block: ColumnsBlock
  accent: string
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${block.cols.length}, 1fr)`,
      gap: 16,
      margin: '18px 0',
    }}
  >
    {block.cols.map((c, i) => (
      <div
        key={i}
        style={{
          background: '#fafafa',
          padding: 14,
          borderRadius: 8,
          border: '1px solid #efefef',
        }}
      >
        {c.icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <Icon name={c.icon} size={14} />
          </div>
        )}
        {c.label && (
          <div
            style={{
              fontSize: 10.5,
              color: '#86868b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            {c.label}
          </div>
        )}
        {c.title && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1d1d1f',
              marginBottom: 4,
              letterSpacing: '-0.005em',
            }}
          >
            {c.title}
          </div>
        )}
        {c.value && (
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1d1d1f' }}>
            {c.value}
          </div>
        )}
        {c.body && (
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: '#6e6e73',
            }}
          >
            {c.body}
          </div>
        )}
      </div>
    ))}
  </div>
)

const ChecklistBody = ({
  block,
  accent,
}: {
  block: ChecklistBlock
  accent: string
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      margin: '16px 0',
    }}
  >
    {block.items.map((it, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          gap: 12,
          padding: 14,
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #efefef',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {i + 1}
        </div>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: '#1d1d1f',
              marginBottom: 2,
            }}
          >
            {it.title}
          </div>
          {it.body && (
            <div style={{ fontSize: 12, color: '#6e6e73', lineHeight: 1.5 }}>
              {it.body}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
)

const EventCardBody = ({
  block,
  accent,
}: {
  block: EventCardBlock
  accent: string
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '80px 1fr',
      gap: 18,
      padding: 20,
      background: accent,
      color: '#fff',
      borderRadius: 10,
      margin: '8px 0 18px',
    }}
  >
    <div
      style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.1em', opacity: 0.8 }}>
        {block.day}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginTop: 2,
        }}
      >
        {block.date}
      </div>
    </div>
    <div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.7,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}
      >
        You're invited
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          marginBottom: 6,
          lineHeight: 1.25,
        }}
      >
        {block.title}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{block.meta}</div>
    </div>
  </div>
)

const ReceiptBody = ({ block }: { block: ReceiptBlock }) => (
  <div
    style={{
      background: '#fafafa',
      borderRadius: 10,
      border: '1px solid #efefef',
      padding: 20,
      margin: '16px 0',
    }}
  >
    {block.items.map((it, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '10px 0',
          borderBottom:
            i < block.items.length - 1 ? '1px solid #efefef' : 'none',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: '#1d1d1f' }}>
            {it.name}
          </div>
          {it.sub && (
            <div style={{ fontSize: 11.5, color: '#86868b', marginTop: 2 }}>
              {it.sub}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {it.price}
        </div>
      </div>
    ))}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 12,
        marginTop: 8,
        borderTop: '2px solid #1d1d1f',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>Total</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {block.total}
      </div>
    </div>
  </div>
)

// ── Inspector — right rail with per-block controls ──────────────────

const Inspector = ({
  block,
  onChange,
  onClose,
  onRemove,
  onDuplicate,
}: {
  block: Block
  onChange: (patch: Partial<Block>) => void
  onClose: () => void
  onRemove: () => void
  onDuplicate: () => void
}) => (
  <div
    style={{
      background: '#fff',
      borderLeft: '1px solid var(--line)',
      padding: '20px 18px',
      overflow: 'auto',
    }}
    onClick={(e) => e.stopPropagation()}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          Selected
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginTop: 2,
            textTransform: 'capitalize',
          }}
        >
          {block.type}
        </div>
      </div>
      <button
        type="button"
        className="btn-ghost"
        onClick={onClose}
        style={{ padding: 6, borderRadius: 6 }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>

    {block.type === 'heading' && (
      <InspectorField label="Size">
        <div style={{ display: 'flex', gap: 4 }}>
          <SmallToggle
            label="Default"
            active={!block.huge}
            onClick={() => onChange({ huge: false } as Partial<Block>)}
          />
          <SmallToggle
            label="Hero"
            active={!!block.huge}
            onClick={() => onChange({ huge: true } as Partial<Block>)}
          />
        </div>
      </InspectorField>
    )}
    {block.type === 'button' && (
      <>
        <InspectorField label="Link URL">
          <input
            className="input"
            defaultValue={block.url || '#'}
            onBlur={(e) => onChange({ url: e.target.value } as Partial<Block>)}
            style={{ fontSize: 12 }}
          />
        </InspectorField>
        <InspectorField label="Size">
          <div style={{ display: 'flex', gap: 4 }}>
            <SmallToggle
              label="Small"
              active={block.size === 'sm'}
              onClick={() => onChange({ size: 'sm' } as Partial<Block>)}
            />
            <SmallToggle
              label="Default"
              active={block.size !== 'sm' && block.size !== 'lg'}
              onClick={() => onChange({ size: 'md' } as Partial<Block>)}
            />
            <SmallToggle
              label="Large"
              active={block.size === 'lg'}
              onClick={() => onChange({ size: 'lg' } as Partial<Block>)}
            />
          </div>
        </InspectorField>
      </>
    )}
    {block.type === 'image' && (
      <>
        <InspectorField label="Alt text">
          <input
            className="input"
            defaultValue={block.alt}
            onBlur={(e) => onChange({ alt: e.target.value } as Partial<Block>)}
            style={{ fontSize: 12 }}
          />
        </InspectorField>
        <InspectorField label="Tone">
          <div style={{ display: 'flex', gap: 4 }}>
            <SmallToggle
              label="Cool"
              active={block.tone === 'cool'}
              onClick={() => onChange({ tone: 'cool' } as Partial<Block>)}
            />
            <SmallToggle
              label="Warm"
              active={block.tone === 'warm'}
              onClick={() => onChange({ tone: 'warm' } as Partial<Block>)}
            />
            <SmallToggle
              label="Neutral"
              active={block.tone === 'neutral'}
              onClick={() => onChange({ tone: 'neutral' } as Partial<Block>)}
            />
          </div>
        </InspectorField>
      </>
    )}
    {block.type === 'video' && (
      <InspectorField label="Embed URL">
        <input
          className="input"
          defaultValue={block.embed_url ?? ''}
          onBlur={(e) =>
            onChange({ embed_url: e.target.value } as Partial<Block>)
          }
          style={{ fontSize: 12 }}
          placeholder="YouTube, Vimeo, or Loom"
        />
      </InspectorField>
    )}
    {block.type === 'list' && (
      <InspectorField label="Items">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {block.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <input
                className="input"
                defaultValue={it}
                onBlur={(e) => {
                  const next = [...block.items]
                  next[i] = e.target.value
                  onChange({ items: next } as Partial<Block>)
                }}
                style={{ fontSize: 12 }}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  onChange({
                    items: block.items.filter((_, j) => j !== i),
                  } as Partial<Block>)
                }
                style={{ padding: 6, borderRadius: 6 }}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              onChange({
                items: [...block.items, 'New item'],
              } as Partial<Block>)
            }
            style={{ marginTop: 4 }}
          >
            <Icon name="plus" size={11} />
            Add item
          </button>
        </div>
      </InspectorField>
    )}

    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onDuplicate}
        style={{ justifyContent: 'flex-start' }}
      >
        <Icon name="copy" size={12} />
        Duplicate block
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onRemove}
        style={{ justifyContent: 'flex-start', color: 'var(--red)' }}
      >
        <Icon name="trash" size={12} />
        Delete block
      </button>
    </div>
  </div>
)

const InspectorField = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 500,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    {children}
  </div>
)

const SmallToggle = ({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      padding: '6px 10px',
      borderRadius: 6,
      background: active ? 'var(--ink)' : 'var(--bg-softer)',
      color: active ? '#fff' : 'var(--ink-2)',
      border: 'none',
      fontSize: 11.5,
      fontWeight: 500,
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
)

// ── Template gallery overlay ─────────────────────────────────────

const TemplateGalleryOverlay = ({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (tpl: EmailTemplate) => void
}) => {
  const [filter, setFilter] = useState<string>('All')
  const [hovered, setHovered] = useState<string | null>(null)
  const cats = [
    'All',
    ...Array.from(new Set(EMAIL_TEMPLATES.map((t) => t.category))),
  ]
  const filtered =
    filter === 'All'
      ? EMAIL_TEMPLATES
      : EMAIL_TEMPLATES.filter((t) => t.category === filter)
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 18,
          width: '100%',
          maxWidth: 1180,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 40px 80px -20px rgba(15,23,42,0.4)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Email design templates
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              Pick a starting layout
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div
          style={{
            padding: '14px 28px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            gap: 6,
          }}
        >
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={filter === c ? 'chip chip-dark' : 'chip'}
              style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 12 }}
            >
              {c}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: 28,
            overflow: 'auto',
            flex: 1,
            background: '#fafafb',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 18,
            }}
          >
            {filtered.map((tpl) => (
              <div
                key={tpl.id}
                onMouseEnter={() => setHovered(tpl.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onPick(tpl)}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border:
                    hovered === tpl.id
                      ? '1px solid var(--indigo-line)'
                      : '1px solid var(--line)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                  transform: hovered === tpl.id ? 'translateY(-3px)' : 'none',
                  boxShadow:
                    hovered === tpl.id
                      ? '0 16px 36px -12px rgba(15,23,42,0.18)'
                      : '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <TemplateThumbnail tpl={tpl} />
                <div
                  style={{
                    padding: '14px 16px',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {tpl.name}
                    </div>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: tpl.accent,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ink-3)',
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    {tpl.description}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                    }}
                  >
                    <span
                      className="chip"
                      style={{ padding: '3px 9px', fontSize: 10.5 }}
                    >
                      {tpl.category}
                    </span>
                    <span
                      style={{
                        color:
                          hovered === tpl.id ? 'var(--ink)' : 'var(--ink-3)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      Use
                      <Icon name="arrow-right" size={11} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const TemplateThumbnail = ({ tpl }: { tpl: EmailTemplate }) => {
  // Render a simplified mini-version of the first few blocks against a card,
  // tinted by the template's accent. Keep it minimal — we want to suggest
  // shape and rhythm, not legibility.
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '4 / 5',
        background: '#f5f5f7',
        padding: 14,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 220,
          padding: '14px 16px',
          borderRadius: 4,
          boxShadow:
            '0 8px 24px -10px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: '0.5px solid #efefef',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#1d1d1f',
            }}
          />
          <div style={{ fontSize: 5, color: '#86868b', marginLeft: 4 }}>
            {tpl.name.toLowerCase()}
          </div>
        </div>
        {tpl.blocks.slice(0, 6).map((b, i) => (
          <ThumbnailBlock key={i} block={b} accent={tpl.accent} />
        ))}
      </div>
    </div>
  )
}

const ThumbnailBlock = ({
  block,
  accent,
}: {
  block: TemplateBlock
  accent: string
}) => {
  if (block.type === 'eyebrow')
    return (
      <div
        style={{
          fontSize: 4,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
          marginBottom: 3,
        }}
      >
        {block.text}
      </div>
    )
  if (block.type === 'heading')
    return (
      <div
        style={{
          fontSize: block.huge ? 12 : 10,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '3px 0 5px',
          color: '#1d1d1f',
          lineHeight: 1.15,
        }}
      >
        {block.text}
      </div>
    )
  if (block.type === 'subheading')
    return (
      <div
        style={{
          fontSize: 7,
          fontWeight: 600,
          margin: '6px 0 3px',
          color: '#1d1d1f',
        }}
      >
        {block.text}
      </div>
    )
  if (block.type === 'paragraph')
    return (
      <div
        style={{
          fontSize: 5,
          lineHeight: 1.6,
          color: '#3a3a3c',
          margin: '0 0 5px',
        }}
      >
        {block.text}
      </div>
    )
  if (block.type === 'image')
    return (
      <div
        style={{
          height: block.short ? 30 : 50,
          width: '100%',
          borderRadius: 3,
          background: TONES[block.tone ?? 'cool'],
          margin: '5px 0',
        }}
      />
    )
  if (block.type === 'button')
    return (
      <div style={{ margin: '5px 0' }}>
        <span
          style={{
            display: 'inline-block',
            background: accent,
            color: '#fff',
            padding: '3px 7px',
            borderRadius: 2,
            fontSize: 5,
            fontWeight: 500,
          }}
        >
          {block.text}
        </span>
      </div>
    )
  if (block.type === 'badge')
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: 4,
          padding: '2px 5px',
          background: '#1d1d1f',
          color: '#fff',
          borderRadius: 999,
          marginBottom: 5,
        }}
      >
        {block.text}
      </span>
    )
  if (block.type === 'divider')
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '0.5px solid #e5e5e7',
          margin: '6px 0',
        }}
      />
    )
  if (block.type === 'list')
    return (
      <div
        style={{
          fontSize: 5,
          color: '#3a3a3c',
          lineHeight: 1.6,
          margin: '0 0 5px',
        }}
      >
        {block.items.slice(0, 3).map((it, i) => (
          <div key={i}>• {it}</div>
        ))}
      </div>
    )
  if (block.type === 'quote')
    return (
      <div
        style={{
          fontSize: 5,
          padding: '4px 6px',
          background: '#fafafa',
          borderLeft: `1.5px solid ${accent}`,
          color: '#1d1d1f',
          fontStyle: 'italic',
          margin: '5px 0',
        }}
      >
        "{block.text}"
      </div>
    )
  if (block.type === 'columns')
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${block.cols.length}, 1fr)`,
          gap: 4,
          margin: '5px 0',
        }}
      >
        {block.cols.map((c, i) => (
          <div
            key={i}
            style={{
              background: '#fafafa',
              padding: 4,
              borderRadius: 2,
              border: '0.5px solid #efefef',
            }}
          >
            {c.icon && (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: accent,
                  marginBottom: 3,
                }}
              />
            )}
            {c.title && (
              <div style={{ fontSize: 5, fontWeight: 600 }}>{c.title}</div>
            )}
            {c.body && (
              <div style={{ fontSize: 4, color: '#6e6e73' }}>{c.body}</div>
            )}
          </div>
        ))}
      </div>
    )
  if (block.type === 'event-card')
    return (
      <div
        style={{
          background: accent,
          color: '#fff',
          padding: 6,
          borderRadius: 3,
          margin: '5px 0',
          fontSize: 5,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {block.day} · {block.date}
        </div>
        <div>{block.title}</div>
      </div>
    )
  if (block.type === 'checklist')
    return (
      <div style={{ fontSize: 5, color: '#3a3a3c', lineHeight: 1.6 }}>
        {block.items.slice(0, 3).map((it, i) => (
          <div key={i}>✓ {it.title}</div>
        ))}
      </div>
    )
  if (block.type === 'digest-item')
    return (
      <div style={{ display: 'flex', gap: 4, margin: '4px 0' }}>
        <div
          style={{
            fontSize: 7,
            fontWeight: 700,
            color: accent,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {block.num}
        </div>
        <div>
          <div style={{ fontSize: 5, fontWeight: 600 }}>{block.title}</div>
          <div style={{ fontSize: 4, color: '#86868b' }}>{block.body}</div>
        </div>
      </div>
    )
  if (block.type === 'receipt')
    return (
      <div
        style={{
          background: '#fafafa',
          padding: 6,
          borderRadius: 2,
          margin: '4px 0',
          fontSize: 5,
        }}
      >
        {block.items.slice(0, 2).map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '2px 0',
            }}
          >
            <span>{it.name}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {it.price}
            </span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 2,
            borderTop: '1px solid #1d1d1f',
            fontWeight: 700,
          }}
        >
          <span>Total</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {block.total}
          </span>
        </div>
      </div>
    )
  return null
}
