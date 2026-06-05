// Spaire-specific EmailNode extensions for the broadcast editor.
//
// Six bespoke blocks the broadcast editor supported before this migration,
// ported to @react-email/editor EmailNodes:
//
//   eyebrow      — a tiny uppercase label (typable inline text)
//   badge        — a pill tag (typable inline text)
//   eventCard    — coloured card with date + title + meta (structured atom)
//   receipt      — itemised list with a total row (structured atom)
//   digestItem   — numbered story block (structured atom)
//   checklist    — numbered steps (structured atom)
//
// Two patterns are used, following the React Email "Custom Extensions" guide:
//
//   * Text blocks (eyebrow, badge) use `content: 'inline*'` with a content
//     hole (`0`) in renderHTML, so users type directly into them like any
//     paragraph.
//   * Structured blocks (eventCard, receipt, digestItem, checklist) hold
//     their data in node attributes and are atoms. Their fields are edited
//     through the Inspector's Attributes panel. (A richer inline NodeView is
//     a future enhancement; attribute editing is the documented path today.)
//
// Each node exposes:
//   - parseHTML / renderHTML   → how it looks while editing
//   - renderToReactEmail       → React Email output for composeReactEmail
//
// `spaireSlashItems` registers each block in the slash (`/`) menu so creators
// can insert them. The data shapes mirror blockEditor/types.ts so the
// legacy → TipTap converter maps fields 1:1.

import { Column, Heading, Row, Section, Text } from '@react-email/components'
import { EmailNode } from '@react-email/editor/core'
import type { SlashCommandItem } from '@react-email/editor/ui'
// mergeAttributes lives in @tiptap/core; import via @tiptap/react, which
// re-exports it and is the package this app depends on directly.
import { mergeAttributes } from '@tiptap/react'
import {
  Calendar,
  ListChecks,
  Newspaper,
  Receipt as ReceiptIcon,
  Tag,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a `data-*` attribute from a DOM element with a default fallback. */
const attr = (el: HTMLElement, key: string, fallback = '') =>
  el.getAttribute(`data-${key}`) ?? fallback

// ---------------------------------------------------------------------------
// Eyebrow — typable inline text
// ---------------------------------------------------------------------------

export const Eyebrow = EmailNode.create({
  name: 'spaireEyebrow',
  group: 'block',
  content: 'inline*',
  draggable: true,

  addAttributes() {
    return { accent: { default: '#4f46e5' } }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spaire-node="eyebrow"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          return { accent: attr(node as HTMLElement, 'accent', '#4f46e5') }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const accent = (node.attrs.accent as string) || '#4f46e5'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'eyebrow',
        'data-accent': accent,
        style: `font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};font-weight:600;margin:0 0 8px;`,
      }),
      0,
    ]
  },

  renderToReactEmail({ children, node, style }) {
    const accent = (node.attrs?.accent as string) || '#4f46e5'
    return (
      <Text
        style={{
          ...style,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
          margin: '0 0 8px',
        }}
      >
        {children}
      </Text>
    )
  },
})

// ---------------------------------------------------------------------------
// Badge — typable inline text
// ---------------------------------------------------------------------------

export const Badge = EmailNode.create({
  name: 'spaireBadge',
  group: 'block',
  content: 'inline*',
  draggable: true,

  parseHTML() {
    return [{ tag: 'span[data-spaire-node="badge"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'badge',
        style:
          'display:inline-block;font-size:12px;padding:5px 11px;background:#111;color:#fff;border-radius:999px;font-weight:500;margin:0 0 14px;',
      }),
      0,
    ]
  },

  renderToReactEmail({ children, style }) {
    return (
      <Text
        style={{
          ...style,
          display: 'inline-block',
          fontSize: 12,
          padding: '5px 11px',
          background: '#111',
          color: '#fff',
          borderRadius: 999,
          fontWeight: 500,
          margin: '0 0 14px',
        }}
      >
        {children}
      </Text>
    )
  },
})

// ---------------------------------------------------------------------------
// Event Card — structured atom
// ---------------------------------------------------------------------------

export const EventCard = EmailNode.create({
  name: 'spaireEventCard',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      day: { default: 'THU' },
      date: { default: 'MAY 22' },
      title: { default: 'Live workshop · Designing under constraint' },
      meta: { default: '6:00–7:30 PM PT · Zoom · 80 seats' },
      accent: { default: '#4f46e5' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spaire-node="event-card"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLElement
          return {
            day: attr(el, 'day', 'THU'),
            date: attr(el, 'date', 'MAY 22'),
            title: attr(el, 'title', ''),
            meta: attr(el, 'meta', ''),
            accent: attr(el, 'accent', '#4f46e5'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs
    const accent = (a.accent as string) || '#4f46e5'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'event-card',
        'data-day': a.day as string,
        'data-date': a.date as string,
        'data-title': a.title as string,
        'data-meta': a.meta as string,
        'data-accent': accent,
        style: `margin:8px 0 18px;background:${accent};color:#fff;border-radius:10px;padding:20px;display:flex;gap:18px;`,
      }),
      [
        'div',
        {
          style:
            'background:rgba(255,255,255,0.15);border-radius:8px;padding:10px;text-align:center;min-width:80px;',
        },
        ['div', { style: 'font-size:10px;letter-spacing:0.1em;opacity:0.8;' }, a.day as string],
        [
          'div',
          { style: 'font-size:18px;font-weight:700;letter-spacing:-0.02em;margin-top:2px;' },
          a.date as string,
        ],
      ],
      [
        'div',
        { style: 'flex:1;' },
        [
          'div',
          {
            style:
              'font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;',
          },
          "You're invited",
        ],
        [
          'div',
          {
            style:
              'font-size:17px;font-weight:600;letter-spacing:-0.01em;margin-bottom:6px;line-height:1.25;',
          },
          a.title as string,
        ],
        ['div', { style: 'font-size:12px;opacity:0.85;' }, a.meta as string],
      ],
    ]
  },

  renderToReactEmail({ node, style }) {
    const a = node.attrs ?? {}
    const accent = (a.accent as string) || '#4f46e5'
    return (
      <Section
        style={{
          ...style,
          margin: '8px 0 18px',
          background: accent,
          color: '#fff',
          borderRadius: 10,
          padding: 20,
        }}
      >
        <Row>
          <Column
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: 10,
              textAlign: 'center',
              width: 80,
            }}
          >
            <Text style={{ fontSize: 10, letterSpacing: '0.1em', opacity: 0.8, margin: 0 }}>
              {a.day as string}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: '2px 0 0' }}>
              {a.date as string}
            </Text>
          </Column>
          <Column style={{ paddingLeft: 18 }}>
            <Text style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>
              You're invited
            </Text>
            <Heading
              as="h3"
              style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 6px', lineHeight: 1.25, color: '#fff' }}
            >
              {a.title as string}
            </Heading>
            <Text style={{ fontSize: 12, opacity: 0.85, margin: 0 }}>{a.meta as string}</Text>
          </Column>
        </Row>
      </Section>
    )
  },
})

// ---------------------------------------------------------------------------
// Receipt — structured atom
// ---------------------------------------------------------------------------

export type ReceiptItem = { name: string; sub?: string; price: string }

export const Receipt = EmailNode.create({
  name: 'spaireReceipt',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      items: {
        default: [{ name: 'Item', sub: '', price: '$0.00' }] as ReceiptItem[],
      },
      total: { default: '$0.00' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spaire-node="receipt"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLElement
          const raw = el.getAttribute('data-items')
          let items: ReceiptItem[] = []
          try {
            items = raw ? (JSON.parse(raw) as ReceiptItem[]) : []
          } catch {
            items = []
          }
          return { items, total: attr(el, 'total', '$0.00') }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const items = (node.attrs.items as ReceiptItem[]) || []
    const total = (node.attrs.total as string) || '$0.00'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'receipt',
        'data-items': JSON.stringify(items),
        'data-total': total,
        style: 'margin:16px 0;background:#fafafa;border:1px solid #efefef;border-radius:10px;padding:20px;',
      }),
      ...items.map((it) => [
        'div',
        {
          style:
            'display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #efefef;gap:12px;',
        },
        [
          'div',
          { style: 'flex:1;' },
          ['div', { style: 'font-size:13.5px;font-weight:500;color:#111;' }, it.name],
          ...(it.sub
            ? [['div', { style: 'font-size:11.5px;color:#888;margin-top:2px;' }, it.sub] as const]
            : []),
        ],
        ['div', { style: 'font-size:13.5px;font-weight:600;font-family:monospace;color:#111;' }, it.price],
      ]),
      [
        'div',
        {
          style:
            'display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;border-top:2px solid #111;',
        },
        ['span', { style: 'font-size:13px;font-weight:600;' }, 'Total'],
        ['span', { style: 'font-size:15px;font-weight:700;font-family:monospace;' }, total],
      ],
    ]
  },

  renderToReactEmail({ node, style }) {
    const items = (node.attrs?.items as ReceiptItem[]) || []
    const total = (node.attrs?.total as string) || '$0.00'
    return (
      <Section
        style={{
          ...style,
          margin: '16px 0',
          background: '#fafafa',
          border: '1px solid #efefef',
          borderRadius: 10,
          padding: 20,
        }}
      >
        {items.map((it, i) => (
          <Row key={i} style={{ padding: '10px 0', borderBottom: '1px solid #efefef' }}>
            <Column>
              <Text style={{ fontSize: 13.5, fontWeight: 500, color: '#111', margin: 0 }}>
                {it.name}
              </Text>
              {it.sub ? (
                <Text style={{ fontSize: 11.5, color: '#888', margin: '2px 0 0' }}>{it.sub}</Text>
              ) : null}
            </Column>
            <Column align="right">
              <Text style={{ fontSize: 13.5, fontWeight: 600, fontFamily: 'monospace', color: '#111', margin: 0 }}>
                {it.price}
              </Text>
            </Column>
          </Row>
        ))}
        <Row style={{ paddingTop: 12, borderTop: '2px solid #111' }}>
          <Column>
            <Text style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Total</Text>
          </Column>
          <Column align="right">
            <Text style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', margin: 0 }}>
              {total}
            </Text>
          </Column>
        </Row>
      </Section>
    )
  },
})

// ---------------------------------------------------------------------------
// Digest Item — structured atom
// ---------------------------------------------------------------------------

export const DigestItem = EmailNode.create({
  name: 'spaireDigestItem',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      num: { default: '01' },
      title: { default: 'A great story' },
      meta: { default: '4 min · Source' },
      body: { default: 'A one-line summary of the story.' },
      accent: { default: '#4f46e5' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spaire-node="digest-item"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLElement
          return {
            num: attr(el, 'num', '01'),
            title: attr(el, 'title', ''),
            meta: attr(el, 'meta', ''),
            body: attr(el, 'body', ''),
            accent: attr(el, 'accent', '#4f46e5'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs
    const accent = (a.accent as string) || '#4f46e5'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'digest-item',
        'data-num': a.num as string,
        'data-title': a.title as string,
        'data-meta': a.meta as string,
        'data-body': a.body as string,
        'data-accent': accent,
        style: 'margin:14px 0;display:flex;gap:14px;',
      }),
      [
        'div',
        {
          style: `font-size:20px;font-weight:700;color:${accent};font-family:monospace;line-height:1;min-width:48px;`,
        },
        a.num as string,
      ],
      [
        'div',
        { style: 'flex:1;' },
        [
          'div',
          {
            style:
              'font-size:15px;font-weight:600;color:#111;letter-spacing:-0.01em;margin-bottom:3px;line-height:1.3;',
          },
          a.title as string,
        ],
        [
          'div',
          {
            style:
              'font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px;',
          },
          a.meta as string,
        ],
        ['div', { style: 'font-size:13px;color:#444;line-height:1.55;' }, a.body as string],
      ],
    ]
  },

  renderToReactEmail({ node, style }) {
    const a = node.attrs ?? {}
    const accent = (a.accent as string) || '#4f46e5'
    return (
      <Section style={{ ...style, margin: '14px 0' }}>
        <Row>
          <Column style={{ width: 48 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: 'monospace', lineHeight: 1, margin: 0 }}>
              {a.num as string}
            </Text>
          </Column>
          <Column style={{ paddingLeft: 14 }}>
            <Heading as="h3" style={{ fontSize: 15, fontWeight: 600, color: '#111', letterSpacing: '-0.01em', margin: '0 0 3px', lineHeight: 1.3 }}>
              {a.title as string}
            </Heading>
            <Text style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>
              {a.meta as string}
            </Text>
            <Text style={{ fontSize: 13, color: '#444', lineHeight: 1.55, margin: 0 }}>
              {a.body as string}
            </Text>
          </Column>
        </Row>
      </Section>
    )
  },
})

// ---------------------------------------------------------------------------
// Checklist — structured atom
// ---------------------------------------------------------------------------

export type ChecklistItem = { title: string; body?: string }

export const Checklist = EmailNode.create({
  name: 'spaireChecklist',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      items: {
        default: [
          { title: 'First step', body: 'Description of step one.' },
          { title: 'Second step', body: 'Description of step two.' },
        ] as ChecklistItem[],
      },
      accent: { default: '#4f46e5' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spaire-node="checklist"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLElement
          const raw = el.getAttribute('data-items')
          let items: ChecklistItem[] = []
          try {
            items = raw ? (JSON.parse(raw) as ChecklistItem[]) : []
          } catch {
            items = []
          }
          return { items, accent: attr(el, 'accent', '#4f46e5') }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const items = (node.attrs.items as ChecklistItem[]) || []
    const accent = (node.attrs.accent as string) || '#4f46e5'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spaire-node': 'checklist',
        'data-items': JSON.stringify(items),
        'data-accent': accent,
        style: 'margin:16px 0;background:#fafafa;border:1px solid #efefef;border-radius:8px;padding:14px;',
      }),
      ...items.map((it, i) => [
        'div',
        { style: 'display:flex;gap:12px;padding:6px 0;' },
        [
          'div',
          {
            style: `width:22px;height:22px;border-radius:22px;background:${accent};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0;`,
          },
          String(i + 1),
        ],
        [
          'div',
          { style: 'flex:1;' },
          ['div', { style: 'font-size:13.5px;font-weight:600;color:#111;margin-bottom:2px;' }, it.title],
          ...(it.body
            ? [['div', { style: 'font-size:12px;color:#666;line-height:1.5;' }, it.body] as const]
            : []),
        ],
      ]),
    ]
  },

  renderToReactEmail({ node, style }) {
    const items = (node.attrs?.items as ChecklistItem[]) || []
    const accent = (node.attrs?.accent as string) || '#4f46e5'
    return (
      <Section
        style={{
          ...style,
          margin: '16px 0',
          background: '#fafafa',
          border: '1px solid #efefef',
          borderRadius: 8,
          padding: 14,
        }}
      >
        {items.map((it, i) => (
          <Row key={i} style={{ padding: '6px 0' }}>
            <Column style={{ width: 22 }}>
              <Text
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 22,
                  background: accent,
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                  lineHeight: '22px',
                }}
              >
                {i + 1}
              </Text>
            </Column>
            <Column style={{ paddingLeft: 12 }}>
              <Text style={{ fontSize: 13.5, fontWeight: 600, color: '#111', margin: '0 0 2px' }}>
                {it.title}
              </Text>
              {it.body ? (
                <Text style={{ fontSize: 12, color: '#666', lineHeight: 1.5, margin: 0 }}>
                  {it.body}
                </Text>
              ) : null}
            </Column>
          </Row>
        ))}
      </Section>
    )
  },
})

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** All six custom nodes, to spread into the editor's extensions array. */
export const spaireCustomNodes = [Eyebrow, Badge, EventCard, Receipt, DigestItem, Checklist]

/** Slash-menu entries so creators can insert each custom block via "/". */
export const spaireSlashItems: SlashCommandItem[] = [
  {
    title: 'Eyebrow',
    description: 'Small uppercase label',
    icon: <Tag size={18} />,
    category: 'Spaire',
    searchTerms: ['eyebrow', 'label', 'kicker'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'spaireEyebrow',
          content: [{ type: 'text', text: 'EYEBROW · LABEL' }],
        })
        .run(),
  },
  {
    title: 'Badge',
    description: 'Pill tag',
    icon: <Tag size={18} />,
    category: 'Spaire',
    searchTerms: ['badge', 'pill', 'tag'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'spaireBadge',
          content: [{ type: 'text', text: '✓ Tag' }],
        })
        .run(),
  },
  {
    title: 'Event card',
    description: 'Date + title + meta card',
    icon: <Calendar size={18} />,
    category: 'Spaire',
    searchTerms: ['event', 'invite', 'workshop'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: 'spaireEventCard' }).run(),
  },
  {
    title: 'Receipt',
    description: 'Itemised receipt with total',
    icon: <ReceiptIcon size={18} />,
    category: 'Spaire',
    searchTerms: ['receipt', 'order', 'invoice'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: 'spaireReceipt' }).run(),
  },
  {
    title: 'Digest item',
    description: 'Numbered story block',
    icon: <Newspaper size={18} />,
    category: 'Spaire',
    searchTerms: ['digest', 'story', 'news'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: 'spaireDigestItem' }).run(),
  },
  {
    title: 'Checklist',
    description: 'Numbered steps',
    icon: <ListChecks size={18} />,
    category: 'Spaire',
    searchTerms: ['checklist', 'steps', 'todo'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: 'spaireChecklist' }).run(),
  },
]
