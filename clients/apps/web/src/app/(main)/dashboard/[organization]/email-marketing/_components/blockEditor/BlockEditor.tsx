import { CSSProperties, useState } from 'react'
import { Icon } from '../Icon'
import {
  Block,
  BlockId,
  BlockType,
  ButtonBlock,
  ContentDoc,
  HeadingBlock,
  ImageBlock,
  ParagraphBlock,
  VideoBlock,
  blankBlock,
  blockLibrary,
} from './types'

export const BlockEditor = ({
  doc,
  setDoc,
}: {
  doc: ContentDoc
  setDoc: (next: ContentDoc) => void
}) => {
  const [selectedId, setSelectedId] = useState<BlockId | null>(null)

  const updateBlocks = (next: Block[]) => setDoc({ ...doc, blocks: next })

  const appendBlock = (type: BlockType) => {
    const block = blankBlock(type)
    updateBlocks([...doc.blocks, block])
    setSelectedId(block.id)
  }

  const replaceBlock = (id: BlockId, next: Block) => {
    updateBlocks(doc.blocks.map((b) => (b.id === id ? next : b)))
  }

  const removeBlock = (id: BlockId) => {
    updateBlocks(doc.blocks.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const moveBlock = (id: BlockId, direction: -1 | 1) => {
    const idx = doc.blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= doc.blocks.length) return
    const next = [...doc.blocks]
    const [removed] = next.splice(idx, 1)
    next.splice(target, 0, removed)
    updateBlocks(next)
  }

  const duplicateBlock = (id: BlockId) => {
    const idx = doc.blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const original = doc.blocks[idx]
    const copy = { ...original, id: blankBlock(original.type).id }
    const next = [...doc.blocks]
    next.splice(idx + 1, 0, copy)
    updateBlocks(next)
    setSelectedId(copy.id)
  }

  const selected = doc.blocks.find((b) => b.id === selectedId) ?? null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr 260px',
        gap: 16,
      }}
    >
      <BlockLibrary onPick={appendBlock} />
      <Canvas
        blocks={doc.blocks}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={replaceBlock}
        onMove={moveBlock}
        onDuplicate={duplicateBlock}
        onRemove={removeBlock}
        onAppend={appendBlock}
      />
      <BlockTweaks
        block={selected}
        onChange={(next) =>
          selected ? replaceBlock(selected.id, next) : undefined
        }
      />
    </div>
  )
}

const BlockLibrary = ({ onPick }: { onPick: (type: BlockType) => void }) => (
  <div>
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 12,
      }}
    >
      Blocks
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}
    >
      {blockLibrary.map((b) => (
        <button
          key={b.type}
          type="button"
          className="card"
          style={{
            padding: '14px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = 'var(--ink-3)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = 'var(--line)')
          }
          onClick={() => onPick(b.type)}
        >
          <Icon name={b.icon} size={16} style={{ color: 'var(--ink-2)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {b.label}
          </span>
        </button>
      ))}
    </div>
    <div
      style={{
        marginTop: 14,
        padding: '10px 12px',
        background: 'var(--bg-soft)',
        borderRadius: 10,
        fontSize: 11,
        color: 'var(--ink-3)',
        lineHeight: 1.5,
      }}
    >
      Click a block to insert it. Click an inserted block to edit it inline, and
      use the right rail for type-specific tweaks.
    </div>
  </div>
)

const Canvas = ({
  blocks,
  selectedId,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onAppend,
}: {
  blocks: Block[]
  selectedId: BlockId | null
  onSelect: (id: BlockId | null) => void
  onChange: (id: BlockId, next: Block) => void
  onMove: (id: BlockId, direction: -1 | 1) => void
  onDuplicate: (id: BlockId) => void
  onRemove: (id: BlockId) => void
  onAppend: (type: BlockType) => void
}) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
    <div
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-soft)',
        fontSize: 12,
        color: 'var(--ink-3)',
      }}
    >
      620px · branded template
    </div>
    <div
      style={{ padding: 32, background: 'var(--bg-soft)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
    >
      <div
        style={{
          background: '#fff',
          maxWidth: 540,
          margin: '0 auto',
          padding: 36,
          borderRadius: 12,
          border: '1px solid var(--line)',
        }}
      >
        {blocks.length === 0 ? (
          <EmptyCanvas onAppend={onAppend} />
        ) : (
          blocks.map((block, i) => (
            <BlockRow
              key={block.id}
              block={block}
              selected={selectedId === block.id}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              onSelect={() => onSelect(block.id)}
              onChange={(next) => onChange(block.id, next)}
              onMove={(dir) => onMove(block.id, dir)}
              onDuplicate={() => onDuplicate(block.id)}
              onRemove={() => onRemove(block.id)}
            />
          ))
        )}
      </div>
    </div>
  </div>
)

const EmptyCanvas = ({ onAppend }: { onAppend: (type: BlockType) => void }) => (
  <div
    style={{
      padding: 32,
      textAlign: 'center',
      color: 'var(--ink-3)',
      fontSize: 13,
    }}
  >
    <div style={{ marginBottom: 14 }}>
      Empty email — pick a block from the left, or get started:
    </div>
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {(['heading', 'paragraph', 'image', 'button'] as const).map((t) => (
        <button
          key={t}
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onAppend(t)}
        >
          + {t}
        </button>
      ))}
    </div>
  </div>
)

const BlockRow = ({
  block,
  selected,
  isFirst,
  isLast,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: Block
  selected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onChange: (next: Block) => void
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
}) => {
  const wrapStyle: CSSProperties = {
    position: 'relative',
    padding: '6px 8px',
    margin: '4px -8px',
    borderRadius: 8,
    transition: 'background 0.12s, box-shadow 0.12s',
    background: selected ? 'rgba(0,0,0,0.03)' : 'transparent',
    boxShadow: selected ? '0 0 0 1px var(--ink-4)' : 'none',
    cursor: 'pointer',
  }

  return (
    <div
      style={wrapStyle}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {selected && (
        <div
          style={{
            position: 'absolute',
            right: -42,
            top: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label="Move up"
            title="Move up"
          >
            <Icon
              name="chevron-down"
              size={13}
              style={{ transform: 'rotate(180deg)' }}
            />
          </button>
          <button
            type="button"
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label="Move down"
            title="Move down"
          >
            <Icon name="chevron-down" size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
            onClick={onDuplicate}
            aria-label="Duplicate"
            title="Duplicate"
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              color: 'var(--red)',
            }}
            onClick={onRemove}
            aria-label="Remove"
            title="Remove"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      )}
      <BlockBody block={block} onChange={onChange} />
    </div>
  )
}

const inlineInput: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  padding: 0,
  resize: 'none',
}

const BlockBody = ({
  block,
  onChange,
}: {
  block: Block
  onChange: (next: Block) => void
}) => {
  if (block.type === 'heading') {
    const level = block.level
    const fontSize = level === 1 ? 28 : level === 2 ? 22 : 17
    return (
      <input
        value={block.text}
        onChange={(e) =>
          onChange({ ...block, text: e.target.value } as HeadingBlock)
        }
        placeholder="Heading"
        style={{
          ...inlineInput,
          fontSize,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: '0 0 16px',
        }}
      />
    )
  }
  if (block.type === 'paragraph') {
    return (
      <textarea
        value={block.text}
        onChange={(e) =>
          onChange({ ...block, text: e.target.value } as ParagraphBlock)
        }
        rows={Math.max(2, block.text.split('\n').length)}
        placeholder="Write your paragraph here…"
        style={{
          ...inlineInput,
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--ink-2)',
          fontFamily: 'inherit',
          margin: '0 0 16px',
        }}
      />
    )
  }
  if (block.type === 'image') {
    if (!block.src)
      return (
        <div
          className="placeholder-img"
          style={{ height: 140, margin: '20px 0', fontSize: 11 }}
        >
          Add an image URL in the right rail →
        </div>
      )
    return (
      <div style={{ margin: '20px 0' }}>
        {/* Editor mirror of what the email client will render — bypasses
            next/image so the preview matches the actual send. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.src}
          alt={block.alt}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 8,
          }}
        />
      </div>
    )
  }
  if (block.type === 'button') {
    return (
      <div style={{ margin: '24px 0' }}>
        <input
          value={block.text}
          onChange={(e) =>
            onChange({ ...block, text: e.target.value } as ButtonBlock)
          }
          placeholder="Button label"
          style={{
            display: 'inline-block',
            background: '#1d1d1f',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            outline: 'none',
            textAlign: 'center',
            minWidth: 140,
          }}
        />
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--ink-4)',
            marginTop: 6,
          }}
        >
          {block.url ? `→ ${block.url}` : 'Set the URL in the right rail.'}
        </div>
      </div>
    )
  }
  if (block.type === 'divider') {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--line)',
          margin: '28px 0',
        }}
      />
    )
  }
  // video
  return (
    <div style={{ margin: '24px 0' }}>
      {block.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.thumbnail}
          alt="Video thumbnail"
          style={{
            maxWidth: '100%',
            display: 'block',
            borderRadius: 10,
            border: '1px solid var(--line)',
          }}
        />
      ) : (
        <div className="placeholder-img" style={{ height: 160, fontSize: 11 }}>
          Add thumbnail + URL in the right rail →
        </div>
      )}
    </div>
  )
}

const tweakLabel: CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  fontWeight: 500,
}

const BlockTweaks = ({
  block,
  onChange,
}: {
  block: Block | null
  onChange: (next: Block) => void
}) => {
  if (!block)
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={tweakLabel}>Tweaks</div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
          }}
        >
          Click a block in the canvas to tweak it. Each block type has its own
          settings.
        </div>
      </div>
    )

  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={tweakLabel}>{block.type}</div>
      </div>
      {block.type === 'heading' && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <div style={tweakLabel}>Level</div>
            <div className="tabs" style={{ width: '100%' }}>
              {([1, 2, 3] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`tab ${block.level === l ? 'tab-active' : ''}`}
                  onClick={() => onChange({ ...block, level: l })}
                  style={{ flex: 1 }}
                >
                  H{l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {block.type === 'image' && (
        <ImageTweaks block={block} onChange={onChange} />
      )}
      {block.type === 'button' && (
        <ButtonTweaks block={block} onChange={onChange} />
      )}
      {block.type === 'video' && (
        <VideoTweaks block={block} onChange={onChange} />
      )}
      {block.type === 'paragraph' && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          Edit the paragraph inline in the canvas. Newlines are preserved.
        </div>
      )}
      {block.type === 'divider' && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          A simple horizontal rule. No settings.
        </div>
      )}
    </div>
  )
}

const ImageTweaks = ({
  block,
  onChange,
}: {
  block: ImageBlock
  onChange: (next: Block) => void
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <div style={tweakLabel}>Image URL</div>
      <input
        className="input"
        type="url"
        placeholder="https://…"
        value={block.src}
        onChange={(e) => onChange({ ...block, src: e.target.value })}
      />
    </div>
    <div>
      <div style={tweakLabel}>Alt text</div>
      <input
        className="input"
        value={block.alt}
        onChange={(e) => onChange({ ...block, alt: e.target.value })}
        placeholder="Describe the image"
      />
    </div>
    <div>
      <div style={tweakLabel}>Click-through (optional)</div>
      <input
        className="input"
        type="url"
        placeholder="https://…"
        value={block.href ?? ''}
        onChange={(e) =>
          onChange({ ...block, href: e.target.value || undefined })
        }
      />
    </div>
  </div>
)

const ButtonTweaks = ({
  block,
  onChange,
}: {
  block: ButtonBlock
  onChange: (next: Block) => void
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <div style={tweakLabel}>URL</div>
      <input
        className="input"
        type="url"
        placeholder="https://…"
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
      />
    </div>
    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
      Edit the button label inline in the canvas.
    </div>
  </div>
)

const VideoTweaks = ({
  block,
  onChange,
}: {
  block: VideoBlock
  onChange: (next: Block) => void
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <div style={tweakLabel}>Thumbnail URL</div>
      <input
        className="input"
        type="url"
        placeholder="https://…"
        value={block.thumbnail}
        onChange={(e) => onChange({ ...block, thumbnail: e.target.value })}
      />
    </div>
    <div>
      <div style={tweakLabel}>Video URL</div>
      <input
        className="input"
        type="url"
        placeholder="https://youtube.com/…"
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
      />
    </div>
    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55 }}>
      Email clients can&apos;t autoplay video. We render a clickable thumbnail
      that opens the video URL.
    </div>
  </div>
)
