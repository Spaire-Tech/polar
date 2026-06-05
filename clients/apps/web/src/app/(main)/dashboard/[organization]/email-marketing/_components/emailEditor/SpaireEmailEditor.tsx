'use client'

// Spaire's broadcast composer, built on the open-source React Email visual
// editor (@react-email/editor). Replaces the hand-rolled block editor in
// ../blockEditor: same data contract (a structured JSON document + an
// email-ready HTML export), but the JSON is now a TipTap document and the
// HTML is produced by the editor's own React Email serializer.
//
// Data flow:
//   load:  contentJson (TipTap JSONContent) -> <EmailEditor content>
//   save:  onChange({ json: getJSON(), html: await getEmailHTML() })
//
// `html` is the value to persist as EmailBroadcast.content_html and to feed
// the MarketingEmail React Email wrapper server-side. It must still be passed
// through the existing sanitizer before it is injected via
// dangerouslySetInnerHTML downstream.

import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import {
  BubbleMenu,
  Inspector,
  SlashCommand,
  defaultSlashCommands,
} from '@react-email/editor/ui'
import type { Content, JSONContent } from '@tiptap/react'
import { useCallback, useMemo, useRef } from 'react'

import '@react-email/editor/themes/default.css'
import '@react-email/editor/styles/bubble-menu.css'
import '@react-email/editor/styles/link-bubble-menu.css'
import '@react-email/editor/styles/button-bubble-menu.css'
import '@react-email/editor/styles/image-bubble-menu.css'
import '@react-email/editor/styles/slash-command.css'
import '@react-email/editor/styles/inspector.css'

export type EmailEditorSnapshot = {
  /** TipTap document — persist as EmailBroadcast.content_json. */
  json: JSONContent
  /** Email-ready HTML — sanitize, then persist as content_html. */
  html: string
}

type Props = {
  /** Stored TipTap document to open, or undefined for an empty draft. */
  content?: Content
  /** Fired (debounced) whenever the document changes. */
  onChange?: (snapshot: EmailEditorSnapshot) => void
  /** Called once the editor is mounted and ready. */
  onReady?: (ref: EmailEditorRef) => void
  /**
   * Uploads an image and resolves to its hosted URL. Adapts Spaire's existing
   * `(file) => Promise<string>` uploader to the editor's `{ url }` shape.
   */
  uploadImage?: (file: File) => Promise<string>
  /** Accent colour applied to buttons and links (e.g. the org brand colour). */
  accent?: string
  placeholder?: string
  className?: string
  /** Render the right-hand style Inspector panel. */
  showInspector?: boolean
}

export function SpaireEmailEditor({
  content,
  onChange,
  onReady,
  uploadImage,
  accent = '#4f46e5',
  placeholder = 'Write your email… type "/" for blocks.',
  className,
  showInspector = true,
}: Props) {
  // Serialising to email HTML is async; coalesce bursts of keystrokes so we
  // only run the React Email serializer on a trailing edge.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUpdate = useCallback(
    (ref: EmailEditorRef) => {
      if (!onChange) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const json = ref.getJSON()
        const html = await ref.getEmailHTML()
        onChange({ json, html })
      }, 300)
    },
    [onChange],
  )

  const onUploadImage = useMemo(
    () =>
      uploadImage
        ? async (file: File) => ({ url: await uploadImage(file) })
        : undefined,
    [uploadImage],
  )

  return (
    <div
      className={className}
      style={{ display: 'grid', gridTemplateColumns: showInspector ? '1fr 280px' : '1fr', gap: 24, alignItems: 'flex-start' }}
    >
      <EmailEditor
        content={content}
        onReady={onReady}
        onUpdate={handleUpdate}
        onUploadImage={onUploadImage}
        placeholder={placeholder}
        theme={{
          extends: 'basic',
          styles: {
            button: { backgroundColor: accent, color: '#ffffff', borderRadius: '8px' },
            link: { color: accent },
          },
        }}
      >
        <BubbleMenu />
        <SlashCommand items={defaultSlashCommands} />
      </EmailEditor>
      {showInspector && <Inspector.Root />}
    </div>
  )
}
