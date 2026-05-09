'use client'

import { ProfileCard } from '@/components/Profile/ProfileCard'
import { Storefront } from '@/components/Profile/Storefront'
import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

// Renders the live preview of the user's Spaire Space inside the
// editor canvas. Reads from the form's watched values so any inline
// edits in PR C reflect immediately. Until those land, the canvas is
// view-only and edits happen via the side-panel form (PR D wires the
// real settings panel; for now it's the existing StorefrontEditorForm
// in a slide-in).

export const SpaceEditorCanvas = ({
  organization: org,
  hasSettingsPanel,
}: {
  organization: schemas['Organization']
  hasSettingsPanel: boolean
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()

  // Merge form-watched values back over the original organization so
  // the canvas always renders the latest in-progress edits.
  const organization = {
    ...org,
    name: watched.name ?? org.name,
    avatar_url: watched.avatar_url ?? org.avatar_url,
    socials: watched.socials ?? org.socials,
    storefront_settings: watched.storefront_settings ?? org.storefront_settings,
  } as schemas['Organization']

  // The public storefront API 404s when the Space isn't enabled. Inside
  // the editor we always have a product list to draw from; the
  // Storefront component will filter by featured_mode/featured_product_ids.
  const { data: productsData } = useProducts(org.id, { is_archived: false })
  const products = (productsData?.items ?? []) as unknown as schemas['ProductStorefront'][]

  return (
    <div className={`canvas-wrap${hasSettingsPanel ? ' has-panel' : ''}`}>
      <div className="canvas">
        {/* Left — sticky ProfileCard. We pass `preview` so external
            social/product links don't navigate the editor away. */}
        <aside className="col-left">
          <div className="canvas-card">
            <ProfileCard
              organization={organization}
              products={products}
              preview
            />
          </div>
        </aside>

        {/* Right — content blocks (Products + Links + future Forms),
            rendered with our existing public Space components for
            visual fidelity. */}
        <main className="col-right">
          <div className="canvas-card">
            <Storefront
              organization={organization}
              products={products}
              preview
            />
          </div>
          <div className="footer-note">That&apos;s everything on your Space.</div>
        </main>
      </div>
    </div>
  )
}
