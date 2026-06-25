// @vitest-environment jsdom
import { StarterKit } from '@react-email/editor/extensions'
import { EmailTheming } from '@react-email/editor/plugins'
import { Editor } from '@tiptap/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { emailHtml, insertBlock, toggleBold } from './engine'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensions: [(StarterKit as any).configure(), (EmailTheming as any).configure({ theme: 'basic' })],
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
})
