'use client'

import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { pmDocToRuns, runsToPMDoc } from './convert'
import { RichText, runsToText } from './types'

// A single-line rich-text field for one text block. Per-SELECTION marks
// (bold / italic / link) — the thing the old editor couldn't do. TipTap's
// schema is locked to exactly these marks, so pasting from Word/Docs/web is
// normalized to plain text + those marks (no foreign fonts/sizes can leak in).
//
// onChange hands back both the runs (canonical) and the plain text (kept in
// sync so the legacy renderer / search keep working).

export function RichTextField({
  value,
  onChange,
  placeholder,
  className,
  style,
}: {
  value: RichText | undefined
  onChange: (next: { rich: RichText; text: string }) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [focused, setFocused] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  // Guards the onUpdate->onChange->value->setContent loop.
  const emitting = useRef(false)

  const editor = useEditor({
    immediatelyRender: false, // required under Next SSR
    extensions: [
      StarterKit.configure({
        // Lock the schema to a single paragraph of bold/italic text — no
        // headings, lists, quotes, code, rules, or strike at this level
        // (those are block-level choices in the outer editor).
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        // Only http(s)/mailto links survive; everything else is dropped.
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: runsToPMDoc(value),
    editorProps: {
      attributes: { class: 'rt-field' },
      // Block model = one line per block. Enter does not create a paragraph;
      // the user adds a new block instead.
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          return true
        }
        return false
      },
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      // Delay so a click on a toolbar button isn't read as a blur-away.
      window.setTimeout(() => setFocused(false), 120)
    },
    onUpdate: ({ editor }) => {
      const rich = pmDocToRuns(editor.getJSON() as never)
      emitting.current = true
      onChange({ rich, text: runsToText(rich) })
      emitting.current = false
    },
  })

  // Keep the editor in sync if the value is replaced from outside (e.g. an
  // undo/redo or a programmatic edit) — but not for our own emissions.
  useEffect(() => {
    if (!editor || emitting.current) return
    const current = pmDocToRuns(editor.getJSON() as never)
    if (runsToText(current) === runsToText(value)) return
    editor.commands.setContent(runsToPMDoc(value), { emitUpdate: false })
  }, [value, editor])

  if (!editor) return null

  const applyLink = () => {
    const url = linkUrl.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (url) chain.setLink({ href: url }).run()
    else chain.unsetLink().run()
    setLinkOpen(false)
    setLinkUrl('')
  }

  const showToolbar = focused || linkOpen

  return (
    <div style={{ position: 'relative' }}>
      {showToolbar && (
        <div
          // Mousedown-preventDefault keeps the editor selection alive while a
          // toolbar button is clicked.
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: -38,
            left: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 4,
            borderRadius: 10,
            background: '#1d1d1f',
            boxShadow: '0 8px 24px rgba(0,0,0,.22)',
          }}
        >
          <ToolButton
            active={editor.isActive('bold')}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <b>B</b>
          </ToolButton>
          <ToolButton
            active={editor.isActive('italic')}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i>i</i>
          </ToolButton>
          <ToolButton
            active={editor.isActive('link') || linkOpen}
            label="Link"
            onClick={() => {
              const prev = editor.getAttributes('link').href
              setLinkUrl(typeof prev === 'string' ? prev : '')
              setLinkOpen((o) => !o)
            }}
          >
            <span style={{ fontSize: 13 }}>🔗</span>
          </ToolButton>
          {linkOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <input
                autoFocus
                value={linkUrl}
                placeholder="https://…"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink()
                  } else if (e.key === 'Escape') {
                    setLinkOpen(false)
                  }
                }}
                style={{
                  width: 180,
                  height: 26,
                  border: 'none',
                  outline: 'none',
                  borderRadius: 6,
                  padding: '0 8px',
                  fontSize: 12.5,
                  background: '#fff',
                  color: '#1d1d1f',
                }}
              />
              <button
                onClick={applyLink}
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#0066cc',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {linkUrl.trim() ? 'Apply' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      )}
      <EditorContent editor={editor} className={className} style={style} />
    </div>
  )
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        minWidth: 28,
        height: 28,
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'rgba(255,255,255,.22)' : 'transparent',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}
