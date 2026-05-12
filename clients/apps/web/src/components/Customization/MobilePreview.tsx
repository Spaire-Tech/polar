'use client'

import { ProfileCard } from '@/components/Profile/ProfileCard'
import { Storefront } from '@/components/Profile/Storefront'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

/**
 * Mobile preview — wraps the real public-Space components in an
 * iPhone-shaped chrome. Read-only on purpose: editing happens in the
 * desktop canvas / Arrange / Settings, and the mobile view is there
 * so the creator can see exactly what visitors get on their phone.
 *
 * The frame mimics an iPhone 14 (390 × 844 pt, 9 : 19.5):
 *   • 8 px black bezel, 52 px outer radius, 44 px inner radius
 *   • dynamic-island pill at the top
 *   • home-indicator bar at the bottom
 *
 * The inner content is the live ProfileCard + Storefront stacked
 * vertically, scrollable inside the frame, fed by watched form
 * state so it stays in sync with edits made elsewhere in the
 * editor.
 */
export const MobilePreview = ({
  organization: org,
  products,
  hasSettingsPanel,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
  hasSettingsPanel: boolean
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()

  // Mirror SpaceEditorCanvas: merge watched form state onto the base
  // org so the preview reflects unpublished edits.
  const organization = {
    ...org,
    name: watched.name ?? org.name,
    avatar_url: watched.avatar_url ?? org.avatar_url,
    socials: watched.socials ?? org.socials,
    storefront_settings:
      watched.storefront_settings ?? org.storefront_settings,
  } as schemas['Organization']

  return (
    <div className={`mobile-preview-wrap${hasSettingsPanel ? ' has-panel' : ''}`}>
      <div className="mobile-frame" aria-label="Mobile preview (iPhone)">
        <div className="mobile-frame-island" aria-hidden />
        <div className="mobile-frame-screen">
          <div className="mobile-frame-scroll">
            <ProfileCard
              organization={organization}
              products={products}
              preview
            />
            <Storefront
              organization={organization}
              products={products}
              preview
            />
          </div>
        </div>
        <div className="mobile-frame-home" aria-hidden />
      </div>
    </div>
  )
}
