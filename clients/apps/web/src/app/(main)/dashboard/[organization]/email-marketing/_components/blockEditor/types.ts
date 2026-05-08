// Block schema for the broadcast composer.
//
// Mirrors `server/polar/email_broadcast/render.py`. The backend regenerates
// content_html from this JSON on save, but the editor renders it locally too
// so the live preview stays current without round-tripping the API.

export type BlockId = string

export type EyebrowBlock = {
  id: BlockId
  type: 'eyebrow'
  text: string
}

export type HeadingBlock = {
  id: BlockId
  type: 'heading'
  level: 1 | 2 | 3
  text: string
  huge?: boolean
}

export type SubheadingBlock = {
  id: BlockId
  type: 'subheading'
  text: string
}

export type ParagraphBlock = {
  id: BlockId
  type: 'paragraph'
  text: string
}

export type BadgeBlock = {
  id: BlockId
  type: 'badge'
  text: string
}

export type ImageBlock = {
  id: BlockId
  type: 'image'
  src: string
  alt: string
  href?: string
  tone?: 'warm' | 'cool' | 'neutral'
  short?: boolean
  placeholder?: string
}

export type ButtonBlock = {
  id: BlockId
  type: 'button'
  text: string
  url: string
  size?: 'sm' | 'md' | 'lg'
}

export type DividerBlock = {
  id: BlockId
  type: 'divider'
}

export type VideoBlock = {
  id: BlockId
  type: 'video'
  // Either an uploaded video file URL (object URL or hosted) — set `src` —
  // or an embed link (YouTube/Vimeo/Loom) — set `embed_url`.
  src?: string
  embed_url?: string
  thumbnail?: string
}

export type ListBlock = {
  id: BlockId
  type: 'list'
  items: string[]
  ordered?: boolean
}

export type QuoteBlock = {
  id: BlockId
  type: 'quote'
  text: string
  cite?: string
}

// Compact stat / feature columns. Each column is freeform: it can carry an
// icon + title + body (feature trio) or a label + value (event meta block).
export type ColumnsBlockColumn = {
  icon?: string
  title?: string
  body?: string
  label?: string
  value?: string
}

export type ColumnsBlock = {
  id: BlockId
  type: 'columns'
  cols: ColumnsBlockColumn[]
}

export type ChecklistBlockItem = {
  title: string
  body?: string
}

export type ChecklistBlock = {
  id: BlockId
  type: 'checklist'
  items: ChecklistBlockItem[]
}

export type EventCardBlock = {
  id: BlockId
  type: 'event-card'
  date: string
  day: string
  title: string
  meta: string
}

export type ReceiptBlockItem = {
  name: string
  sub?: string
  price: string
}

export type ReceiptBlock = {
  id: BlockId
  type: 'receipt'
  items: ReceiptBlockItem[]
  total: string
}

export type DigestItemBlock = {
  id: BlockId
  type: 'digest-item'
  num: string
  title: string
  meta: string
  body: string
}

export type Block =
  | EyebrowBlock
  | HeadingBlock
  | SubheadingBlock
  | ParagraphBlock
  | BadgeBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | VideoBlock
  | ListBlock
  | QuoteBlock
  | ColumnsBlock
  | ChecklistBlock
  | EventCardBlock
  | ReceiptBlock
  | DigestItemBlock

export type BlockType = Block['type']

export type ContentDoc = {
  version: 1
  // Optional accent colour applied across templated blocks (eyebrow, button,
  // quote bar, column icon backgrounds, digest numerals, event card, etc.).
  accent?: string
  blocks: Block[]
}

export const newId = (): BlockId =>
  // Tiny id helper — collisions across a single document are essentially zero.
  // Using crypto.randomUUID when available, falling back to a timestamp +
  // random suffix for older browsers / SSR.
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const blankBlock = (type: BlockType): Block => {
  switch (type) {
    case 'eyebrow':
      return { id: newId(), type: 'eyebrow', text: 'EYEBROW · LABEL' }
    case 'heading':
      return { id: newId(), type: 'heading', level: 2, text: 'Heading' }
    case 'subheading':
      return { id: newId(), type: 'subheading', text: 'Subheading' }
    case 'paragraph':
      return {
        id: newId(),
        type: 'paragraph',
        text: 'Write your paragraph here…',
      }
    case 'badge':
      return { id: newId(), type: 'badge', text: '✓ Tag' }
    case 'image':
      return {
        id: newId(),
        type: 'image',
        src: '',
        alt: '',
        tone: 'cool',
        placeholder: 'image · 1200×600',
      }
    case 'button':
      return {
        id: newId(),
        type: 'button',
        text: 'Read more',
        url: '',
        size: 'md',
      }
    case 'divider':
      return { id: newId(), type: 'divider' }
    case 'video':
      return { id: newId(), type: 'video' }
    case 'list':
      return {
        id: newId(),
        type: 'list',
        items: ['First point', 'Second point', 'Third point'],
      }
    case 'quote':
      return {
        id: newId(),
        type: 'quote',
        text: 'A short, punchy testimonial goes here.',
        cite: 'Someone you trust',
      }
    case 'columns':
      return {
        id: newId(),
        type: 'columns',
        cols: [
          { icon: 'sparkles', title: 'Title one', body: 'Body copy.' },
          { icon: 'users', title: 'Title two', body: 'Body copy.' },
          { icon: 'book', title: 'Title three', body: 'Body copy.' },
        ],
      }
    case 'checklist':
      return {
        id: newId(),
        type: 'checklist',
        items: [
          { title: 'First step', body: 'Description of step one.' },
          { title: 'Second step', body: 'Description of step two.' },
        ],
      }
    case 'event-card':
      return {
        id: newId(),
        type: 'event-card',
        date: 'MAY 22',
        day: 'THU',
        title: 'Live workshop · Designing under constraint',
        meta: '6:00–7:30 PM PT · Zoom · 80 seats',
      }
    case 'receipt':
      return {
        id: newId(),
        type: 'receipt',
        items: [{ name: 'Item', sub: '', price: '$0.00' }],
        total: '$0.00',
      }
    case 'digest-item':
      return {
        id: newId(),
        type: 'digest-item',
        num: '01',
        title: 'A great story',
        meta: '4 min · Source',
        body: 'A one-line summary of the story.',
      }
  }
}

export const blockLibrary: { type: BlockType; label: string; icon: string }[] =
  [
    { type: 'eyebrow', label: 'Eyebrow', icon: 'tag' },
    { type: 'heading', label: 'Heading', icon: 'heading' },
    { type: 'subheading', label: 'Subheading', icon: 'heading' },
    { type: 'paragraph', label: 'Paragraph', icon: 'text' },
    { type: 'badge', label: 'Badge', icon: 'tag' },
    { type: 'list', label: 'List', icon: 'list' },
    { type: 'quote', label: 'Quote', icon: 'quote' },
    { type: 'columns', label: 'Columns', icon: 'grid' },
    { type: 'image', label: 'Image', icon: 'image' },
    { type: 'video', label: 'Video', icon: 'play' },
    { type: 'button', label: 'Button', icon: 'button-icon' },
    { type: 'divider', label: 'Divider', icon: 'divider' },
  ]

const KNOWN_BLOCK_TYPES = new Set<string>([
  'eyebrow',
  'heading',
  'subheading',
  'paragraph',
  'badge',
  'image',
  'button',
  'divider',
  'video',
  'list',
  'quote',
  'columns',
  'checklist',
  'event-card',
  'receipt',
  'digest-item',
])

export const isContentDoc = (value: unknown): value is ContentDoc => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { version?: unknown; blocks?: unknown }
  if (v.version !== 1 || !Array.isArray(v.blocks)) return false
  return v.blocks.every((b) => {
    if (typeof b !== 'object' || b === null) return false
    const block = b as { type?: unknown; id?: unknown }
    return (
      typeof block.type === 'string' &&
      KNOWN_BLOCK_TYPES.has(block.type) &&
      typeof block.id === 'string' &&
      block.id.length > 0
    )
  })
}
