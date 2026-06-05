'use client'

// Spaire's broadcast composer, built on the open-source React Email visual
// editor (@react-email/editor). Replaces the hand-rolled block editor.
//
// Built on the lower-level `useEditor` + `EditorContext` path (not the
// standalone `EmailEditor` component) because we need to:
//   - register Spaire's custom blocks AND keep all default extensions
//     (the `extensions` prop on EmailEditor *replaces* the defaults),
//   - add our custom blocks to the slash menu (EmailEditor's built-in slash
//     menu can't be extended via prop).
//
// Data flow:
//   load:  content (TipTap JSON or HTML) -> useEditor({ content })
//   save:  onChange({ json: editor.getJSON(),
//                     html: (await composeReactEmail({ editor })).html })
//
// `html` is the value to persist as EmailBroadcast.content_html. It must
// still pass through the existing sanitizer before being injected via
// dangerouslySetInnerHTML downstream.

import { composeReactEmail } from '@react-email/editor/core'
import { StarterKit } from '@react-email/editor/extensions'
import {
  EmailTheming,
  imageSlashCommand,
  useEditorImage,
} from '@react-email/editor/plugins'
import {
  BubbleMenu,
  Inspector,
  SlashCommand,
  defaultSlashCommands,
} from '@react-email/editor/ui'
import Placeholder from '@tiptap/extension-placeholder'
import {
  EditorContent,
  EditorContext,
  useEditor,
  type Content,
  type JSONContent,
} from '@tiptap/react'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'

import '@react-email/editor/themes/default.css'

import { spaireCustomNodes, spaireSlashItems } from './customNodes'

export type EmailEditorSnapshot = {
  /** TipTap document — persist as EmailBroadcast.content_json. */
  json: JSONContent
  /** Email-ready HTML — sanitize, then persist as content_html. */
  html: string
}

type Props = {
  /** Stored document to open: TipTap JSON or an HTML string. */
  content?: Content
  /** Fired (debounced) whenever the document changes. */
  onChange?: (snapshot: EmailEditorSnapshot) => void
  /**
   * Uploads an image and resolves to its hosted URL. Adapts Spaire's existing
   * `(file) => Promise<string>` uploader to the editor's `{ url }` shape.
   */
  uploadImage?: (file: File) => Promise<string>
  placeholder?: string
  className?: string
  /** Render the right-hand style Inspector panel. */
  showInspector?: boolean
  /** Optional UI rendered above the editor canvas (e.g. a block palette). */
  slotBefore?: ReactNode
}

export function SpaireEmailEditor({
  content,
  onChange,
  uploadImage,
  placeholder = "Press '/' for commands",
  className,
  showInspector = true,
  slotBefore,
}: Props) {
  // The editor must NOT be re-created on every parent render. Three things
  // need to stay stable across renders or `useEditor` will tear down and
  // rebuild the editor every render — which leaves UI children (Inspector,
  // bubble menus) reading a half-built state and dereferencing null
  // theme/styles on first paint.
  //
  //   1. onChange callback — parent lambda changes identity every render.
  //   2. uploadImage callback — same (TanStack mutation refs change too).
  //   3. extensions array — must be a singleton.
  //
  // For (1) and (2) we hold the latest via refs. For (3) we build the
  // extensions array exactly once. Theme overrides moved out of here for
  // the same reason — re-keying the editor on accent isn't worth the
  // tear-down cost. Configure via CSS or a future stable prop.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const uploadImageRef = useRef(uploadImage)
  uploadImageRef.current = uploadImage

  // Stable upload adapter — identity never changes after first render.
  const stableUpload = useCallback(async (file: File) => {
    const uploader = uploadImageRef.current
    if (!uploader) throw new Error('Image upload is not configured')
    return { url: await uploader(file) }
  }, [])

  // Image upload is a hook-provided extension on the lower-level path.
  const imageExtension = useEditorImage({ uploadImage: stableUpload })

  const extensions = useMemo(
    () => [
      StarterKit,
      EmailTheming,
      Placeholder.configure({ placeholder }),
      imageExtension,
      ...spaireCustomNodes,
    ],
    // Intentionally empty deps — see comment above. Changing placeholder
    // at runtime is a non-goal; the editor won't pick it up either way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Serialising to email HTML is async; coalesce bursts of keystrokes so we
  // only run the React Email serializer on a trailing edge.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const cb = onChangeRef.current
        if (!cb) return
        const json = editor.getJSON()
        const { html } = await composeReactEmail({ editor })
        cb({ json, html })
      }, 300)
    },
  })

  const slashItems = useMemo(
    () => [...defaultSlashCommands, imageSlashCommand, ...spaireSlashItems],
    [],
  )

  // Don't render the bubble menus, slash menu, or inspector until the editor
  // instance exists. Several of those components read from EditorContext
  // synchronously and crash on a null editor (e.g. `editor.options...`).
  if (!editor) {
    return (
      <div className={className} style={{ minHeight: 280 }}>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-400">
          Loading editor…
        </div>
      </div>
    )
  }

  return (
    <EditorContext.Provider value={{ editor }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showInspector ? '1fr 280px' : '1fr',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {slotBefore}
          <EditorContent editor={editor} className={className} />
          <BubbleMenu
            hideWhenActiveNodes={['image', 'button']}
            hideWhenActiveMarks={['link']}
          />
          <BubbleMenu.LinkDefault />
          <BubbleMenu.ButtonDefault />
          <BubbleMenu.ImageDefault />
          <SlashCommand items={slashItems} />
        </div>
        {showInspector && (
          <Inspector.Root className="shrink-0 overflow-y-auto rounded-xl border border-gray-200 p-4">
            <Inspector.Breadcrumb />
            <Inspector.Document />
            <Inspector.Node />
            <Inspector.Text />
          </Inspector.Root>
        )}
      </div>
    </EditorContext.Provider>
  )
}
