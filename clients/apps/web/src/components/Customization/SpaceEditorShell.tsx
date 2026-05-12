'use client'

import { ProfileCard } from '@/components/Profile/ProfileCard'
import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'
import { DraggableBlocks } from './InlineEdit/DraggableBlocks'
import { EditableProfileCard } from './InlineEdit/EditableProfileCard'

// Renders the live preview of the user's Spaire Space inside the
// editor canvas. The ProfileCard column uses the inline-editable
// variant so click-to-edit affordances are wired up; the Storefront
// content blocks stay read-only for now (drag + per-block edits land
// in PR E).

export const SpaceEditorCanvas = ({
  organization: org,
  hasSettingsPanel,
  onAddToSpace,
}: {
  organization: schemas['Organization']
  hasSettingsPanel: boolean
  onAddToSpace?: () => void
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()

  const organization = {
    ...org,
    name: watched.name ?? org.name,
    avatar_url: watched.avatar_url ?? org.avatar_url,
    socials: watched.socials ?? org.socials,
    storefront_settings: watched.storefront_settings ?? org.storefront_settings,
  } as schemas['Organization']

  // Bumped limit so the canvas + picker show the full catalog instead
  // of paginating at 10. 100 covers the long tail; users with more
  // than that can curate via the picker.
  const { data: productsData } = useProducts(org.id, {
    is_archived: false,
    limit: 100,
  })
  const products = (productsData?.items ?? []) as unknown as schemas['ProductStorefront'][]

  return (
    <div className={`canvas-wrap${hasSettingsPanel ? ' has-panel' : ''}`}>
      <div className="canvas">
        <aside className="col-left">
          <div className="canvas-card">
            <EditableProfileCard
              organization={organization}
              products={products}
            />
          </div>
        </aside>
        <main className="col-right">
          <DraggableBlocks
            organization={organization}
            products={products}
            onAddToSpace={onAddToSpace}
          />
          <div className="footer-note">That&apos;s everything on your Space.</div>
        </main>
      </div>
    </div>
  )
}

// Re-exported so we don't accidentally tree-shake out the read-only
// ProfileCard (used by the published-preview branch elsewhere).
export { ProfileCard }

