'use client'

import { schemas } from '@spaire/client'

import { NewBroadcastRoute } from './NewBroadcastScreen'

// "New broadcast" now routes through the SAME editor as Edit (ContentDoc +
// React Email + TipTap rich text) instead of the legacy composer.v3 editor.
// This completes the consolidation: one schema, one renderer, one editor for
// both new and edit — and drops the composer.v3 editor's fake controls
// (no-op Duplicate, non-deleting Discard, cosmetic "Saving…", dead reply-to
// and excludes). A fresh draft starts with broadcastId = null.
export function NewBroadcastV2Screen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return <NewBroadcastRoute organization={organization} broadcastId={null} />
}
