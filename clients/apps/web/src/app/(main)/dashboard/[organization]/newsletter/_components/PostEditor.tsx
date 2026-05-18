import { CSSProperties, useRef, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { EditableText } from '../../email-marketing/_components/blockEditor/EditableText'
import {
  AudioBlock,
  Block,
  BlockId,
  BlockType,
  ButtonBlock,
  CalloutBlock,
  ContentDoc,
  DividerBlock,
  EmbedBlock,
  GalleryBlock,
  HeadingBlock,
  ImageBlock,
  ListBlock,
  ListItem,
  ParagraphBlock,
  PaywallBlock,
  PollBlock,
  PullQuoteBlock,
  QuoteBlock,
  SubheadingBlock,
  VideoBlock,
  blankBlock,
  newId,
} from '../../email-marketing/_components/blockEditor/types'
import { CoverImage, CoverImageUploader } from './CoverImage'
import {
  AudioBody,
  CalloutBody,
  EmbedBody,
  GalleryBody,
  PaywallBody,
  PollBody,
  PullQuoteBody,
} from './NewsletterBlockBodies'
import { SlashMenu } from './SlashMenu'
import { TagsRow } from './TagsRow'

export type PostDoc = ContentDoc

// The post's authoring shell extends ContentDoc with newsletter-only
// metadata (title, subtitle, cover, tags). Kept separate from the
// block document so the existing block schema and render pipeline can
// stay generic across broadcasts and posts.
export type PostMeta = {
  title: string
  subtitle: string
  cover_url: string | null
  cover_visible: boolean
  tags: string[]
}

export function PostEditor({
  meta,
  setMeta,
  doc,
  setDoc,
  accent,
  uploadImage,
}: {
  meta: PostMeta
  setMeta: (next: PostMeta) => void
  doc: PostDoc
  setDoc: (next: PostDoc) => void
  accent?: string
  uploadImage?: CoverImageUploader
}) {
  const [slash, setSlash] = useState<{
    x: number
    y: number
    afterId: BlockId | null
  } | null>(null)
  const accentColor = accent ?? doc.accent ?? '#4f46e5'

  const replaceBlock = (id: BlockId, next: Block) =>
    setDoc({ ...doc, blocks: doc.blocks.map((b) => (b.id === id ? next : b)) })

  const deleteBlock = (id: BlockId) =>
    setDoc({ ...doc, blocks: doc.blocks.filter((b) => b.id !== id) })

  const insertAfter = (afterId: BlockId | null, type: BlockType) => {
    const block = blankBlock(type)
    const idx =
      afterId == null ? doc.blocks.length : doc.blocks.findIndex((b) => b.id === afterId) + 1
    const next = [...doc.blocks]
    next.splice(idx, 0, block)
    setDoc({ ...doc, blocks: next })
  }

  const openSlash = (afterId: BlockId | null, anchor: DOMRect) =>
    setSlash({ afterId, x: anchor.left, y: anchor.bottom + 6 })

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 24px 160px',
      }}
    >
      <CoverImage
        src={meta.cover_url}
        visible={meta.cover_visible}
        uploadImage={uploadImage}
        onChange={(cover_url) => setMeta({ ...meta, cover_url })}
        onToggleVisible={(cover_visible) => setMeta({ ...meta, cover_visible })}
      />

      <TagsRow
        tags={meta.tags}
        onChange={(tags) => setMeta({ ...meta, tags })}
      />

      <TitleField
        value={meta.title}
        onChange={(title) => setMeta({ ...meta, title })}
      />
      <SubtitleField
        value={meta.subtitle}
        onChange={(subtitle) => setMeta({ ...meta, subtitle })}
      />

      <div style={{ marginTop: 24 }}>
        {doc.blocks.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            accent={accentColor}
            uploadImage={uploadImage}
            onChange={(next) => replaceBlock(b.id, next)}
            onDelete={() => deleteBlock(b.id)}
            onInsertBelow={(rect) => openSlash(b.id, rect)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const lastId = doc.blocks[doc.blocks.length - 1]?.id ?? null
            openSlash(lastId, rect)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            border: '1px dashed #d1d1d6',
            borderRadius: 8,
            background: 'transparent',
            color: '#86868b',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Icon name="plus" size={14} />
          Add block
          <span
            style={{
              marginLeft: 4,
              padding: '1px 5px',
              borderRadius: 4,
              background: '#f4f4f7',
              color: '#3a3a3c',
              fontSize: 10.5,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            /
          </span>
        </button>
      </div>

      {slash && (
        <SlashMenu
          x={slash.x}
          y={slash.y}
          onClose={() => setSlash(null)}
          onPick={(type) => {
            insertAfter(slash.afterId, type)
            setSlash(null)
          }}
        />
      )}
    </div>
  )
}

// ── Title / subtitle inputs ──────────────────────────────────────────

function TitleField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <EditableText
      as="h1"
      multiline
      value={value}
      onChange={onChange}
      placeholder="Title"
      style={{
        margin: 0,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        lineHeight: 1.1,
        color: '#1d1d1f',
      }}
    />
  )
}

function SubtitleField({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <EditableText
      as="p"
      multiline
      value={value}
      onChange={onChange}
      placeholder="Subtitle (optional)"
      style={{
        margin: '10px 0 0',
        fontSize: 19,
        lineHeight: 1.45,
        color: '#6e6e73',
        fontWeight: 400,
      }}
    />
  )
}

// ── Block row (hover chrome + body dispatch) ─────────────────────────

function BlockRow({
  block,
  accent,
  uploadImage,
  onChange,
  onDelete,
  onInsertBelow,
}: {
  block: Block
  accent: string
  uploadImage: CoverImageUploader | undefined
  onChange: (next: Block) => void
  onDelete: () => void
  onInsertBelow: (anchor: DOMRect) => void
}) {
  const [hover, setHover] = useState(false)
  const rowStyle: CSSProperties = {
    position: 'relative',
    padding: '6px 0',
    borderRadius: 6,
    background: hover ? 'rgba(0,0,0,0.015)' : 'transparent',
    transition: 'background 0.12s',
  }
  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: -52,
            top: 8,
            display: 'flex',
            gap: 2,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ChromeButton
            title="Add block below"
            icon="plus"
            onClick={(e) =>
              onInsertBelow(e.currentTarget.getBoundingClientRect())
            }
          />
          <ChromeButton title="Drag" icon="drag" onClick={() => {}} />
        </div>
      )}
      {hover && (
        <div
          style={{
            position: 'absolute',
            right: -36,
            top: 6,
          }}
        >
          <ChromeButton
            title="Delete block"
            icon="trash"
            onClick={onDelete}
            danger
          />
        </div>
      )}
      <BlockBody
        block={block}
        accent={accent}
        uploadImage={uploadImage}
        onChange={onChange}
      />
    </div>
  )
}

function ChromeButton({
  title,
  icon,
  onClick,
  danger,
}: {
  title: string
  icon: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        color: danger ? '#c33' : '#86868b',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f4f4f7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon name={icon} size={13} />
    </button>
  )
}

// ── Block body dispatch ──────────────────────────────────────────────

function BlockBody({
  block,
  accent,
  uploadImage,
  onChange,
}: {
  block: Block
  accent: string
  uploadImage: CoverImageUploader | undefined
  onChange: (next: Block) => void
}) {
  switch (block.type) {
    case 'heading':
      return <HeadingBody block={block} onChange={onChange} />
    case 'subheading':
      return <SubheadingBody block={block} onChange={onChange} />
    case 'paragraph':
      return <ParagraphBody block={block} onChange={onChange} />
    case 'quote':
      return <QuoteBody block={block} accent={accent} onChange={onChange} />
    case 'list':
      return <ListBody block={block} onChange={onChange} />
    case 'image':
      return <ImageBody block={block} uploadImage={uploadImage} onChange={onChange} />
    case 'video':
      return <VideoBody block={block} onChange={onChange} />
    case 'divider':
      return <DividerBody block={block} />
    case 'button':
      return <ButtonBody block={block} accent={accent} onChange={onChange} />
    case 'pull':
      return <PullQuoteBody block={block} onChange={(b) => onChange(b as PullQuoteBlock)} />
    case 'callout':
      return <CalloutBody block={block} onChange={(b) => onChange(b as CalloutBlock)} />
    case 'gallery':
      return <GalleryBody block={block} uploadImage={uploadImage} onChange={(b) => onChange(b as GalleryBlock)} />
    case 'embed':
      return <EmbedBody block={block} onChange={(b) => onChange(b as EmbedBlock)} />
    case 'poll':
      return <PollBody block={block} onChange={(b) => onChange(b as PollBlock)} />
    case 'paywall':
      return <PaywallBody block={block} accent={accent} onChange={(b) => onChange(b as PaywallBlock)} />
    case 'audio':
      return <AudioBody block={block} accent={accent} onChange={(b) => onChange(b as AudioBlock)} />
    default:
      // Broadcast-flavoured blocks (eyebrow, badge, columns, checklist,
      // event-card, receipt, digest-item) aren't surfaced in the
      // newsletter slash menu — but the data shape is shared, so an
      // imported broadcast doc would still appear here. Render a
      // placeholder rather than throwing.
      return (
        <div
          style={{
            padding: '14px 18px',
            background: '#fafafa',
            border: '1px dashed #d1d1d6',
            borderRadius: 8,
            fontSize: 12.5,
            color: '#86868b',
            margin: '14px 0',
          }}
        >
          The “{(block as { type: string }).type}” block is not editable in
          the newsletter composer. Open it in the broadcast editor.
        </div>
      )
  }
}

// ── Inline bodies for shared (non-newsletter-only) types ─────────────

function HeadingBody({
  block,
  onChange,
}: {
  block: HeadingBlock
  onChange: (next: Block) => void
}) {
  const size = block.huge ? 32 : block.level === 1 ? 28 : block.level === 2 ? 22 : 17
  const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'
  return (
    <EditableText
      as={Tag}
      value={block.text}
      onChange={(text) => onChange({ ...block, text })}
      placeholder={`Heading ${block.level}`}
      style={{
        fontSize: size,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        color: '#1d1d1f',
        margin: '24px 0 12px',
      }}
    />
  )
}

function SubheadingBody({
  block,
  onChange,
}: {
  block: SubheadingBlock
  onChange: (next: Block) => void
}) {
  return (
    <EditableText
      as="h3"
      value={block.text}
      onChange={(text) => onChange({ ...block, text })}
      placeholder="Subheading"
      style={{
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
        color: '#1d1d1f',
        margin: '20px 0 8px',
      }}
    />
  )
}

function ParagraphBody({
  block,
  onChange,
}: {
  block: ParagraphBlock
  onChange: (next: Block) => void
}) {
  return (
    <EditableText
      as="p"
      multiline
      value={block.text}
      onChange={(text) => onChange({ ...block, text })}
      placeholder="Write your paragraph here…"
      style={{
        fontSize: 17,
        lineHeight: 1.7,
        color: '#1d1d1f',
        margin: '0 0 18px',
      }}
    />
  )
}

function QuoteBody({
  block,
  accent,
  onChange,
}: {
  block: QuoteBlock
  accent: string
  onChange: (next: Block) => void
}) {
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '16px 20px',
        background: '#fafafa',
        borderLeft: `3px solid ${accent}`,
        borderRadius: '0 8px 8px 0',
      }}
    >
      <EditableText
        multiline
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="A short, punchy quote."
        style={{
          fontSize: 16,
          color: '#1d1d1f',
          lineHeight: 1.55,
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
        }}
      />
      <EditableText
        value={block.cite ?? ''}
        onChange={(cite) => onChange({ ...block, cite })}
        placeholder="Attribution"
        style={{ fontSize: 12, color: '#86868b', marginTop: 8 }}
      />
    </div>
  )
}

function ListBody({
  block,
  onChange,
}: {
  block: ListBlock
  onChange: (next: Block) => void
}) {
  const items: ListItem[] = Array.isArray(block.items)
    ? block.items.map((it) =>
        typeof it === 'string'
          ? { id: newId(), text: it }
          : { id: it.id || newId(), text: it.text ?? '' },
      )
    : []
  const setItem = (id: string, text: string) =>
    onChange({
      ...block,
      items: items.map((i) => (i.id === id ? { ...i, text } : i)),
    })
  const addItem = () =>
    onChange({ ...block, items: [...items, { id: newId(), text: '' }] })
  const removeItem = (id: string) =>
    onChange({ ...block, items: items.filter((i) => i.id !== id) })
  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{ marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => onChange({ ...block, ordered: !block.ordered })}
          style={{
            padding: '3px 8px',
            border: '1px solid #e5e5ea',
            borderRadius: 6,
            background: '#fafafa',
            fontSize: 11.5,
            color: '#3a3a3c',
            cursor: 'pointer',
          }}
        >
          {block.ordered ? 'Numbered' : 'Bulleted'}
        </button>
      </div>
      {items.map((it, i) => (
        <div
          key={it.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '4px 0',
          }}
        >
          <span style={{ color: '#86868b', fontSize: 14, minWidth: 22 }}>
            {block.ordered ? `${i + 1}.` : '•'}
          </span>
          <EditableText
            value={it.text}
            onChange={(text) => setItem(it.id, text)}
            placeholder="List item"
            style={{ flex: 1, fontSize: 14, color: '#1d1d1f', lineHeight: 1.6 }}
          />
          <button
            type="button"
            onClick={() => removeItem(it.id)}
            aria-label="Remove item"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#86868b',
              padding: 0,
              display: 'inline-flex',
            }}
          >
            <Icon name="x" size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        style={{
          marginTop: 4,
          padding: '4px 8px',
          border: '1px dashed #d1d1d6',
          borderRadius: 6,
          background: 'transparent',
          color: '#86868b',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        + Add item
      </button>
    </div>
  )
}

function ImageBody({
  block,
  uploadImage,
  onChange,
}: {
  block: ImageBlock
  uploadImage: CoverImageUploader | undefined
  onChange: (next: Block) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const onFile = async (file: File | undefined) => {
    if (!file || !uploadImage) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      onChange({ ...block, src: url, alt: file.name })
    } finally {
      setUploading(false)
    }
  }
  return (
    <div style={{ margin: '18px 0' }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {block.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.alt ?? ''}
          style={{
            display: 'block',
            width: '100%',
            borderRadius: 10,
            opacity: uploading ? 0.6 : 1,
          }}
          onClick={() => fileRef.current?.click()}
        />
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            border: '1px dashed #d1d1d6',
            borderRadius: 10,
            background: '#fafafa',
            color: '#86868b',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : 'Click to upload an image'}
        </button>
      )}
      <EditableText
        value={block.alt ?? ''}
        onChange={(alt) => onChange({ ...block, alt })}
        placeholder="Caption / alt text"
        style={{
          marginTop: 8,
          fontSize: 12,
          color: '#86868b',
          textAlign: 'center',
        }}
      />
    </div>
  )
}

function VideoBody({
  block,
  onChange,
}: {
  block: VideoBlock
  onChange: (next: Block) => void
}) {
  return (
    <div
      style={{
        margin: '18px 0',
        padding: '14px 16px',
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Video
      </div>
      <input
        value={block.embed_url ?? ''}
        onChange={(e) => onChange({ ...block, embed_url: e.target.value })}
        placeholder="YouTube / Vimeo / Loom URL"
        style={{
          width: '100%',
          padding: '7px 10px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          fontSize: 13,
          background: '#fff',
          outline: 'none',
        }}
      />
    </div>
  )
}

function DividerBody({ block: _block }: { block: DividerBlock }) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid #e5e5ea',
        margin: '28px 0',
      }}
    />
  )
}

function ButtonBody({
  block,
  accent,
  onChange,
}: {
  block: ButtonBlock
  accent: string
  onChange: (next: Block) => void
}) {
  const [editingUrl, setEditingUrl] = useState(false)
  return (
    <div style={{ textAlign: 'center', margin: '24px 0' }}>
      <EditableText
        as="span"
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="Read more"
        style={{
          display: 'inline-block',
          background: accent,
          color: '#fff',
          padding: '10px 22px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
        }}
      />
      <div style={{ marginTop: 6 }}>
        {editingUrl ? (
          <input
            autoFocus
            value={block.url}
            placeholder="https://…"
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            onBlur={() => setEditingUrl(false)}
            style={{
              fontSize: 12,
              padding: '5px 9px',
              border: '1px solid #e5e5ea',
              borderRadius: 6,
              outline: 'none',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingUrl(true)}
            style={{
              fontSize: 11.5,
              color: '#86868b',
              background: 'transparent',
              border: 'none',
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
