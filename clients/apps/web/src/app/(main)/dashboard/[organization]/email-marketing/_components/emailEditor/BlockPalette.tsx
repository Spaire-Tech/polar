'use client'

// Left-rail block library for the broadcast editor.
//
// Mirrors the legacy editor's left palette so creators can discover and
// insert blocks visually (in addition to the `/` slash menu). Each tile
// runs the same command a slash item would — keeps the two entry points
// consistent.
//
// Takes `editor` as a prop instead of pulling from useCurrentEditor() so
// it works regardless of which @tiptap/react instance Tiptap's context
// resolves to (pnpm can land us with multiple). Parent gets the editor
// via SpaireEmailEditor's onEditorReady callback.

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

type Tile = {
  label: string
  icon: IconCmp
  run: (editor: Editor) => void
}

type Group = {
  title: string
  tiles: Tile[]
}

const insertContent = (type: string, extra?: Record<string, unknown>) =>
  (editor: Editor) => {
    editor.chain().focus().insertContent({ type, ...(extra ?? {}) }).run()
  }

const GROUPS: Group[] = [
  {
    title: 'Text',
    tiles: [
      { label: 'Text', icon: Type, run: insertContent('paragraph') },
      {
        label: 'Heading 1',
        icon: Heading1,
        run: (editor) =>
          editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: 'Heading 2',
        icon: Heading2,
        run: (editor) =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: 'Heading 3',
        icon: Heading3,
        run: (editor) =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        label: 'Quote',
        icon: Quote,
        run: (editor) => editor.chain().focus().toggleBlockquote().run(),
      },
    ],
  },
  {
    title: 'List',
    tiles: [
      {
        label: 'Bullet',
        icon: List,
        run: (editor) => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: 'Numbered',
        icon: ListOrdered,
        run: (editor) => editor.chain().focus().toggleOrderedList().run(),
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
          editor.chain().focus().insertContent({ type: 'horizontalRule' }).run(),
      },
      {
        label: '2 columns',
        icon: Columns2,
        run: (editor) => editor.chain().focus().insertColumns(2).run(),
      },
      {
        label: '3 columns',
        icon: Columns3,
        run: (editor) => editor.chain().focus().insertColumns(3).run(),
      },
      {
        label: '4 columns',
        icon: Columns4,
        run: (editor) => editor.chain().focus().insertColumns(4).run(),
      },
    ],
  },
  {
    title: 'Media',
    tiles: [
      {
        label: 'Button',
        icon: MousePointerClick,
        run: (editor) => editor.chain().focus().setButton().run(),
      },
      {
        label: 'Image',
        icon: ImageIcon,
        run: (editor) => editor.chain().focus().uploadImage().run(),
      },
    ],
  },
  {
    title: 'Spaire',
    tiles: [
      { label: 'Eyebrow', icon: Tag, run: insertContent('spaireEyebrow') },
      { label: 'Badge', icon: Tag, run: insertContent('spaireBadge') },
      { label: 'Event card', icon: Calendar, run: insertContent('spaireEventCard') },
      { label: 'Receipt', icon: ReceiptIcon, run: insertContent('spaireReceipt') },
      { label: 'Digest', icon: Newspaper, run: insertContent('spaireDigestItem') },
      { label: 'Checklist', icon: ListChecks, run: insertContent('spaireChecklist') },
    ],
  },
]

export function BlockPalette({ editor }: { editor: Editor | null }) {

  return (
    <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
