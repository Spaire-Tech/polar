'use client'

import { ProfileCard } from '@/components/Profile/ProfileCard'
import { Storefront } from '@/components/Profile/Storefront'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

/**
 * Mobile preview — wraps the real public-Space components in an
 * iPhone-shaped chrome.
 *
 * Two things to get right so the rendering matches the actual public
 * page on a phone:
 *
 *   1. Layout: mirror /[organization]/(header)/layout.tsx EXACTLY —
 *      the same flex column with ProfileCard on top, Storefront below.
 *
 *   2. Breakpoints: the iPhone frame is ~390 px wide, but the host
 *      browser viewport is normally desktop, so Tailwind's `md:`
 *      utilities fire and the components render as desktop. The CSS
 *      override block (in editor.css, scoped to .mobile-frame-scroll)
 *      cancels the `md:` modifiers that matter for layout — grid
 *      columns, flex direction, sticky positioning, fixed widths —
 *      so the components behave as if the viewport were a phone.
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
            {/* Exact mirror of the real layout.tsx wrapper so the
                components render in the same structure they do on
                the live site. The .mobile-frame-scroll CSS overrides
                neutralise the md: utilities so this collapses to the
                mobile rendering (single column, profile card on top). */}
            <div className="mp-page-wrap">
              <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                <aside
                  data-profile-card
                  className="w-full shrink-0 md:sticky md:top-8 md:w-[420px] md:self-start"
                >
                  <ProfileCard
                    organization={organization}
                    products={products}
                    preview
                  />
                </aside>
                <main className="flex min-w-0 flex-1 flex-col">
                  <div className="flex h-full grow flex-col">
                    <Storefront
                      organization={organization}
                      products={products}
                      preview
                    />
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
        <div className="mobile-frame-home" aria-hidden />
      </div>
    </div>
  )
}
