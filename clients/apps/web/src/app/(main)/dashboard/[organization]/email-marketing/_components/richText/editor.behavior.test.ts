// @vitest-environment jsdom
//
// Drives a REAL TipTap editor (same extension config as RichTextField) in
// jsdom to prove the runtime behavior — not just that the code typechecks:
//   1. toggling bold affects ONLY the selection (the #1 complaint)
//   2. links apply to the selected range
//   3. pasted/loaded foreign inline styles (font-size/color) are stripped
import Link from '@tiptap/extension-link'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { pmDocToRuns, runsToPMDoc } from './convert'

let editor: Editor

const makeEditor = (content: object | string) =>
  new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      Link.configure({ protocols: ['http', 'https', 'mailto'] }),
    ],
    content,
  })

afterEach(() => editor?.destroy())

describe('RichTextField TipTap behavior (real editor, jsdom)', () => {
  it('bold applies to ONLY the selected characters', () => {
    editor = makeEditor(runsToPMDoc([{ t: 'Hello world' }]))
    // ProseMirror positions: text starts at 1, so "Hello" = [1,6).
    editor.commands.setTextSelection({ from: 1, to: 6 })
    editor.commands.toggleBold()
    expect(pmDocToRuns(editor.getJSON())).toEqual([
      { t: 'Hello', b: true },
      { t: ' world' },
    ])
  })

  it('does NOT bold the whole block when only part is selected', () => {
    editor = makeEditor(runsToPMDoc([{ t: 'abcdef' }]))
    editor.commands.setTextSelection({ from: 3, to: 5 }) // "cd"
    editor.commands.toggleBold()
    const runs = pmDocToRuns(editor.getJSON())
    expect(runs.find((r) => r.t === 'cd')?.b).toBe(true)
    expect(runs.filter((r) => r.b).map((r) => r.t)).toEqual(['cd'])
  })

  it('applies a link to the selected range', () => {
    editor = makeEditor(runsToPMDoc([{ t: 'click here now' }]))
    editor.commands.setTextSelection({ from: 7, to: 11 }) // "here"
    editor.commands.setLink({ href: 'https://x.test' })
    const runs = pmDocToRuns(editor.getJSON())
    expect(runs.find((r) => r.t === 'here')?.href).toBe('https://x.test')
  })

  it('strips foreign inline styles (font-size/color) on load/paste', () => {
    editor = makeEditor(
      '<p>plain <span style="font-size:42px;color:#f00">styled</span> end</p>',
    )
    const runs = pmDocToRuns(editor.getJSON())
    const text = runs.map((r) => r.t).join('')
    expect(text).toBe('plain styled end')
    // No run carries size/color — the schema only knows bold/italic/link.
    expect(JSON.stringify(runs)).not.toContain('font-size')
    expect(JSON.stringify(runs)).not.toContain('color')
  })

  it('keeps bold/italic from pasted HTML (allowed marks survive)', () => {
    editor = makeEditor('<p>a <b>bold</b> and <i>italic</i></p>')
    const runs = pmDocToRuns(editor.getJSON())
    expect(runs.find((r) => r.t === 'bold')?.b).toBe(true)
    expect(runs.find((r) => r.t === 'italic')?.i).toBe(true)
  })
})
