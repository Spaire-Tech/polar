// @vitest-environment jsdom
//
// Mounts the REAL @react-email/editor the same way BroadcastComposer does
// (no bubble/slash children) in jsdom, to prove it (a) mounts without the
// duplicate-keyed-plugin RangeError that crashed the page, and (b) produces
// HTML from getEmail(). Also asserts the OLD (buggy) usage — passing the
// bubble menu as a child — does crash, documenting why it was removed.
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import { BubbleMenu } from '@react-email/editor/ui'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
  }
  if (!('IntersectionObserver' in globalThis)) {
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
      }
  }
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })) as unknown as typeof window.matchMedia
  }
  // jsdom doesn't implement these; ProseMirror's placeholder viewport
  // tracking calls them. Stub so the editor can mount.
  if (!document.elementFromPoint) {
    ;(Document.prototype as unknown as { elementFromPoint: unknown }).elementFromPoint =
      () => null
  }
  if (!Range.prototype.getClientRects) {
    ;(Range.prototype as unknown as { getClientRects: unknown }).getClientRects =
      () => [] as unknown as DOMRectList
  }
})

const flush = () => act(async () => {
  await new Promise((r) => setTimeout(r, 60))
})

describe('EmailEditor (real package, jsdom)', () => {
  it('mounts as BroadcastComposer uses it and getEmail() returns HTML', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const holder: { ref: EmailEditorRef | null } = { ref: null }
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <EmailEditor
          placeholder="Write…"
          onUploadImage={async () => ({ url: 'https://x.test/i.png' })}
          onReady={(r) => {
            holder.ref = r
          }}
        />,
      )
    })
    await flush()

    expect(holder.ref).not.toBeNull()
    const out = await holder.ref!.getEmail()
    expect(typeof out.html).toBe('string')
    expect(typeof out.text).toBe('string')

    await act(async () => {
      root.unmount()
    })
  })

  it('edits: typing + bold mark flow through to getEmail() HTML', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const holder: { ref: EmailEditorRef | null } = { ref: null }
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <EmailEditor
          placeholder="Write…"
          onUploadImage={async () => ({ url: 'https://x.test/i.png' })}
          onReady={(r) => {
            holder.ref = r
          }}
        />,
      )
    })
    await flush()

    const editor = holder.ref!.editor
    expect(editor).not.toBeNull()

    // Type a sentence, then select it all and toggle bold — the exact kind
    // of selection-formatting the user reported as broken in the old editor.
    await act(async () => {
      editor!
        .chain()
        .focus()
        .insertContent('Hello broadcast world')
        .selectAll()
        .toggleBold()
        .run()
    })
    await flush()

    const out = await holder.ref!.getEmail()
    // Text made it in...
    expect(out.html).toContain('Hello broadcast world')
    expect(out.text).toContain('Hello broadcast world')
    // ...and the bold mark applied to exactly that selection (strong/b tag).
    expect(/<(strong|b)\b/i.test(out.html)).toBe(true)
    // The mark is active on the current selection in the editor model.
    expect(editor!.isActive('bold')).toBe(true)

    await act(async () => {
      root.unmount()
    })
  })

  it('regression: passing <BubbleMenu/> as a child crashes (why it was removed)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let threw = false
    try {
      await act(async () => {
        root.render(
          <EmailEditor placeholder="x" onUploadImage={async () => ({ url: '' })}>
            <BubbleMenu />
          </EmailEditor>,
        )
      })
      await flush()
    } catch {
      threw = true
    }
    try {
      await act(async () => {
        root.unmount()
      })
    } catch {
      /* ignore */
    }
    expect(threw).toBe(true)
  })
})
