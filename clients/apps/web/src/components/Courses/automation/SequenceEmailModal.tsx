'use client'

// SequenceEmailModal — hosts the REAL email editor (the same BroadcastEditor
// used for broadcasts) so an automation's email step is authored with the
// exact tooling, not a placeholder. The edited doc + rendered HTML + subject
// are handed back to the sequence builder, which persists them on the email
// node (and thus into flow_doc, which the flow engine sends).

import { useUploadSequenceImage } from '@/hooks/queries/emailMarketing'
import { useEffect, useMemo, useState } from 'react'
import { BroadcastEditor } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/blockEditor/BroadcastEditor'
import { renderBlocksToHtml } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/blockEditor/render'
import {
  type Block,
  type ContentDoc,
  isContentDoc,
  newId,
  normalizeContentDoc,
} from '@/app/(main)/dashboard/[organization]/email-marketing/_components/blockEditor/types'

const STARTER_DOC = (): ContentDoc => ({
  version: 1,
  blocks: [
    { id: newId(), type: 'heading', level: 2, text: 'Heading' } as Block,
    { id: newId(), type: 'paragraph', text: 'Write your email here.' } as Block,
  ],
})

function adoptContentJson(raw: unknown): ContentDoc {
  if (isContentDoc(raw)) {
    return normalizeContentDoc({
      version: 1,
      accent: raw.accent,
      blocks: raw.blocks.map((b) =>
        'id' in b && b.id ? b : ({ ...b, id: newId() } as Block),
      ),
    })
  }
  return STARTER_DOC()
}

export function SequenceEmailModal({
  organizationId,
  initialSubject,
  initialPreview,
  initialContentJson,
  onSave,
  onClose,
}: {
  organizationId: string
  initialSubject?: string
  initialPreview?: string
  initialContentJson?: Record<string, unknown> | null
  onSave: (v: {
    subject: string
    preview: string
    content_json: Record<string, unknown>
    content_html: string
  }) => void
  onClose: () => void
}) {
  const [doc, setDoc] = useState<ContentDoc>(() =>
    adoptContentJson(initialContentJson),
  )
  const [subject, setSubject] = useState(initialSubject ?? '')
  const [preview, setPreview] = useState(initialPreview ?? '')
  const upload = useUploadSequenceImage(organizationId)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const uploadImage = useMemo(
    () => async (file: File) => {
      const res = await upload.mutateAsync(file)
      return (res as { url: string }).url
    },
    [upload],
  )

  const save = () => {
    onSave({
      subject,
      preview,
      content_json: doc as unknown as Record<string, unknown>,
      content_html: renderBlocksToHtml(doc),
    })
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit email"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(10,10,12,0.42)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 'auto',
          width: 'min(880px, 100%)',
          height: 'min(92vh, 1000px)',
          background: '#fff',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            flex: 'none',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1d1d1f' }}>
            Edit email
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 980,
                background: 'rgba(125,125,135,0.14)',
                fontSize: 14,
                fontWeight: 600,
                color: '#1d1d1f',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 980,
                background: '#3c4ac9',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <BroadcastEditor
            doc={doc}
            setDoc={setDoc}
            uploadImage={uploadImage}
            embedded
            subject={subject}
            onSubjectChange={setSubject}
            previewText={preview}
            onPreviewTextChange={setPreview}
            saveStatus="idle"
          />
        </div>
      </div>
    </div>
  )
}

export default SequenceEmailModal
