'use client'

import { schemas } from '@spaire/client'
import { useCallback, useState } from 'react'
import { useUploadEmailImage } from '@/hooks/queries/emailMarketing'
import { useAutosave } from '../../email-marketing/_components/blockEditor/useAutosave'
import { useDocHistory } from '../../email-marketing/_components/blockEditor/useDocHistory'
import { ContentDoc } from '../../email-marketing/_components/blockEditor/types'
import { PostEditor, PostMeta } from './PostEditor'

// ── Seed document ─────────────────────────────────────────────────────
// Phase 1 ships the editor surface; persistence to /v1/newsletters/posts
// is wired in Phase 2 once the generated API client picks up the new
// backend routes (see Phase 0 commit 864340c). For now we seed an
// empty post and autosave-no-ops, so the UI is fully demonstrable.

const SEED_META: PostMeta = {
  title: '',
  subtitle: '',
  cover_url: null,
  cover_visible: true,
  tags: [],
}

const SEED_DOC: ContentDoc = {
  version: 1,
  accent: '#4f46e5',
  blocks: [
    {
      id: 'seed-1',
      type: 'paragraph',
      text: '',
    },
  ],
}

export function NewsletterPostScreen({
  organization,
  postId: _postId,
}: {
  organization: schemas['Organization']
  postId: string
}) {
  const [meta, setMeta] = useState<PostMeta>(SEED_META)
  const [doc, setDocRaw] = useState<ContentDoc>(SEED_DOC)
  const history = useDocHistory(doc, setDocRaw)

  const uploadMutation = useUploadEmailImage(organization.id)
  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadMutation.mutateAsync(file)
      return result.url
    },
    [uploadMutation],
  )

  // No-op save target until Phase 2 wires real persistence. The hook is
  // mounted now so subsequent commits only need to swap the save fn.
  const save = useCallback(async (_: { meta: PostMeta; doc: ContentDoc }) => {
    // TODO(phase-2): POST/PATCH /v1/newsletters/posts/{id}
  }, [])
  const status = useAutosave({ meta, doc }, save)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fff',
        position: 'relative',
      }}
    >
      <TopRibbon
        organizationName={organization.name}
        title={meta.title || 'Untitled'}
        status={status}
      />
      <PostEditor
        meta={meta}
        setMeta={setMeta}
        doc={doc}
        setDoc={history.set}
        uploadImage={uploadImage}
        accent={doc.accent}
      />
    </div>
  )
}

function TopRibbon({
  organizationName,
  title,
  status,
}: {
  organizationName: string
  title: string
  status: 'idle' | 'saving' | 'saved' | 'error'
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 20px',
        borderBottom: '1px solid #e5e5ea',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'saturate(180%) blur(12px)',
        fontSize: 13,
        color: '#1d1d1f',
      }}
    >
      <span style={{ color: '#86868b' }}>{organizationName}</span>
      <span style={{ color: '#c5c5c8' }}>/</span>
      <span style={{ fontWeight: 500 }}>{title}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 12,
          color:
            status === 'error'
              ? '#c33'
              : status === 'saving'
                ? '#86868b'
                : status === 'saved'
                  ? '#1a7a3e'
                  : '#86868b',
        }}
      >
        {status === 'saving'
          ? 'Saving…'
          : status === 'saved'
            ? 'Saved'
            : status === 'error'
              ? 'Save failed'
              : 'Draft'}
      </span>
    </div>
  )
}
