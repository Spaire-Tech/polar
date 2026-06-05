'use client'

// Sandbox page for trying the new @react-email/editor wrapper end to end
// without touching any real broadcasts. Loads a small starter document,
// shows the editor on the left, and the email-ready HTML the editor
// produces on the right.

import { useState } from 'react'
import type { Content } from '@tiptap/react'
import {
  SpaireEmailEditor,
  type EmailEditorSnapshot,
} from '../emailEditor/SpaireEmailEditor'

const STARTER: Content = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Hello from the new editor' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Try typing "/" to insert a block. Bold, italic, links, headings, lists, columns and buttons are all built in.',
        },
      ],
    },
  ],
}

export function EditorPreviewScreen() {
  const [snapshot, setSnapshot] = useState<EmailEditorSnapshot | null>(null)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Email editor preview
        </h1>
        <p className="text-sm text-gray-500">
          Sandbox for the new editor — nothing here saves. Use it to feel the
          editing UX and confirm the exported HTML looks right.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <SpaireEmailEditor content={STARTER} onChange={setSnapshot} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Live preview
            </div>
            {snapshot ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: snapshot.html }}
              />
            ) : (
              <div className="text-sm text-gray-400">
                Start editing to see the preview.
              </div>
            )}
          </div>
          <details className="rounded-xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-gray-500">
              Exported HTML
            </summary>
            <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">
              {snapshot?.html ?? '(nothing yet)'}
            </pre>
          </details>
          <details className="rounded-xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-gray-500">
              TipTap JSON (content_json)
            </summary>
            <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">
              {snapshot ? JSON.stringify(snapshot.json, null, 2) : '(nothing yet)'}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}
