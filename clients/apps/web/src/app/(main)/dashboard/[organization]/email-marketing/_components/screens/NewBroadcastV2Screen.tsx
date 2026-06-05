'use client'

// Real end-to-end compose page for the new React Email visual editor.
//
// This is intentionally a focused first-cut next to the existing
// NewBroadcastScreen wizard (which carries A/B testing, segments,
// scheduling, etc.). The goal is to validate the new editor against the
// real API: create a draft, send a test, see the email arrive — all
// without touching the legacy wizard until we know the new editor works.
//
// Routes here from /broadcasts/new-v2.

import {
  useAuth,
} from '@/hooks/auth'
import {
  useCreateEmailBroadcast,
  useSendTestEmailBroadcast,
  useUpdateEmailBroadcast,
  useUploadEmailImage,
  type BroadcastWritePayload,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { SpaireEmailEditor, type EmailEditorSnapshot } from '../emailEditor/SpaireEmailEditor'
import { sanitizeEmailHtml } from '../sanitize'

const STARTER_JSON = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Hi friends,' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text:
            "Write your update here. We'll wrap it in your branded template before sending.",
        },
      ],
    },
  ],
}

export function NewBroadcastV2Screen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { currentUser } = useAuth()

  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [senderName, setSenderName] = useState(organization.name)
  const [senderEmail, setSenderEmail] = useState('')
  const [testRecipient, setTestRecipient] = useState(currentUser?.email ?? '')
  const [broadcastId, setBroadcastId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<EmailEditorSnapshot | null>(null)
  const [statusMsg, setStatusMsg] = useState<string>('')

  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendTest = useSendTestEmailBroadcast()
  const uploadImageMutation = useUploadEmailImage(organization.id)

  // Adapter from the mutation hook to the editor's `(file) => Promise<string>` shape.
  const uploadImage = useCallback(
    async (file: File) => {
      const result = await uploadImageMutation.mutateAsync(file)
      return result.url
    },
    [uploadImageMutation],
  )

  const sanitizedHtml = useMemo(
    () => sanitizeEmailHtml(snapshot?.html),
    [snapshot?.html],
  )

  type CreatePayload = BroadcastWritePayload & {
    subject: string
    sender_name: string
  }

  const buildPayload = (): CreatePayload | null => {
    if (!snapshot) return null
    return {
      subject: subject || 'Untitled broadcast',
      preview_text: previewText || null,
      sender_name: senderName || organization.name,
      sender_email: senderEmail || null,
      reply_to_email: null,
      content_html: snapshot.html,
      content_json: snapshot.json as unknown as Record<string, unknown>,
      segment_id: null,
      filter_rules: null,
    }
  }

  const onSaveDraft = async () => {
    const payload = buildPayload()
    if (!payload) {
      setStatusMsg('Add some content before saving.')
      return
    }
    setStatusMsg('Saving…')
    try {
      if (broadcastId) {
        await updateBroadcast.mutateAsync({ broadcastId, body: payload })
      } else {
        const created = await createBroadcast.mutateAsync(payload)
        setBroadcastId(created.id)
      }
      setStatusMsg('Saved.')
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  const onSendTest = async () => {
    if (!testRecipient) {
      setStatusMsg('Enter a recipient email for the test.')
      return
    }
    // Test send needs a persisted broadcast; save first if needed.
    let id = broadcastId
    const payload = buildPayload()
    if (!payload) {
      setStatusMsg('Add some content before sending a test.')
      return
    }
    setStatusMsg('Sending test…')
    try {
      if (!id) {
        const created = await createBroadcast.mutateAsync(payload)
        id = created.id
        setBroadcastId(id)
      } else {
        await updateBroadcast.mutateAsync({ broadcastId: id, body: payload })
      }
      await sendTest.mutateAsync({ broadcastId: id, email: testRecipient })
      setStatusMsg(`Test sent to ${testRecipient}.`)
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Test send failed.')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New broadcast</h1>
          <p className="text-sm text-gray-500">
            Composing with the new editor. {broadcastId ? `Draft: ${broadcastId.slice(0, 8)}…` : 'Unsaved draft.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onSaveDraft}
            disabled={createBroadcast.isPending || updateBroadcast.isPending}
          >
            Save draft
          </button>
          <button
            type="button"
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            onClick={onSendTest}
            disabled={sendTest.isPending}
          >
            Send test
          </button>
        </div>
      </div>

      {statusMsg ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {statusMsg}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Preview text
          </span>
          <input
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Shown in inbox after the subject"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            From name
          </span>
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            From email
          </span>
          <input
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="Leave blank for org default"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Test recipient
          </span>
          <input
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <SpaireEmailEditor content={STARTER_JSON} onChange={setSnapshot} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Inbox preview
          </div>
          {sanitizedHtml ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="text-sm text-gray-400">
              Start editing to see the preview.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
