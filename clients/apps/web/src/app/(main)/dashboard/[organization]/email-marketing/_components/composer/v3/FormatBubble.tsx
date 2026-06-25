'use client'

// Inline formatting bubble (brick 4): appears over a non-empty text selection
// inside a text/heading block. Bold / Italic / Underline / Strike / Link, all
// driven by our own TipTap editor (React Email marks). Positioned from the
// selection's viewport coords; styled on-brand with the design's float-pop.

import type { Editor } from '@tiptap/react'
import { useEffect, useReducer, useState } from 'react'

function Ico({ d }: { d: string }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

export function FormatBubble({ editor }: { editor: Editor | null }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  // When the link form is open we pin to the range it was opened on, so a
  // momentary selection change (clicking the link button / typing in the
  // field) can't dismiss the bubble or misapply the link.
  const [linkRange, setLinkRange] = useState<{ from: number; to: number } | null>(
    null,
  )
  const [linkVal, setLinkVal] = useState('')
  const linkOpen = linkRange !== null

  useEffect(() => {
    if (!editor) return
    const f = () => force()
    editor.on('selectionUpdate', f)
    editor.on('transaction', f)
    editor.on('blur', f)
    editor.on('focus', f)
    window.addEventListener('resize', f)
    window.addEventListener('scroll', f, true)
    return () => {
      editor.off('selectionUpdate', f)
      editor.off('transaction', f)
      editor.off('blur', f)
      editor.off('focus', f)
      window.removeEventListener('resize', f)
      window.removeEventListener('scroll', f, true)
    }
  }, [editor])

  if (!editor) return null
  const { selection } = editor.state
  const { from, to, empty } = selection
  // Show for a real text range in a text block — or whenever the link form is
  // open (pinned to its captured range).
  if (!linkOpen) {
    if (empty || from === to) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(selection as any).$from?.parent?.isTextblock) return null
  }

  const pFrom = linkRange ? linkRange.from : from
  const pTo = linkRange ? linkRange.to : to
  let start
  try {
    start = editor.view.coordsAtPos(pFrom)
  } catch {
    return null
  }
  const end = (() => {
    try {
      return editor.view.coordsAtPos(pTo)
    } catch {
      return start
    }
  })()
  const top = Math.min(start.top, end.top)
  const left = (start.left + end.left) / 2

  const on = (m: string) => editor.isActive(m)
  const btn = (key: string, label: string, node: React.ReactNode, run: () => void) => (
    <button
      className={'fmt-btn' + (on(key) ? ' on' : '')}
      title={label}
      data-fmt={key}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {node}
    </button>
  )

  const applyLink = () => {
    if (!linkRange) return
    const href = linkVal.trim()
    const chain = editor
      .chain()
      .focus()
      .setTextSelection(linkRange)
      .extendMarkRange('link')
    if (href) chain.setLink({ href }).run()
    else chain.unsetLink().run()
    setLinkRange(null)
    setLinkVal('')
  }

  return (
    <div
      className="fmt-bubble"
      style={{
        position: 'fixed',
        top: top - 10,
        left,
        transform: 'translate(-50%, -100%)',
        zIndex: 550,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {!linkOpen ? (
        <>
          {btn('bold', 'Bold', <b>B</b>, () =>
            editor.chain().focus().toggleBold().run(),
          )}
          {btn('italic', 'Italic', <span style={{ fontStyle: 'italic' }}>I</span>, () =>
            editor.chain().focus().toggleItalic().run(),
          )}
          {btn(
            'underline',
            'Underline',
            <span style={{ textDecoration: 'underline' }}>U</span>,
            () => editor.chain().focus().toggleUnderline().run(),
          )}
          {btn(
            'strike',
            'Strikethrough',
            <span style={{ textDecoration: 'line-through' }}>S</span>,
            () => editor.chain().focus().toggleStrike().run(),
          )}
          <span className="fmt-sep" />
          {btn(
            'link',
            'Link',
            <Ico d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />,
            () => {
              setLinkVal((editor.getAttributes('link').href as string) ?? '')
              setLinkRange({ from, to })
            },
          )}
        </>
      ) : (
        <div className="fmt-link">
          <input
            autoFocus
            data-testid="fmt-link-input"
            placeholder="Paste a link…"
            value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink()
              if (e.key === 'Escape') {
                setLinkRange(null)
                setLinkVal('')
              }
            }}
          />
          <button className="fmt-link-go" onClick={applyLink} data-fmt="link-apply">
            Done
          </button>
        </div>
      )}
    </div>
  )
}
