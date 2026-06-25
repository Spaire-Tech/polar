// @vitest-environment jsdom
import { Editor } from '@tiptap/react'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  deleteBlock,
  duplicateBlock,
  emailExtensions,
  emailHtml,
  insertBlock,
  moveBlock,
  setTextColor,
  toggleBold,
  topBlocks,
} from './engine'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
  }
  if (!document.elementFromPoint) {
    ;(Document.prototype as unknown as { elementFromPoint: unknown }).elementFromPoint =
      () => null
  }
  if (!Range.prototype.getClientRects) {
    ;(Range.prototype as unknown as { getClientRects: unknown }).getClientRects =
      () => [] as unknown as DOMRectList
  }
  if (!Range.prototype.getBoundingClientRect) {
    ;(Range.prototype as unknown as { getBoundingClientRect: unknown }).getBoundingClientRect =
      () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} })
  }
})

function makeEditor() {
  return new Editor({
    element: document.createElement('div'),
    // Same extension set the live editor uses (incl. the custom colour mark).
    extensions: emailExtensions(),
    content: '',
  })
}

describe('v3 engine: insert + email output', () => {
  it('inserts Heading / Text / Button and they survive to email HTML', async () => {
    const editor = makeEditor()

    expect(insertBlock(editor, 'heading')).toBe(true)
    expect(insertBlock(editor, 'text')).toBe(true)
    expect(insertBlock(editor, 'button')).toBe(true)

    const doc = editor.getHTML()
    expect(doc).toMatch(/<h2[ >]/i)
    expect(doc).toMatch(/Write something/)
    expect(doc).toMatch(/Heading/)

    const html = await emailHtml(editor)
    // inbox-correct document
    expect(html).toMatch(/<!DOCTYPE html/i)
    expect(html).toContain('Heading')
    expect(html).toContain('Write something')
    expect(html).toContain('Button')
    // the button becomes a real link in the email
    expect(html).toMatch(/href="https:\/\/example\.com"/)

    editor.destroy()
  })

  it('bold toggles as a mark on the selection', () => {
    const editor = makeEditor()
    insertBlock(editor, 'text')
    editor.commands.selectAll()
    expect(toggleBold(editor)).toBe(true)
    expect(editor.getHTML()).toMatch(/<strong>/)
    editor.destroy()
  })

  it('italic / underline / strike / link marks round-trip', async () => {
    const editor = makeEditor()
    editor.commands.setContent('<p>format me</p>')
    editor.commands.selectAll()
    editor.chain().focus().toggleItalic().run()
    editor.chain().focus().toggleStrike().run()
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .setLink({ href: 'https://spaire.test/m' } as any)
      .run()
    const doc = editor.getHTML()
    expect(doc).toMatch(/<em>|<i>/)
    expect(doc).toMatch(/<s>|<strike>/)
    const html = await emailHtml(editor)
    expect(html).toMatch(/href="https:\/\/spaire\.test\/m"/)
    editor.destroy()
  })

  it('text colour (custom EmailMark) survives to email HTML', async () => {
    const editor = makeEditor()
    editor.commands.setContent('<p>colour me</p>')
    editor.commands.selectAll()
    expect(setTextColor(editor, '#0066cc')).toBe(true)
    const html = await emailHtml(editor)
    expect(html).toContain('colour me')
    expect(html).toMatch(/color:\s*(#0066cc|rgb\(0,\s*102,\s*204\))/i)
    editor.destroy()
  })
})

describe('v3 engine: block move / duplicate / delete', () => {
  // Order in the email doc by first-occurrence of marker text.
  const order = (editor: Editor, marks: string[]) =>
    marks
      .map((m) => ({ m, i: editor.getHTML().indexOf(m) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.m)
  const idxOf = (editor: Editor, text: string) =>
    topBlocks(editor).find((b) => (b.node.textContent as string)?.includes(text))
      ?.index ?? -1

  it('moves a block up/down, swapping order', () => {
    const editor = makeEditor()
    editor.commands.setContent('<h2>ALPHA</h2><p>BRAVO</p>')
    expect(order(editor, ['ALPHA', 'BRAVO'])).toEqual(['ALPHA', 'BRAVO'])

    expect(moveBlock(editor, idxOf(editor, 'ALPHA'), 'down')).toBe(true)
    expect(order(editor, ['ALPHA', 'BRAVO'])).toEqual(['BRAVO', 'ALPHA'])

    expect(moveBlock(editor, idxOf(editor, 'ALPHA'), 'up')).toBe(true)
    expect(order(editor, ['ALPHA', 'BRAVO'])).toEqual(['ALPHA', 'BRAVO'])
    editor.destroy()
  })

  it('duplicates a block, then delete removes one copy', () => {
    const editor = makeEditor()
    editor.commands.setContent('<h2>ALPHA</h2><p>BRAVO</p>')
    const count = (m: string) => editor.getHTML().split(m).length - 1

    expect(count('ALPHA')).toBe(1)
    expect(duplicateBlock(editor, idxOf(editor, 'ALPHA'))).toBe(true)
    expect(count('ALPHA')).toBe(2)
    expect(deleteBlock(editor, idxOf(editor, 'ALPHA'))).toBe(true)
    expect(count('ALPHA')).toBe(1)
    editor.destroy()
  })
})
