'use client'

// SequenceEmailModal — hosts the REAL broadcast email editor (ComposerApp)
// as an automation step's email editor, full-screen and styled exactly like
// the broadcast composer, but in "sequence mode": no audience picker (the
// sequence defines who receives it), no Schedule / Save draft / Duplicate,
// and the primary action is "Done", which hands the authored subject +
// rendered HTML + block doc back to the sequence builder and returns to it.

import { ComposerApp } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/ComposerApp'
import type { Block } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/types'
import type { schemas } from '@spaire/client'
import { useEffect } from 'react'

export function SequenceEmailModal({
  organization,
  sequenceName,
  initialSubject,
  initialContentJson,
  onSave,
  onClose,
}: {
  organization: schemas['Organization']
  sequenceName?: string
  initialSubject?: string
  initialContentJson?: Record<string, unknown> | null
  onSave: (v: {
    subject: string
    content_html: string
    content_json: Record<string, unknown>
  }) => void
  onClose: () => void
}) {
  // Lock page scroll while the full-screen editor is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Re-hydrate the ComposerApp blocks from a previously-authored email.
  const cj = initialContentJson as
    | { v?: string; blocks?: Block[] }
    | null
    | undefined
  const initialBlocks =
    cj?.v === 'composer.v3' && Array.isArray(cj.blocks) ? cj.blocks : undefined

  // ComposerApp portals its own full-screen shell into document.body, so it
  // must NOT be wrapped in a covering element (that would sit on top of it).
  return (
    <ComposerApp
      organization={organization}
      sequenceMode={{
        sequenceName,
        initialSubject,
        initialBlocks,
        onSave,
        onClose,
      }}
    />
  )
}

export default SequenceEmailModal
