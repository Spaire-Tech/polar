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

export type ListItem = {
  id: string
  text: string
}

export type ListBlock = {
  id: BlockId
  type: 'list'
  items: ListItem[]
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
  id: string
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
  id: string
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
  id: string
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

// ── Newsletter-specific blocks ──────────────────────────────────────
//
// These exist alongside the broadcast-flavoured blocks above. The
// renderer and editor switch on `type` so old broadcast drafts never
// see them and new newsletter posts can use the full set.

// Large centred serif quotation — distinct from `QuoteBlock` (which is
// the boxed testimonial with an accent bar + cite). A pull quote is a
// visual break in editorial copy, not an endorsement.
export type PullQuoteBlock = {
  id: BlockId
  type: 'pull'
  text: string
}

// Boxed editor's-note / aside. Carries an optional label ("From the
// desk", "Editor's note") rendered above the body.
export type CalloutBlock = {
  id: BlockId
  type: 'callout'
  label?: string
  text: string
}

// Side-by-side photo grid. 2-3 images sharing a single row, each with
// an optional caption.
export type GalleryImage = {
  id: string
  src: string
  alt?: string
  caption?: string
}

export type GalleryBlock = {
  id: BlockId
  type: 'gallery'
  images: GalleryImage[]
}

// Generic third-party embed (X/Twitter, YouTube, Spotify, oEmbed, …).
// Authoring stores just the URL; render resolves it server-side once
// we wire oEmbed (deferred). For V1, the editor offers raw embed_html
// as an escape hatch.
export type EmbedBlock = {
  id: BlockId
  type: 'embed'
  url: string
  embed_html?: string
  caption?: string
}

// Subscriber poll. The vote storage lives in `newsletter_polls` /
// `newsletter_poll_votes` (Phase 1 backend; voting endpoint is Phase 2
// frontend). The block carries the question + option list only; the
// poll-id is allocated server-side on first save.
export type PollOption = {
  id: string
  text: string
}

export type PollBlock = {
  id: BlockId
  type: 'poll'
  question: string
  options: PollOption[]
  // Set on first server save. Used to scope vote queries to this poll
  // even across post duplications.
  poll_id?: string
  allow_multiple?: boolean
}

// Paywall marker. Truncates the render for non-entitled customers and
// inserts an upsell CTA. The cta_text / cta_url default to a
// "Subscribe to <newsletter>" pitch when blank.
export type PaywallBlock = {
  id: BlockId
  type: 'paywall'
  cta_text?: string
  cta_url?: string
  headline?: string
  body?: string
}

// Audio newsletter block. Uploaded MP3/WAV URL or external host
// (Spotify, Apple Podcasts) link. Renders as a styled play card in
// email, native <audio> on the web archive.
export type AudioBlock = {
  id: BlockId
  type: 'audio'
  src?: string
  embed_url?: string
  title?: string
  duration_seconds?: number
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
  | PullQuoteBlock
  | CalloutBlock
  | GalleryBlock
  | EmbedBlock
  | PollBlock
  | PaywallBlock
  | AudioBlock

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
        items: [
          { id: newId(), text: 'First point' },
          { id: newId(), text: 'Second point' },
          { id: newId(), text: 'Third point' },
        ],
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
          {
            id: newId(),
            icon: 'sparkles',
            title: 'Title one',
            body: 'Body copy.',
          },
          {
            id: newId(),
            icon: 'users',
            title: 'Title two',
            body: 'Body copy.',
          },
          {
            id: newId(),
            icon: 'book',
            title: 'Title three',
            body: 'Body copy.',
          },
        ],
      }
    case 'checklist':
      return {
        id: newId(),
        type: 'checklist',
        items: [
          {
            id: newId(),
            title: 'First step',
            body: 'Description of step one.',
          },
          {
            id: newId(),
            title: 'Second step',
            body: 'Description of step two.',
          },
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
        items: [{ id: newId(), name: 'Item', sub: '', price: '$0.00' }],
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
    case 'pull':
      return {
        id: newId(),
        type: 'pull',
        text: 'A short, memorable line worth pulling out.',
      }
    case 'callout':
      return {
        id: newId(),
        type: 'callout',
        label: "Editor's note",
        text: 'A boxed aside readers should notice.',
      }
    case 'gallery':
      return {
        id: newId(),
        type: 'gallery',
        images: [
          { id: newId(), src: '', alt: '' },
          { id: newId(), src: '', alt: '' },
        ],
      }
    case 'embed':
      return {
        id: newId(),
        type: 'embed',
        url: '',
      }
    case 'poll':
      return {
        id: newId(),
        type: 'poll',
        question: 'Ask your subscribers a question',
        options: [
          { id: newId(), text: 'Option one' },
          { id: newId(), text: 'Option two' },
        ],
      }
    case 'paywall':
      return {
        id: newId(),
        type: 'paywall',
        cta_text: 'Subscribe to keep reading',
      }
    case 'audio':
      return {
        id: newId(),
        type: 'audio',
        title: 'Listen to this issue',
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
  'pull',
  'callout',
  'gallery',
  'embed',
  'poll',
  'paywall',
  'audio',
])

// Block library specific to the newsletter post composer. Mirrors the
// design's slash menu — grouped by section, includes the seven new
// newsletter-only block types, and skips broadcast-flavoured items
// (eyebrow, badge, columns, checklist, event-card, receipt,
// digest-item) that don't fit the long-form editorial format.
export const newsletterBlockLibrary: {
  section: string
  items: { type: BlockType; label: string; desc: string; icon: string }[]
}[] = [
  {
    section: 'Text',
    items: [
      { type: 'heading', label: 'Heading', desc: 'Section title', icon: 'heading' },
      { type: 'subheading', label: 'Subheading', desc: 'Smaller heading', icon: 'heading' },
      { type: 'paragraph', label: 'Paragraph', desc: 'Body text', icon: 'text' },
      { type: 'quote', label: 'Quote', desc: 'Boxed testimonial', icon: 'quote' },
      { type: 'pull', label: 'Pull quote', desc: 'Large centred line', icon: 'quote' },
      { type: 'list', label: 'List', desc: 'Bulleted or numbered', icon: 'list' },
    ],
  },
  {
    section: 'Media',
    items: [
      { type: 'image', label: 'Image', desc: 'Full-width photo', icon: 'image' },
      { type: 'gallery', label: 'Gallery', desc: 'Side-by-side photos', icon: 'grid' },
      { type: 'video', label: 'Video', desc: 'YouTube, Vimeo, Loom', icon: 'play' },
      { type: 'audio', label: 'Audio', desc: 'Podcast / voiceover', icon: 'play' },
      { type: 'embed', label: 'Embed', desc: 'X, Spotify, oEmbed', icon: 'link' },
    ],
  },
  {
    section: 'Structure',
    items: [
      { type: 'divider', label: 'Divider', desc: 'Section break', icon: 'divider' },
      { type: 'button', label: 'Button', desc: 'Call to action', icon: 'button-icon' },
      { type: 'callout', label: 'Callout', desc: 'Highlighted aside', icon: 'info' },
    ],
  },
  {
    section: 'Advanced',
    items: [
      { type: 'poll', label: 'Poll', desc: 'Ask your subscribers', icon: 'list' },
      { type: 'paywall', label: 'Paywall', desc: 'Gate premium content', icon: 'lock' },
    ],
  },
]

/**
 * Coerce a freshly-loaded ContentDoc into the canonical shape.
 *
 * Older drafts on disk carry list items as `string[]` and column / checklist
 * / receipt items without per-item ids. Migrating in-place on load lets the
 * rest of the editor assume every nested item has a stable id (which keeps
 * React's reconciliation correct when the user reorders or deletes items).
 */
export function normalizeContentDoc(doc: ContentDoc): ContentDoc {
  return {
    ...doc,
    blocks: doc.blocks.map((b): Block => normalizeBlock(b)),
  }
}

function normalizeBlock(block: Block): Block {
  switch (block.type) {
    case 'list': {
      const raw = block.items as unknown
      if (Array.isArray(raw)) {
        const items = raw.map((it) => {
          if (typeof it === 'string') return { id: newId(), text: it }
          if (it && typeof it === 'object') {
            const obj = it as { id?: unknown; text?: unknown }
            return {
              id: typeof obj.id === 'string' && obj.id ? obj.id : newId(),
              text: typeof obj.text === 'string' ? obj.text : '',
            }
          }
          return { id: newId(), text: '' }
        })
        return { ...block, items }
      }
      return { ...block, items: [] }
    }
    case 'columns':
      return {
        ...block,
        cols: (block.cols ?? []).map((c) => ({
          ...c,
          id: c.id || newId(),
        })),
      }
    case 'checklist':
      return {
        ...block,
        items: (block.items ?? []).map((it) => ({
          ...it,
          id: it.id || newId(),
        })),
      }
    case 'receipt':
      return {
        ...block,
        items: (block.items ?? []).map((it) => ({
          ...it,
          id: it.id || newId(),
        })),
      }
    default:
      return block
  }
}

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
