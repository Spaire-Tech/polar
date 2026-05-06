import { CSSProperties, useRef, useState } from 'react'
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
  const dragId = useRef<BlockId | null>(null)

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

  const moveBeforeTarget = (fromId: BlockId, toId: BlockId) => {
    const from = doc.blocks.findIndex((b) => b.id === fromId)
    const to = doc.blocks.findIndex((b) => b.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...doc.blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateBlocks(next)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 24,
        alignItems: 'flex-start',
      }}
    >
      <BlockLibrary onPick={appendBlock} />
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-soft)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            620px · branded template · {doc.blocks.length} block
            {doc.blocks.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              Theme
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              Code
            </button>
          </div>
        </div>
        <div
          style={{ padding: 40, background: 'var(--bg-soft)' }}
          onClick={() => setSelectedId(null)}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 540,
              margin: '0 auto',
              padding: 36,
              borderRadius: 12,
              border: '1px solid var(--line)',
              minHeight: 200,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {doc.blocks.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  color: 'var(--ink-4)',
                  fontSize: 13,
                }}
              >
                Click a block on the left to start.
              </div>
            )}
            {doc.blocks.map((block) => (
              <EditableBlock
                key={block.id}
                block={block}
                selected={selectedId === block.id}
                onSelect={() => setSelectedId(block.id)}
                onChange={(next) => replaceBlock(block.id, next)}
                onRemove={() => removeBlock(block.id)}
                onDuplicate={() => duplicateBlock(block.id)}
                onDragStart={() => {
                  dragId.current = block.id
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId.current) moveBeforeTarget(dragId.current, block.id)
                  dragId.current = null
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const BlockLibrary = ({ onPick }: { onPick: (type: BlockType) => void }) => (
  <div style={{ position: 'sticky', top: 24 }}>
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
            background: '#fff',
            border: '1px solid var(--line)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ink-3)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--line)'
            e.currentTarget.style.transform = 'none'
          }}
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
        marginTop: 16,
        padding: 12,
        background: 'var(--bg-soft)',
        borderRadius: 10,
        fontSize: 11.5,
        color: 'var(--ink-3)',
        lineHeight: 1.5,
      }}
    >
      Tip: click the canvas to deselect. Hover any block for actions.
    </div>
  </div>
)

const EditableBlock = ({
  block,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  block: Block
  selected: boolean
  onSelect: () => void
  onChange: (next: Block) => void
  onRemove: () => void
  onDuplicate: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
}) => {
  const [hover, setHover] = useState(false)
  const showChrome = hover || selected
  const wrap: CSSProperties = {
    padding: '8px 0',
    position: 'relative',
    borderRadius: 6,
    transition: 'background 0.12s, box-shadow 0.12s',
    background: selected
      ? 'rgba(79,70,229,0.04)'
      : hover
        ? 'rgba(0,0,0,0.02)'
        : 'transparent',
    boxShadow: selected ? 'inset 0 0 0 1.5px var(--indigo)' : 'none',
    cursor: 'pointer',
  }

  return (
    <div
      style={wrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {block.type === 'heading' && (
        <HeadingBody block={block} onChange={onChange} />
      )}
      {block.type === 'paragraph' && (
        <ParagraphBody block={block} onChange={onChange} />
      )}
      {block.type === 'image' && (
        <ImageBody block={block} onChange={onChange} selected={selected} />
      )}
      {block.type === 'video' && (
        <VideoBody block={block} onChange={onChange} selected={selected} />
      )}
      {block.type === 'button' && (
        <ButtonBody block={block} onChange={onChange} selected={selected} />
      )}
      {block.type === 'divider' && (
        <hr
          style={{
            border: 'none',
            borderTop: '1px solid var(--line)',
            margin: '20px 0',
          }}
        />
      )}

      {showChrome && (
        <div
          style={{
            position: 'absolute',
            right: -10,
            top: 4,
            transform: 'translateX(100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            zIndex: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn-icon"
            draggable
            onDragStart={(e) => {
              onDragStart()
              e.stopPropagation()
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              cursor: 'grab',
            }}
            title="Drag to reorder"
          >
            <Icon name="drag" size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={onDuplicate}
            style={{ width: 28, height: 28, borderRadius: 7 }}
            title="Duplicate"
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={onRemove}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              color: 'var(--red)',
            }}
            title="Delete"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

const HeadingBody = ({
  block,
  onChange,
}: {
  block: HeadingBlock
  onChange: (next: Block) => void
}) => {
  const fontSize = block.level === 1 ? 28 : block.level === 2 ? 22 : 17
  return (
    <h3
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) =>
        onChange({ ...block, text: e.currentTarget.textContent ?? '' })
      }
      style={{
        fontSize,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        margin: 0,
        color: 'var(--ink)',
        outline: 'none',
      }}
    >
      {block.text}
    </h3>
  )
}

const ParagraphBody = ({
  block,
  onChange,
}: {
  block: ParagraphBlock
  onChange: (next: Block) => void
}) => (
  <p
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) =>
      onChange({ ...block, text: e.currentTarget.textContent ?? '' })
    }
    style={{
      fontSize: 14,
      lineHeight: 1.65,
      color: 'var(--ink-2)',
      margin: 0,
      outline: 'none',
    }}
  >
    {block.text}
  </p>
)

const ButtonBody = ({
  block,
  onChange,
}: {
  block: ButtonBlock
  onChange: (next: Block) => void
  selected: boolean
}) => {
  const [editingUrl, setEditingUrl] = useState(false)
  return (
    <div style={{ margin: '8px 0' }}>
      <a
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          onChange({ ...block, text: e.currentTarget.textContent ?? '' })
        }
        style={{
          display: 'inline-block',
          background: 'var(--ink)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
          outline: 'none',
        }}
      >
        {block.text}
      </a>
      <div style={{ marginTop: 6 }}>
        {editingUrl ? (
          <input
            autoFocus
            className="input"
            value={block.url}
            placeholder="https://…"
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            onBlur={() => setEditingUrl(false)}
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditingUrl(true)
            }}
            style={{
              fontSize: 11.5,
              color: 'var(--ink-4)',
              cursor: 'pointer',
            }}
          >
            {block.url ? `→ ${block.url}` : 'Set link'}
          </button>
        )}
      </div>
    </div>
  )
}

const ImageBody = ({
  block,
  onChange,
  selected,
}: {
  block: ImageBlock
  onChange: (next: Block) => void
  selected: boolean
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    onChange({ ...block, src: url, alt: file.name })
  }
  return (
    <div style={{ margin: '12px 0' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {block.src ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 8,
              border: '1px solid var(--line)',
            }}
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
            height: 180,
            border: '1.5px dashed var(--line-2)',
            borderRadius: 8,
            background: 'var(--bg-soft)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            transition: 'all 0.15s',
            color: 'var(--ink-3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--ink-3)'
            e.currentTarget.style.color = 'var(--ink-2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--line-2)'
            e.currentTarget.style.color = 'var(--ink-3)'
          }}
        >
          <Icon name="upload" size={18} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Upload an image</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
            PNG, JPG, GIF · up to 10MB
          </span>
        </button>
      )}
    </div>
  )
}

const toEmbedSrc = (url: string): string => {
  // YouTube → embed
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/,
  )
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  // Vimeo → embed
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  // Loom → embed
  const loom = url.match(/loom\.com\/share\/([\w-]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return url
}

const VideoBody = ({
  block,
  onChange,
  selected,
}: {
  block: VideoBlock
  onChange: (next: Block) => void
  selected: boolean
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'upload' | 'embed'>(
    block.embed_url ? 'embed' : 'upload',
  )
  const [url, setUrl] = useState(block.embed_url ?? '')

  const onFile = (file: File | undefined) => {
    if (!file) return
    const u = URL.createObjectURL(file)
    onChange({ ...block, src: u, embed_url: undefined })
  }
  const submitEmbed = () => {
    if (!url.trim()) return
    onChange({ ...block, embed_url: url.trim(), src: undefined })
  }
  const reset = () => {
    onChange({ ...block, src: undefined, embed_url: undefined })
    setUrl('')
  }

  const hasMedia = !!(block.src || block.embed_url)

  if (hasMedia) {
    return (
      <div style={{ margin: '12px 0', position: 'relative' }}>
        {block.src && (
          <video
            src={block.src}
            controls
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: '#000',
            }}
          />
        )}
        {block.embed_url && (
          <div
            style={{
              position: 'relative',
              paddingBottom: '56.25%',
              height: 0,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--line)',
              background: '#000',
            }}
          >
            <iframe
              title="Video preview"
              src={toEmbedSrc(block.embed_url)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {selected && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              reset()
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
    )
  }

  return (
    <div
      style={{
        margin: '12px 0',
        border: '1.5px dashed var(--line-2)',
        borderRadius: 8,
        background: 'var(--bg-soft)',
        padding: 16,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`tab ${tab === 'upload' ? 'tab-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          className={`tab ${tab === 'embed' ? 'tab-active' : ''}`}
          onClick={() => setTab('embed')}
        >
          Embed link
        </button>
      </div>
      {tab === 'upload' ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            height: 120,
            border: '1px dashed var(--line-2)',
            borderRadius: 8,
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            color: 'var(--ink-3)',
          }}
        >
          <Icon name="upload" size={18} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Upload a video</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
            MP4, MOV, WebM
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="https://youtube.com/watch?v=… or vimeo.com/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitEmbed()
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={submitEmbed}
            disabled={!url.trim()}
            style={{ opacity: !url.trim() ? 0.5 : 1 }}
          >
            Embed
          </button>
        </div>
      )}
    </div>
  )
}
