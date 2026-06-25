'use client'

// v3 editor ENGINE (brick 2).
//
// Our own TipTap editor built from @react-email/editor's extensions — NO
// <EmailEditor> wrapper, so we keep full control of the UI (the user's design)
// while React Email's schema gives inbox-correct output via composeReactEmail.
// Proven feasible by engine.spike.test.tsx.

import { composeReactEmail } from '@react-email/editor/core'
import { StarterKit } from '@react-email/editor/extensions'
import { EmailTheming } from '@react-email/editor/plugins'
import { useEditor, type Editor } from '@tiptap/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExt = any

export function useEmailEditor(initialContent?: string) {
  return useEditor({
    immediatelyRender: false,
    extensions: [
      (StarterKit as AnyExt).configure(),
      (EmailTheming as AnyExt).configure({ theme: 'basic' }),
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: { class: 'em-doc', 'data-testid': 'email-doc' },
    },
  })
}

// ── insert commands for the wired content blocks ──────────────────────────
const BLOCK_NODE: Record<'text' | 'heading' | 'button', Record<string, unknown>> = {
  text: { type: 'paragraph', content: [{ type: 'text', text: 'Write something…' }] },
  heading: {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: 'Heading' }],
  },
  button: {
    type: 'button',
    attrs: { href: 'https://example.com' },
    content: [{ type: 'text', text: 'Button' }],
  },
}

export function insertBlock(
  editor: Editor | null,
  type: 'text' | 'heading' | 'button',
): boolean {
  if (!editor) return false
  // Append at the end of the document, in click order — insertContent at the
  // current selection put blocks in the wrong place / nesting in an empty doc.
  const endPos = Math.max(0, editor.state.doc.content.size - 1)
  return editor
    .chain()
    .focus('end')
    .insertContentAt(endPos, BLOCK_NODE[type])
    .run()
}

export const toggleBold = (e: Editor | null) =>
  e?.chain().focus().toggleBold().run() ?? false
export const toggleItalic = (e: Editor | null) =>
  e?.chain().focus().toggleItalic().run() ?? false

/** Inbox-correct HTML for the current document. */
export async function emailHtml(editor: Editor | null): Promise<string> {
  if (!editor) return ''
  const { html } = await composeReactEmail({ editor })
  return html
}
