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

import { TextColor } from './colorMark'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExt = any

/** The full extension set — shared by the live editor and the tests. */
export const emailExtensions = (): AnyExt[] => [
  (StarterKit as AnyExt).configure(),
  (EmailTheming as AnyExt).configure({ theme: 'basic' }),
  TextColor,
]

export function useEmailEditor(initialContent?: string) {
  return useEditor({
    immediatelyRender: false,
    extensions: emailExtensions(),
    content: initialContent ?? '',
    editorProps: {
      attributes: { class: 'em-doc', 'data-testid': 'email-doc' },
    },
  })
}

export const setTextColor = (editor: Editor | null, color: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor?.chain().focus() as any)?.setTextColor(color).run() ?? false
export const unsetTextColor = (editor: Editor | null) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor?.chain().focus() as any)?.unsetTextColor().run() ?? false

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

// ── block-level helpers (selection + move/duplicate/delete) ───────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PMNode = any

export type TopBlock = { index: number; pos: number; node: PMNode; label: string }

const LABELS: Record<string, string> = {
  paragraph: 'Text',
  heading: 'Heading',
  button: 'Button',
  horizontalRule: 'Divider',
  blockquote: 'Quote',
  image: 'Image',
  section: 'Section',
}
const labelFor = (node: PMNode): string =>
  LABELS[node.type.name as string] ?? (node.type.name as string)

/** Find the container node that holds the email's top-level blocks. */
function findContainer(editor: Editor): { node: PMNode; pos: number } | null {
  let found: { node: PMNode; pos: number } | null = null
  editor.state.doc.descendants((node: PMNode, pos: number) => {
    if (!found && node.type.name === 'container') {
      found = { node, pos }
      return false
    }
    return true
  })
  return found
}

/** The top-level blocks (children of the container), in order. */
export function topBlocks(editor: Editor | null): TopBlock[] {
  if (!editor) return []
  const c = findContainer(editor)
  if (!c) return []
  const out: TopBlock[] = []
  c.node.forEach((child: PMNode, offset: number, index: number) => {
    out.push({
      index,
      pos: c.pos + 1 + offset,
      node: child,
      label: labelFor(child),
    })
  })
  return out
}

/** Index of the top block that currently holds the selection (-1 if none). */
export function selectedBlockIndex(editor: Editor | null): number {
  if (!editor) return -1
  const from = editor.state.selection.from
  for (const b of topBlocks(editor)) {
    if (from >= b.pos && from <= b.pos + b.node.nodeSize) return b.index
  }
  return -1
}

export function deleteBlock(editor: Editor | null, index: number): boolean {
  if (!editor) return false
  const blocks = topBlocks(editor)
  const b = blocks[index]
  if (!b) return false
  const tr = editor.state.tr.delete(b.pos, b.pos + b.node.nodeSize)
  // Never leave the container empty (schema is block+): drop in a blank line.
  if (blocks.length === 1) {
    const para = editor.schema.nodes.paragraph.create()
    tr.insert(b.pos, para)
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export function duplicateBlock(editor: Editor | null, index: number): boolean {
  if (!editor) return false
  const b = topBlocks(editor)[index]
  if (!b) return false
  editor.view.dispatch(
    editor.state.tr.insert(b.pos + b.node.nodeSize, b.node).scrollIntoView(),
  )
  return true
}

export function moveBlock(
  editor: Editor | null,
  index: number,
  dir: 'up' | 'down',
): boolean {
  if (!editor) return false
  const blocks = topBlocks(editor)
  const cur = blocks[index]
  const tgt = blocks[dir === 'up' ? index - 1 : index + 1]
  if (!cur || !tgt) return false
  const tr = editor.state.tr
  if (dir === 'up') {
    // cur is after tgt: remove cur (later pos, doesn't shift tgt), reinsert before tgt.
    tr.delete(cur.pos, cur.pos + cur.node.nodeSize)
    tr.insert(tgt.pos, cur.node)
  } else {
    // cur is before tgt: insert copy after tgt (later pos), then delete original.
    tr.insert(tgt.pos + tgt.node.nodeSize, cur.node)
    tr.delete(cur.pos, cur.pos + cur.node.nodeSize)
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export function selectBlock(editor: Editor | null, index: number): void {
  if (!editor) return
  const b = topBlocks(editor)[index]
  if (!b) return
  editor.chain().focus().setTextSelection(b.pos + 1).run()
}

/**
 * Set attributes on a block BY POSITION (setNodeMarkup) — for inspector
 * controls. Unlike updateAttributes it doesn't depend on (or steal) the
 * editor selection, so editing a text field in the inspector keeps the field
 * focused and reliably targets the right block.
 */
export function setBlockAttr(
  editor: Editor | null,
  index: number,
  attrs: Record<string, unknown>,
): boolean {
  if (!editor) return false
  const b = topBlocks(editor)[index]
  if (!b) return false
  const tr = editor.state.tr.setNodeMarkup(b.pos, undefined, {
    ...b.node.attrs,
    ...attrs,
  })
  editor.view.dispatch(tr)
  return true
}
