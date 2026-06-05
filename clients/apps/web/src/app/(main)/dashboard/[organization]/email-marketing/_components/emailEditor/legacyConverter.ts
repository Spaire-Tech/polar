// Converts a legacy broadcast ContentDoc (custom block schema from
// _components/blockEditor/types.ts) into a TipTap JSONContent document the
// new @react-email/editor wrapper can load via its `content` prop.
//
// Only writes block shapes that already exist on the new editor — built-ins
// from @react-email/editor/extensions for paragraph/heading/list/quote/
// button/image/divider/columns, and the six Spaire custom nodes for the
// bespoke blocks (eyebrow, badge, eventCard, receipt, digestItem,
// checklist). Anything unknown is dropped rather than smuggled through as
// invalid JSON.
//
// One-way: produces TipTap JSON to load into the new editor. The reverse
// direction is unnecessary — once a broadcast is migrated it lives in
// TipTap-JSON form and the legacy renderer is retired.

import type { JSONContent } from '@tiptap/react'

import type {
  Block,
  ContentDoc,
} from '../blockEditor/types'

const text = (value: string): JSONContent[] =>
  value.length > 0 ? [{ type: 'text', text: value }] : []

const paragraph = (value: string): JSONContent => ({
  type: 'paragraph',
  content: text(value),
})

/** Convert a single legacy block. Returns null for blocks we choose to drop. */
function convertBlock(block: Block, accent: string | undefined): JSONContent | null {
  switch (block.type) {
    case 'eyebrow':
      return {
        type: 'spaireEyebrow',
        attrs: { accent: accent ?? '#4f46e5' },
        content: text(block.text),
      }

    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: text(block.text),
      }

    case 'subheading':
      // Subheadings stored separately in the legacy schema map cleanly to h3.
      return {
        type: 'heading',
        attrs: { level: 3 },
        content: text(block.text),
      }

    case 'paragraph':
      return paragraph(block.text)

    case 'badge':
      return { type: 'spaireBadge', content: text(block.text) }

    case 'image':
      if (!block.src) return null
      return {
        type: 'image',
        attrs: { src: block.src, alt: block.alt, href: block.href ?? null },
      }

    case 'button':
      return {
        type: 'button',
        attrs: { href: block.url || '#', alignment: 'left' },
        content: text(block.text),
      }

    case 'divider':
      return { type: 'divider' }

    case 'video':
      // Email clients don't render video tags. Surface as a captioned image
      // link if available, otherwise drop. The legacy schema only stores
      // links, so we represent the fallback as a paragraph with the URL.
      if (block.embed_url) return paragraph(block.embed_url)
      return null

    case 'list': {
      const listType = block.ordered ? 'orderedList' : 'bulletList'
      return {
        type: listType,
        content: block.items.map((it) => ({
          type: 'listItem',
          content: [paragraph(it.text)],
        })),
      }
    }

    case 'quote':
      return {
        type: 'blockquote',
        content: [
          paragraph(block.text),
          ...(block.cite ? [paragraph(`— ${block.cite}`)] : []),
        ],
      }

    case 'columns': {
      // Map to the built-in column container that matches the legacy column
      // count (2/3/4). Anything outside that range degrades to twoColumns.
      const count = block.cols.length
      const containerType =
        count === 3 ? 'threeColumns' : count === 4 ? 'fourColumns' : 'twoColumns'
      const targetCount = count === 3 ? 3 : count === 4 ? 4 : 2
      const cols = block.cols.slice(0, targetCount).map((c) => ({
        type: 'columnsColumn',
        content: [
          ...(c.title ? [paragraph(c.title)] : []),
          ...(c.body ? [paragraph(c.body)] : []),
          ...(c.label || c.value
            ? [paragraph([c.label, c.value].filter(Boolean).join(': '))]
            : []),
        ],
      }))
      return { type: containerType, content: cols }
    }

    case 'checklist':
      return {
        type: 'spaireChecklist',
        attrs: {
          items: block.items.map((it) => ({ title: it.title, body: it.body ?? '' })),
          accent: accent ?? '#4f46e5',
        },
      }

    case 'event-card':
      return {
        type: 'spaireEventCard',
        attrs: {
          day: block.day,
          date: block.date,
          title: block.title,
          meta: block.meta,
          accent: accent ?? '#4f46e5',
        },
      }

    case 'receipt':
      return {
        type: 'spaireReceipt',
        attrs: {
          items: block.items.map((it) => ({
            name: it.name,
            sub: it.sub ?? '',
            price: it.price,
          })),
          total: block.total,
        },
      }

    case 'digest-item':
      return {
        type: 'spaireDigestItem',
        attrs: {
          num: block.num,
          title: block.title,
          meta: block.meta,
          body: block.body,
          accent: accent ?? '#4f46e5',
        },
      }
  }
}

/**
 * Convert a stored legacy ContentDoc to TipTap JSON.
 *
 * Pass the result straight to <SpaireEmailEditor content={...} />.
 */
export function legacyDocToTipTap(doc: ContentDoc): JSONContent {
  return {
    type: 'doc',
    content: doc.blocks
      .map((b) => convertBlock(b, doc.accent))
      .filter((b): b is JSONContent => b !== null),
  }
}
