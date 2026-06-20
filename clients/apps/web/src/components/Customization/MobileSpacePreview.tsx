'use client'

// Real mobile preview — an actual <iframe> of the public Space inside an
// iPhone-shaped bezel. Because the iframe has its OWN viewport, the Space's
// real responsive breakpoints (Tailwind `md:` etc.) fire at phone width, so
// this shows the genuine mobile rendering — not a CSS-faked approximation.
//
// The iframe loads the live published Space, so it reflects the published
// theme + layout. Unpublished edits aren't shown here (the desktop canvas is
// the live WYSIWYG); a hint surfaces that distinction when there are unsaved
// changes.

import { spacePageLink } from '@/utils/nav'
import { schemas } from '@spaire/client'

export const MobileSpacePreview = ({
  organization,
  enabled,
}: {
  organization: schemas['Organization']
  enabled: boolean
}) => {
  const url = spacePageLink(organization)

  return (
    <div className="mobile-frame" aria-label="Mobile preview of your Space">
      <div className="mobile-frame-island" aria-hidden />
      <div className="mobile-frame-screen">
        {enabled ? (
          <iframe
            key={url}
            src={url}
            title="Mobile preview of your Space"
            className="h-full w-full border-0"
            // Same-origin where applicable; allow forms so the preview is fully
            // interactive like the real thing.
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-sm font-medium text-gray-900">
              Enable your Space to preview it
            </p>
            <p className="text-xs text-gray-500">
              The mobile preview loads your live published Space.
            </p>
          </div>
        )}
      </div>
      <div className="mobile-frame-home" aria-hidden />
    </div>
  )
}
