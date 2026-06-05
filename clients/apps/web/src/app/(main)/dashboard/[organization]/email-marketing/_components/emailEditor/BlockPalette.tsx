'use client'

// Left-rail block library for the broadcast editor.
//
// Mirrors the legacy editor's left palette so creators can discover and
// insert blocks visually (in addition to the `/` slash menu).
//
// Takes `editor` as a prop rather than reading from useCurrentEditor() so
// it works regardless of which @tiptap/react instance Tiptap's context
// resolves to. Parent gets the editor via SpaireEmailEditor's
// onEditorReady callback.
//
// Insertion rules (the previous version got these wrong; see TileRun below):
//
//   1. Always focus at the END of the document. When the user has never
//      clicked into the editor, focus() restores cursor to position 0,
//      which lands inside the Container's edge and makes setNode /
//      toggleHeading / insertContent unreliable — that's the "adds a
//      random paragraph up top" symptom we used to see. focus('end')
//      lands cleanly inside the TrailingNode-managed empty paragraph.
//
//   2. Content-bearing nodes (paragraph, heading, list item, spaireEyebrow,
//      spaireBadge) must be inserted with a non-empty `content` array.
//      ProseMirror's schema validation silently rejects empty inline*
//      nodes, which is the second half of the broken-clicks symptom.
//
//   3. Atom nodes (spaireEventCard, spaireReceipt, spaireDigestItem,
//      spaireChecklist) take no content; their addAttributes defaults
//      cover the initial state.

import {
  Calendar,
  Columns2,
  Columns3,
  Columns4,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MousePointerClick,
  Newspaper,
  Quote,
  Receipt as ReceiptIcon,
  Tag,
  Type,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { Editor } from '@tiptap/react'

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

type TileRun = (editor: Editor) => void

type Tile = {
  label: string
  icon: IconCmp
  run: TileRun
}

type Group = {
  title: string
  tiles: Tile[]
}

// Always focus at the end of the document, never at position 0. See the
// file-level rationale.
const at = (editor: Editor) => editor.chain().focus('end')

const insertNode = (
  type: string,
  body?: { text?: string; attrs?: Record<string, unknown> },
): TileRun => (editor) => {
  const node: Record<string, unknown> = { type }
  if (body?.attrs) node.attrs = body.attrs
  if (body?.text !== undefined) {
    node.content = [{ type: 'text', text: body.text }]
  }
  at(editor).insertContent(node).run()
}

const insertAtom = (type: string): TileRun => (editor) => {
  at(editor).insertContent({ type }).run()
}

const GROUPS: Group[] = [
  {
    title: 'Text',
    tiles: [
      {
        label: 'Text',
        icon: Type,
        run: insertNode('paragraph', { text: 'New paragraph' }),
      },
      {
        label: 'Heading 1',
        icon: Heading1,
        run: insertNode('heading', { attrs: { level: 1 }, text: 'Heading 1' }),
      },
      {
        label: 'Heading 2',
        icon: Heading2,
        run: insertNode('heading', { attrs: { level: 2 }, text: 'Heading 2' }),
      },
      {
        label: 'Heading 3',
        icon: Heading3,
        run: insertNode('heading', { attrs: { level: 3 }, text: 'Heading 3' }),
      },
      {
        label: 'Quote',
        icon: Quote,
        run: (editor) =>
          at(editor)
            .insertContent({
              type: 'blockquote',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Quote' }],
                },
              ],
            })
            .run(),
      },
    ],
  },
  {
    title: 'List',
    tiles: [
      {
        label: 'Bullet',
        icon: List,
        run: (editor) =>
          at(editor)
            .insertContent({
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'List item' }],
                    },
                  ],
                },
              ],
            })
            .run(),
      },
      {
        label: 'Numbered',
        icon: ListOrdered,
        run: (editor) =>
          at(editor)
            .insertContent({
              type: 'orderedList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'List item' }],
                    },
                  ],
                },
              ],
            })
            .run(),
      },
    ],
  },
  {
    title: 'Layout',
    tiles: [
      {
        label: 'Divider',
        icon: Minus,
        run: (editor) =>
          at(editor).insertContent({ type: 'horizontalRule' }).run(),
      },
      {
        label: '2 columns',
        icon: Columns2,
        run: (editor) => at(editor).insertColumns(2).run(),
      },
      {
        label: '3 columns',
        icon: Columns3,
        run: (editor) => at(editor).insertColumns(3).run(),
      },
      {
        label: '4 columns',
        icon: Columns4,
        run: (editor) => at(editor).insertColumns(4).run(),
      },
    ],
  },
  {
    title: 'Media',
    tiles: [
      {
        label: 'Button',
        icon: MousePointerClick,
        run: (editor) => at(editor).setButton().run(),
      },
      {
        label: 'Image',
        icon: ImageIcon,
        run: (editor) => at(editor).uploadImage().run(),
      },
    ],
  },
  {
    title: 'Spaire',
    tiles: [
      {
        label: 'Eyebrow',
        icon: Tag,
        run: insertNode('spaireEyebrow', { text: 'EYEBROW · LABEL' }),
      },
      {
        label: 'Badge',
        icon: Tag,
        run: insertNode('spaireBadge', { text: '✓ Tag' }),
      },
      {
        label: 'Event card',
        icon: Calendar,
        run: insertAtom('spaireEventCard'),
      },
      {
        label: 'Receipt',
        icon: ReceiptIcon,
        run: insertAtom('spaireReceipt'),
      },
      {
        label: 'Digest',
        icon: Newspaper,
        run: insertAtom('spaireDigestItem'),
      },
      {
        label: 'Checklist',
        icon: ListChecks,
        run: insertAtom('spaireChecklist'),
      },
    ],
  },
]

export function BlockPalette({ editor }: { editor: Editor | null }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Blocks
      </div>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            {group.title}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            {group.tiles.map((tile) => {
              const Icon = tile.icon
              return (
                <button
                  key={tile.label}
                  type="button"
                  className="card"
                  style={{
                    padding: '10px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    cursor: editor ? 'pointer' : 'not-allowed',
                    transition: 'all 0.12s',
                    background: '#fff',
                    border: '1px solid var(--line)',
                    opacity: editor ? 1 : 0.4,
                  }}
                  disabled={!editor}
                  // Buttons steal focus from the editor by default;
                  // preventDefault on mousedown keeps the editor's
                  // selection intact across the click.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (editor) tile.run(editor)
                  }}
                  onMouseEnter={(e) => {
                    if (!editor) return
                    e.currentTarget.style.borderColor = 'var(--ink-3)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--ink-2)' }} />
                  <span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>
                    {tile.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
